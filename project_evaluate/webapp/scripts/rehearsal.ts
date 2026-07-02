import assert from "node:assert/strict";
import { getSql, isClosed, ensureSchema } from "../lib/db";
import { ITEMS } from "../lib/items";
import {
  upsertItemLevel,
  submitEvaluation,
  checkCompleteness,
  computeProvisionalResult,
  finalizeAllGroups,
  getFinalResult,
  getAllFinalResults,
} from "../lib/repo";

async function main() {
  await ensureSchema();
  const sql = getSql();

  // evaluator ids: 1-5=1조, 6-10=2조, 11-15=3조, 16=강사
  async function evaluatorsFor(groupId: number): Promise<number[]> {
    const others = await sql<{ id: number }[]>`SELECT id FROM users WHERE role='student' AND group_id != ${groupId}`;
    const [instructor] = await sql<{ id: number }[]>`SELECT id FROM users WHERE role='instructor'`;
    return [...others.map((o) => o.id), instructor.id];
  }

  async function scoreAllItems(evaluatorId: number, groupId: number, levelPicker: (itemIdx: number) => number) {
    for (let idx = 0; idx < ITEMS.length; idx++) {
      await upsertItemLevel(evaluatorId, groupId, ITEMS[idx].id, levelPicker(idx));
    }
  }

  console.log("=== 리허설 시작 ===");

  const g1Evaluators = await evaluatorsFor(1);
  assert.equal(g1Evaluators.length, 11, "1조 예상 평가자 11명");
  const levelPlan1: Record<number, number> = { 6: 2, 7: 2, 8: 2, 9: 4, 10: 4, 11: 4, 12: 5, 13: 5, 14: 3, 15: 3 };
  for (const evId of g1Evaluators) {
    if (evId === 16) continue;
    const lvl = levelPlan1[evId] ?? 3;
    await scoreAllItems(evId, 1, () => lvl);
    await submitEvaluation(evId, 1, `자동 리허설 의견 - 평가자${evId}`);
  }
  {
    const status = await checkCompleteness(1);
    console.log("[1조] 강사 제출 전 완결성:", status.expected, status.submittedComplete, status.missingEvaluators.map((m) => m.name));
    assert.equal(status.missingEvaluators.length, 1);
    const provisional = await computeProvisionalResult(1);
    assert.equal(provisional.totalScore, "PENDING_INSTRUCTOR");
    console.log("[OK] 강사 미제출 상태에서 PENDING_INSTRUCTOR 확인");
  }
  await scoreAllItems(16, 1, () => 4);
  await submitEvaluation(16, 1, "강사 의견");
  {
    const status = await checkCompleteness(1);
    assert.equal(status.missingEvaluators.length, 0);
    assert.equal(status.submittedComplete, 11);
    const provisional = await computeProvisionalResult(1);
    assert.notEqual(provisional.totalScore, "PENDING_INSTRUCTOR");
    console.log("[OK] 1조 전원 제출 완료, 잠정 총점:", provisional.totalScore, "절사대상:", provisional.trimmedEvaluatorIds, "동점보조기준:", provisional.tieBreakApplied);
  }

  const g2Evaluators = await evaluatorsFor(2);
  for (const evId of g2Evaluators) {
    await scoreAllItems(evId, 2, () => 3);
    await submitEvaluation(evId, 2, "");
  }
  {
    const provisional = await computeProvisionalResult(2);
    console.log("[2조] 전원 동일 레벨 잠정 총점:", provisional.totalScore);
  }

  const g3Evaluators = await evaluatorsFor(3);
  for (const evId of g3Evaluators) {
    await scoreAllItems(evId, 3, () => 5);
    await submitEvaluation(evId, 3, "만점 리허설");
  }

  assert.equal(await isClosed(), false);

  const closeResult = await finalizeAllGroups();
  assert.equal(closeResult.ok, true, "전원 제출 완료 상태이므로 마감 성공해야 함");
  assert.equal(await isClosed(), true);
  console.log("[OK] 마감 처리 성공");

  try {
    await upsertItemLevel(6, 1, "1", 5);
    throw new Error("잠금 상태인데 저장이 성공함 - 버그");
  } catch (e) {
    assert.ok(e instanceof Error && e.message.includes("마감"));
    console.log("[OK] 마감 후 채점 시도 차단됨:", (e as Error).message);
  }

  const finals = await getAllFinalResults();
  assert.equal(finals.length, 3);
  console.log("[OK] 확정 결과 3건:", finals.map((f) => ({ group: f.group_id, total: f.total_score, rank: f.rank })));

  const g1Final = (await getFinalResult(1))!;
  const g1PerItem = JSON.parse(g1Final.per_item_final_score) as number[];
  const perItemSum = g1PerItem.reduce((a, b) => a + b, 0);
  assert.ok(Math.abs(perItemSum - g1Final.total_score) < 1e-6, "1조 세부항목 합 == 확정 총점");
  console.log("[OK] 확정 저장된 1조 세부항목 합 == 확정 총점 (diff=", Math.abs(perItemSum - g1Final.total_score), ")");

  console.log("\n=== 모든 리허설 시나리오 통과 ===");
  await sql.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
