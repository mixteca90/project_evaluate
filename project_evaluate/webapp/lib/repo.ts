import { getDb } from "./db";
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
  item_scores: string; // JSON { [itemId]: level(0-5) }
  comment: string;
  submitted: number;
  anon_label: number | null;
  is_locked: number;
  submitted_at: string | null;
  updated_at: string;
}

export function getGroups(): GroupRow[] {
  return getDb().prepare("SELECT * FROM groups ORDER BY id").all() as GroupRow[];
}

export function getGroupById(id: number): GroupRow | undefined {
  return getDb().prepare("SELECT * FROM groups WHERE id = ?").get(id) as GroupRow | undefined;
}

export function getEvaluation(evaluatorId: number, groupId: number): EvalRow | undefined {
  return getDb()
    .prepare("SELECT * FROM evaluations WHERE evaluator_id = ? AND group_id = ?")
    .get(evaluatorId, groupId) as EvalRow | undefined;
}

function parseItemScores(json: string): Record<string, number> {
  try {
    return JSON.parse(json);
  } catch {
    return {};
  }
}

// F3: 선택 즉시 자동 임시저장
export function upsertItemLevel(evaluatorId: number, groupId: number, itemId: string, level: number): void {
  const db = getDb();
  const existing = getEvaluation(evaluatorId, groupId);
  const now = new Date().toISOString();
  if (!existing) {
    db.prepare(
      `INSERT INTO evaluations (evaluator_id, group_id, item_scores, comment, submitted, is_locked, updated_at)
       VALUES (?, ?, ?, '', 0, 0, ?)`
    ).run(evaluatorId, groupId, JSON.stringify({ [itemId]: level }), now);
    return;
  }
  if (existing.is_locked) throw new Error("마감된 평가는 수정할 수 없습니다.");
  const scores = parseItemScores(existing.item_scores);
  scores[itemId] = level;
  db.prepare("UPDATE evaluations SET item_scores = ?, updated_at = ? WHERE id = ?").run(
    JSON.stringify(scores),
    now,
    existing.id
  );
}

export function getMissingItemIds(evaluatorId: number, groupId: number): string[] {
  const ev = getEvaluation(evaluatorId, groupId);
  const scores = ev ? parseItemScores(ev.item_scores) : {};
  return ITEMS.filter((it) => scores[it.id] === undefined).map((it) => it.id);
}

// F5: 제출 완료 처리 (13개 항목 전부 선택되어야 함)
export function submitEvaluation(evaluatorId: number, groupId: number, comment: string): void {
  const db = getDb();
  const existing = getEvaluation(evaluatorId, groupId);
  if (!existing) throw new Error("채점 데이터가 없습니다.");
  if (existing.is_locked) throw new Error("마감된 평가는 수정할 수 없습니다.");
  const missing = getMissingItemIds(evaluatorId, groupId);
  if (missing.length > 0) {
    throw new Error(`아직 선택하지 않은 세부항목이 ${missing.length}개 있습니다.`);
  }

  const now = new Date().toISOString();
  let anonLabel = existing.anon_label;
  if (anonLabel == null) {
    const row = db
      .prepare("SELECT COALESCE(MAX(anon_label), 0) as m FROM evaluations WHERE group_id = ? AND submitted = 1")
      .get(groupId) as { m: number };
    anonLabel = row.m + 1;
  }

  db.prepare(
    "UPDATE evaluations SET comment = ?, submitted = 1, anon_label = ?, submitted_at = COALESCE(submitted_at, ?), updated_at = ? WHERE id = ?"
  ).run(comment, anonLabel, now, now, existing.id);
}

function toEvaluatorScores(groupId: number, submittedOnly: boolean): EvaluatorScore[] {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT e.*, u.role as role FROM evaluations e
       JOIN users u ON u.id = e.evaluator_id
       WHERE e.group_id = ? ${submittedOnly ? "AND e.submitted = 1" : ""}`
    )
    .all(groupId) as (EvalRow & { role: "student" | "instructor" })[];

  return rows.map((r) => {
    const levels = parseItemScores(r.item_scores);
    const itemScores = ITEMS.map((it) => levelToScore(levels[it.id] ?? 0, it.points));
    return { evaluatorId: r.evaluator_id, role: r.role, itemScores };
  });
}

// F6/F7: 제출 완료(submitted=true)된 평가만 집계에 반영
export function computeProvisionalResult(groupId: number): GroupResult {
  return calcGroupResult(toEvaluatorScores(groupId, true));
}

export function expectedEvaluatorCount(groupId: number): number {
  const db = getDb();
  const otherStudents = db
    .prepare("SELECT COUNT(*) as c FROM users WHERE role = 'student' AND group_id != ?")
    .get(groupId) as { c: number };
  const instructorExists = db.prepare("SELECT COUNT(*) as c FROM users WHERE role = 'instructor'").get() as {
    c: number;
  };
  return otherStudents.c + instructorExists.c;
}

export interface CompletenessStatus {
  expected: number;
  submittedComplete: number;
  missingEvaluators: { id: number; name: string; role: string; reason: string }[];
}

// F13 마감 전 완결성 검증: 대상 평가자 전원이 제출 완료(submitted=true) & 13개 항목 모두 존재해야 함
export function checkCompleteness(groupId: number): CompletenessStatus {
  const db = getDb();
  const expected = expectedEvaluatorCount(groupId);
  const evaluators = db
    .prepare(
      `SELECT u.id, u.name, u.role FROM users u
       WHERE (u.role = 'instructor') OR (u.role = 'student' AND u.group_id != ?)`
    )
    .all(groupId) as { id: number; name: string; role: string }[];

  const missing: CompletenessStatus["missingEvaluators"] = [];
  let submittedComplete = 0;

  for (const ev of evaluators) {
    const row = getEvaluation(ev.id, groupId);
    if (!row || !row.submitted) {
      missing.push({ ...ev, reason: "미제출" });
      continue;
    }
    const missingItems = getMissingItemIds(ev.id, groupId);
    if (missingItems.length > 0) {
      missing.push({ ...ev, reason: `세부항목 ${missingItems.length}개 누락` });
      continue;
    }
    submittedComplete++;
  }

  return { expected, submittedComplete, missingEvaluators: missing };
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

export function getFinalResult(groupId: number): AggregatedRow | undefined {
  return getDb()
    .prepare("SELECT * FROM aggregated_results WHERE group_id = ?")
    .get(groupId) as AggregatedRow | undefined;
}

export function getAllFinalResults(): AggregatedRow[] {
  return getDb()
    .prepare("SELECT * FROM aggregated_results ORDER BY total_score DESC")
    .all() as AggregatedRow[];
}

// F13: 전체 조 검증 통과 후 1회 확정 실행
export function finalizeAllGroups(): { ok: true } | { ok: false; errors: { groupId: number; groupName: string; missing: CompletenessStatus }[] } {
  const groups = getGroups();
  const errors: { groupId: number; groupName: string; missing: CompletenessStatus }[] = [];

  for (const g of groups) {
    const status = checkCompleteness(g.id);
    if (status.missingEvaluators.length > 0) {
      errors.push({ groupId: g.id, groupName: g.name, missing: status });
    }
  }

  if (errors.length > 0) return { ok: false, errors };

  const db = getDb();
  const results = groups.map((g) => ({ group: g, result: calcGroupResult(toEvaluatorScores(g.id, true)) }));

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

  const now = new Date().toISOString();
  const tx = db.transaction(() => {
    for (const { group, result } of results) {
      db.prepare(
        `INSERT INTO aggregated_results (group_id, per_item_final_score, total_score, rank, trimmed_evaluator_ids, status, finalized_at)
         VALUES (?, ?, ?, ?, ?, 'FINAL', ?)
         ON CONFLICT(group_id) DO UPDATE SET
           per_item_final_score = excluded.per_item_final_score,
           total_score = excluded.total_score,
           rank = excluded.rank,
           trimmed_evaluator_ids = excluded.trimmed_evaluator_ids,
           status = 'FINAL',
           finalized_at = excluded.finalized_at`
      ).run(
        group.id,
        JSON.stringify(result.perItemScore),
        result.totalScore as number,
        ranks.get(group.id) ?? null,
        JSON.stringify(result.trimmedEvaluatorIds),
        now
      );
    }
    db.prepare("UPDATE evaluations SET is_locked = 1").run();
    db.prepare(
      "INSERT INTO app_state (key, value) VALUES ('closed', '1') ON CONFLICT(key) DO UPDATE SET value = '1'"
    ).run();
  });
  tx();

  return { ok: true };
}

export function getComments(groupId: number): { anonLabel: number; comment: string }[] {
  return getDb()
    .prepare(
      "SELECT anon_label as anonLabel, comment FROM evaluations WHERE group_id = ? AND submitted = 1 ORDER BY anon_label ASC"
    )
    .all(groupId) as { anonLabel: number; comment: string }[];
}

export function getMatrix(groupId: number): {
  evaluatorId: number;
  name: string;
  role: string;
  total: number;
  submitted: boolean;
}[] {
  const db = getDb();
  const evaluators = db
    .prepare(
      `SELECT u.id, u.name, u.role FROM users u
       WHERE (u.role = 'instructor') OR (u.role = 'student' AND u.group_id != ?)`
    )
    .all(groupId) as { id: number; name: string; role: string }[];

  return evaluators.map((ev) => {
    const row = getEvaluation(ev.id, groupId);
    const levels = row ? parseItemScores(row.item_scores) : {};
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
