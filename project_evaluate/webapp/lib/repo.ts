import { getSql } from "./db";
import { ITEMS, levelToScore } from "./items";
import { calcGroupResult, type EvaluatorScore, type GroupResult } from "./scoring";

export interface GroupRow {
  id: number;
  name: string;
  leader: string;
  members: string; // JSON
  topic: string;
  self_report_completed: string;
  self_report_plan: string;
  self_report_ai: string;
}

export interface EvalRow {
  id: number;
  evaluator_id: number;
  group_id: number;
  item_scores: Record<string, number>; // jsonb { [itemId]: level(0-5) }
  comment: string;
  submitted: number;
  anon_label: number | null;
  is_locked: number;
  submitted_at: string | null;
  updated_at: string;
}

export async function getGroups(): Promise<GroupRow[]> {
  const sql = getSql();
  return sql<GroupRow[]>`SELECT * FROM groups ORDER BY id`;
}

export async function getGroupById(id: number): Promise<GroupRow | undefined> {
  const sql = getSql();
  const rows = await sql<GroupRow[]>`SELECT * FROM groups WHERE id = ${id}`;
  return rows[0];
}

export async function getEvaluation(evaluatorId: number, groupId: number): Promise<EvalRow | undefined> {
  const sql = getSql();
  const rows = await sql<EvalRow[]>`
    SELECT * FROM evaluations WHERE evaluator_id = ${evaluatorId} AND group_id = ${groupId}
  `;
  return rows[0];
}

// F3: 선택 즉시 자동 임시저장 (jsonb 병합으로 원자적 업데이트, 잠금 상태면 0건 반영되어 예외 처리)
export async function upsertItemLevel(evaluatorId: number, groupId: number, itemId: string, level: number): Promise<void> {
  const sql = getSql();
  const now = new Date().toISOString();
  const result = await sql`
    INSERT INTO evaluations (evaluator_id, group_id, item_scores, updated_at)
    VALUES (${evaluatorId}, ${groupId}, jsonb_build_object(${itemId}::text, ${level}::int), ${now})
    ON CONFLICT (evaluator_id, group_id) DO UPDATE SET
      item_scores = evaluations.item_scores || jsonb_build_object(${itemId}::text, ${level}::int),
      updated_at = ${now}
    WHERE evaluations.is_locked = 0
    RETURNING id
  `;
  if (result.length === 0) {
    throw new Error("마감된 평가는 수정할 수 없습니다.");
  }
}

export async function getMissingItemIds(evaluatorId: number, groupId: number): Promise<string[]> {
  const ev = await getEvaluation(evaluatorId, groupId);
  const scores = ev?.item_scores ?? {};
  return ITEMS.filter((it) => scores[it.id] === undefined).map((it) => it.id);
}

// F5: 제출 완료 처리 (13개 항목 전부 선택되어야 함)
export async function submitEvaluation(evaluatorId: number, groupId: number, comment: string): Promise<void> {
  const sql = getSql();
  const existing = await getEvaluation(evaluatorId, groupId);
  if (!existing) throw new Error("채점 데이터가 없습니다.");
  if (existing.is_locked) throw new Error("마감된 평가는 수정할 수 없습니다.");
  const missing = await getMissingItemIds(evaluatorId, groupId);
  if (missing.length > 0) {
    throw new Error(`아직 선택하지 않은 세부항목이 ${missing.length}개 있습니다.`);
  }

  const now = new Date().toISOString();
  let anonLabel = existing.anon_label;
  if (anonLabel == null) {
    const rows = await sql<{ m: number }[]>`
      SELECT COALESCE(MAX(anon_label), 0) as m FROM evaluations WHERE group_id = ${groupId} AND submitted = 1
    `;
    anonLabel = rows[0].m + 1;
  }

  await sql`
    UPDATE evaluations SET
      comment = ${comment},
      submitted = 1,
      anon_label = ${anonLabel},
      submitted_at = COALESCE(submitted_at, ${now}::timestamptz),
      updated_at = ${now}::timestamptz
    WHERE id = ${existing.id}
  `;
}

async function toEvaluatorScores(groupId: number, submittedOnly: boolean): Promise<EvaluatorScore[]> {
  const sql = getSql();
  const rows = submittedOnly
    ? await sql<(EvalRow & { role: "student" | "instructor" })[]>`
        SELECT e.*, u.role as role FROM evaluations e
        JOIN users u ON u.id = e.evaluator_id
        WHERE e.group_id = ${groupId} AND e.submitted = 1
      `
    : await sql<(EvalRow & { role: "student" | "instructor" })[]>`
        SELECT e.*, u.role as role FROM evaluations e
        JOIN users u ON u.id = e.evaluator_id
        WHERE e.group_id = ${groupId}
      `;

  return rows.map((r) => {
    const levels = r.item_scores ?? {};
    const itemScores = ITEMS.map((it) => levelToScore(levels[it.id] ?? 0, it.points));
    return { evaluatorId: r.evaluator_id, role: r.role, itemScores };
  });
}

// F6/F7: 제출 완료(submitted=true)된 평가만 집계에 반영
export async function computeProvisionalResult(groupId: number): Promise<GroupResult> {
  return calcGroupResult(await toEvaluatorScores(groupId, true));
}

export interface CompletenessStatus {
  expected: number;
  submittedComplete: number;
  missingEvaluators: { id: number; name: string; role: string; reason: string }[];
}

// F13 마감 전 완결성 검증: 대상 평가자 전원이 제출 완료(submitted=true) & 13개 항목 모두 존재해야 함
// evaluations를 그룹 단위로 1회에 모두 가져와 평가자 수만큼 왕복하지 않도록 한다(N+1 방지).
export async function checkCompleteness(groupId: number): Promise<CompletenessStatus> {
  const sql = getSql();
  const [evaluators, evalRows] = await Promise.all([
    sql<{ id: number; name: string; role: string }[]>`
      SELECT u.id, u.name, u.role FROM users u
      WHERE (u.role = 'instructor') OR (u.role = 'student' AND u.group_id != ${groupId})
    `,
    sql<EvalRow[]>`SELECT * FROM evaluations WHERE group_id = ${groupId}`,
  ]);
  const byEvaluator = new Map(evalRows.map((r) => [r.evaluator_id, r]));

  const missing: CompletenessStatus["missingEvaluators"] = [];
  let submittedComplete = 0;

  for (const ev of evaluators) {
    const row = byEvaluator.get(ev.id);
    if (!row || !row.submitted) {
      missing.push({ ...ev, reason: "미제출" });
      continue;
    }
    const scores = row.item_scores ?? {};
    const missingItems = ITEMS.filter((it) => scores[it.id] === undefined);
    if (missingItems.length > 0) {
      missing.push({ ...ev, reason: `세부항목 ${missingItems.length}개 누락` });
      continue;
    }
    submittedComplete++;
  }

  return { expected: evaluators.length, submittedComplete, missingEvaluators: missing };
}

export interface AggregatedRow {
  group_id: number;
  per_item_final_score: string;
  total_score: number;
  rank: number | null;
  trimmed_evaluator_ids: string;
  status: string;
  finalized_at: string;
}

export async function getFinalResult(groupId: number): Promise<AggregatedRow | undefined> {
  const sql = getSql();
  const rows = await sql<AggregatedRow[]>`SELECT * FROM aggregated_results WHERE group_id = ${groupId}`;
  return rows[0];
}

export async function getAllFinalResults(): Promise<AggregatedRow[]> {
  const sql = getSql();
  return sql<AggregatedRow[]>`SELECT * FROM aggregated_results ORDER BY total_score DESC`;
}

// F13: 전체 조 검증 통과 후 1회 확정 실행
export async function finalizeAllGroups(): Promise<
  { ok: true } | { ok: false; errors: { groupId: number; groupName: string; missing: CompletenessStatus }[] }
> {
  const groups = await getGroups();
  const errors: { groupId: number; groupName: string; missing: CompletenessStatus }[] = [];

  for (const g of groups) {
    const status = await checkCompleteness(g.id);
    if (status.missingEvaluators.length > 0) {
      errors.push({ groupId: g.id, groupName: g.name, missing: status });
    }
  }

  if (errors.length > 0) return { ok: false, errors };

  const results: { group: GroupRow; result: GroupResult }[] = [];
  for (const g of groups) {
    results.push({ group: g, result: calcGroupResult(await toEvaluatorScores(g.id, true)) });
  }

  // 총점 내림차순 순위(동점 공동순위)
  const sorted = [...results].sort(
    (a, b) => (b.result.totalScore as number) - (a.result.totalScore as number)
  );
  const ranks = new Map<number, number>();
  let prevScore: number | null = null;
  let prevRank = 0;
  sorted.forEach((r, idx) => {
    const score = r.result.totalScore as number;
    if (prevScore !== null && score === prevScore) {
      ranks.set(r.group.id, prevRank);
    } else {
      const rank = idx + 1;
      ranks.set(r.group.id, rank);
      prevRank = rank;
      prevScore = score;
    }
  });

  const sql = getSql();
  const now = new Date().toISOString();
  await sql.begin(async (tx) => {
    for (const { group, result } of results) {
      await tx`
        INSERT INTO aggregated_results (group_id, per_item_final_score, total_score, rank, trimmed_evaluator_ids, status, finalized_at)
        VALUES (
          ${group.id},
          ${JSON.stringify(result.perItemScore)},
          ${result.totalScore as number},
          ${ranks.get(group.id) ?? null},
          ${JSON.stringify(result.trimmedEvaluatorIds)},
          'FINAL',
          ${now}
        )
        ON CONFLICT (group_id) DO UPDATE SET
          per_item_final_score = EXCLUDED.per_item_final_score,
          total_score = EXCLUDED.total_score,
          rank = EXCLUDED.rank,
          trimmed_evaluator_ids = EXCLUDED.trimmed_evaluator_ids,
          status = 'FINAL',
          finalized_at = EXCLUDED.finalized_at
      `;
    }
    await tx`UPDATE evaluations SET is_locked = 1`;
    await tx`
      INSERT INTO app_state (key, value) VALUES ('closed', '1')
      ON CONFLICT (key) DO UPDATE SET value = '1'
    `;
  });

  return { ok: true };
}

export async function getComments(groupId: number): Promise<{ anonLabel: number; comment: string }[]> {
  const sql = getSql();
  return sql<{ anonLabel: number; comment: string }[]>`
    SELECT anon_label as "anonLabel", comment FROM evaluations
    WHERE group_id = ${groupId} AND submitted = 1
    ORDER BY anon_label ASC
  `;
}

// evaluations를 그룹 단위로 1회에 모두 가져와 평가자 수만큼 왕복하지 않도록 한다(N+1 방지).
export async function getMatrix(groupId: number): Promise<
  { evaluatorId: number; name: string; role: string; total: number; submitted: boolean }[]
> {
  const sql = getSql();
  const [evaluators, evalRows] = await Promise.all([
    sql<{ id: number; name: string; role: string }[]>`
      SELECT u.id, u.name, u.role FROM users u
      WHERE (u.role = 'instructor') OR (u.role = 'student' AND u.group_id != ${groupId})
    `,
    sql<EvalRow[]>`SELECT * FROM evaluations WHERE group_id = ${groupId}`,
  ]);
  const byEvaluator = new Map(evalRows.map((r) => [r.evaluator_id, r]));

  return evaluators.map((ev) => {
    const row = byEvaluator.get(ev.id);
    const levels = row?.item_scores ?? {};
    const total = ITEMS.reduce((s, it) => s + levelToScore(levels[it.id] ?? 0, it.points), 0);
    return {
      evaluatorId: ev.id,
      name: ev.name,
      role: ev.role,
      total,
      submitted: !!row?.submitted,
    };
  });
}
