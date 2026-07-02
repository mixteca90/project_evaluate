import assert from "node:assert/strict";
import { getDb, isClosed } from "../lib/db";
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

const db = getDb();

// evaluator ids: 1-5=1조, 6-10=2조, 11-15=3조, 16=강사
function evaluatorsFor(groupId: number): number[] {
  const others = db
    .prepare("SELECT id FROM users WHERE role='student' AND group_id != ?")
    .all(groupId) as { id: number }[];
  const instructor = db.prepare("SELECT id FROM users WHERE role='instructor'").get() as { id: number };
  return [...others.map((o) => o.id), instructor.id];
}

function scoreAllItems(evaluatorId: number, groupId: number, levelPicker: (itemIdx: number) => number) {
  ITEMS.forEach((item, idx) => {
    upsertItemLevel(evaluatorId, groupId, item.id, levelPicker(idx));
  });
}

console.log("=== 리허설 시작 ===");

// 1조 평가: 10명 학생(레벨 다양) + 강사, 의도적으로 경계 동점 포함
const g1Evaluators = evaluatorsFor(1);
assert.equal(g1Evaluators.length, 11, "1조 예상 평가자 11명");
const levelPlan1: Record<number, number> = { 6: 2, 7: 2, 8: 2, 9: 4, 10: 4, 11: 4, 12: 5, 13: 5, 14: 3, 15: 3 };
for (const evId of g1Evaluators) {
  if (evId === 16) continue; // 강사는 마지막에 처리
  const lvl = levelPlan1[evId] ?? 3;
  scoreAllItems(evId, 1, () => lvl);
  submitEvaluation(evId, 1, `자동 리허설 의견 - 평가자${evId}`);
}
// 강사는 아직 제출 안 함 -> PENDING 확인
{
  const status = checkCompleteness(1);
  console.log("[1조] 강사 제출 전 완결성:", status.expected, status.submittedComplete, status.missingEvaluators.map(m=>m.name));
  assert.equal(status.missingEvaluators.length, 1);
  const provisional = computeProvisionalResult(1);
  assert.equal(provisional.totalScore, "PENDING_INSTRUCTOR");
  console.log("[OK] 강사 미제출 상태에서 PENDING_INSTRUCTOR 확인");
}
scoreAllItems(16, 1, () => 4);
submitEvaluation(16, 1, "강사 의견");
{
  const status = checkCompleteness(1);
  assert.equal(status.missingEvaluators.length, 0);
  assert.equal(status.submittedComplete, 11);
  const provisional = computeProvisionalResult(1);
  assert.notEqual(provisional.totalScore, "PENDING_INSTRUCTOR");
  console.log("[OK] 1조 전원 제출 완료, 잠정 총점:", provisional.totalScore, "절사대상:", provisional.trimmedEvaluatorIds, "동점보조기준:", provisional.tieBreakApplied);
}

// 2조 평가: 전원 동일 레벨(절사 후에도 동일 점수 유지되는지 확인용)
const g2Evaluators = evaluatorsFor(2);
for (const evId of g2Evaluators) {
  scoreAllItems(evId, 2, () => 3);
  submitEvaluation(evId, 2, "");
}
{
  const provisional = computeProvisionalResult(2);
  console.log("[2조] 전원 동일 레벨 잠정 총점:", provisional.totalScore);
}

// 3조 평가: 전원 만점
const g3Evaluators = evaluatorsFor(3);
for (const evId of g3Evaluators) {
  scoreAllItems(evId, 3, () => 5);
  submitEvaluation(evId, 3, "만점 리허설");
}

// 마감 시도 전 상태 확인
assert.equal(isClosed(), false);

const closeResult = finalizeAllGroups();
assert.equal(closeResult.ok, true, "전원 제출 완료 상태이므로 마감 성공해야 함");
assert.equal(isClosed(), true);
console.log("[OK] 마감 처리 성공");

// 마감 후 잠금 검증: 추가 채점 시도 시 예외 발생해야 함
try {
  upsertItemLevel(6, 1, "1", 5);
  throw new Error("잠금 상태인데 저장이 성공함 - 버그");
} catch (e) {
  assert.ok(e instanceof Error && e.message.includes("마감"));
  console.log("[OK] 마감 후 채점 시도 차단됨:", (e as Error).message);
}

// 확정 결과 검증
const finals = getAllFinalResults();
assert.equal(finals.length, 3);
console.log("[OK] 확정 결과 3건:", finals.map((f) => ({ group: f.group_id, total: f.total_score, rank: f.rank })));

const g1Final = getFinalResult(1)!;
const g1PerItem = JSON.parse(g1Final.per_item_final_score) as number[];
const perItemSum = g1PerItem.reduce((a, b) => a + b, 0);
assert.ok(Math.abs(perItemSum - g1Final.total_score) < 1e-6, "1조 세부항목 합 == 확정 총점");
console.log("[OK] 확정 저장된 1조 세부항목 합 == 확정 총점 (diff=", Math.abs(perItemSum - g1Final.total_score), ")");

console.log("\n=== 모든 리허설 시나리오 통과 ===");
