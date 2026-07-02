import assert from "node:assert/strict";
import { calcGroupResult, formatScore } from "../lib/scoring";
import { ITEMS, TOTAL_POINTS } from "../lib/items";

function makeEval(id: number, role: "student" | "instructor", total: number): { evaluatorId: number; role: "student" | "instructor"; itemScores: number[] } {
  // 13개 항목에 total을 배점 비율대로 분배(정확한 total 재현용 테스트 헬퍼)
  const scores = ITEMS.map((it) => Math.round((it.points / TOTAL_POINTS) * total));
  return { evaluatorId: id, role, itemScores: scores };
}

// 1) 정상 케이스: 학생 10명 제출(총점 60~95 분포) + 강사 1명(90점)
{
  const students = [60, 65, 70, 72, 75, 78, 80, 85, 90, 95].map((t, i) => makeEval(i + 1, "student", t));
  const instructor = makeEval(100, "instructor", 90);
  const result = calcGroupResult([...students, instructor]);
  assert.equal(result.trimApplied, true);
  assert.equal(result.trimmedEvaluatorIds.length, 4);
  // 최저 2인(60,65 -> id 1,2), 최고 2인(90,95 -> id 9,10) 절사
  assert.deepEqual(result.trimmedEvaluatorIds.sort((a, b) => a - b), [1, 2, 9, 10]);
  assert.notEqual(result.totalScore, "PENDING_INSTRUCTOR");
  console.log("[OK] 정상 10명 제출 케이스, 절사대상:", result.trimmedEvaluatorIds, "총점:", formatScore(result.totalScore));
}

// 2) 세부항목 합산 === 총점 산출식 직접계산 (반올림 순서 버그 없는지 검증)
{
  const students = [60, 65, 70, 72, 75, 78, 80, 85, 90, 95].map((t, i) => makeEval(i + 1, "student", t));
  const instructor = makeEval(100, "instructor", 90);
  const result = calcGroupResult([...students, instructor]);
  const perItemSum = (result.perItemScore as number[]).reduce((a, b) => a + b, 0);
  const diff = Math.abs(perItemSum - (result.totalScore as number));
  assert.ok(diff < 1e-9, `세부항목 합계(${perItemSum})와 총점(${result.totalScore})이 불일치: diff=${diff}`);
  console.log("[OK] 세부항목 합산 == 총점 산출식 일치 (diff=", diff, ")");
}

// 3) 경계 동점 케이스: 3번째로 낮은 점수와 절사대상 2위가 동점
{
  const students = [60, 60, 60, 72, 75, 78, 80, 85, 90, 95].map((t, i) => makeEval(i + 1, "student", t));
  const instructor = makeEval(100, "instructor", 90);
  const result = calcGroupResult([...students, instructor]);
  assert.equal(result.tieBreakApplied, true);
  // id 1,2가 절사되어야 함 (오름차순 evaluatorId 보조기준)
  assert.deepEqual(result.trimmedEvaluatorIds.filter((id) => id <= 3).sort(), [1, 2]);
  console.log("[OK] 절사 경계 동점 -> evaluator id 오름차순 보조기준 적용:", result.trimmedEvaluatorIds);
}

// 4) 학생 5인 미만 -> 절사 생략
{
  const students = [60, 70, 80].map((t, i) => makeEval(i + 1, "student", t));
  const instructor = makeEval(100, "instructor", 90);
  const result = calcGroupResult([...students, instructor]);
  assert.equal(result.trimApplied, false);
  assert.equal(result.trimmedEvaluatorIds.length, 0);
  assert.equal(result.validStudentCount, 3);
  console.log("[OK] 학생 5인 미만 절사 생략, 유효인원:", result.validStudentCount);
}

// 5) 강사 미제출 -> PENDING_INSTRUCTOR
{
  const students = [60, 65, 70, 72, 75, 78, 80, 85, 90, 95].map((t, i) => makeEval(i + 1, "student", t));
  const result = calcGroupResult(students);
  assert.equal(result.totalScore, "PENDING_INSTRUCTOR");
  assert.equal(formatScore(result.totalScore), "강사 평가 대기 중");
  console.log("[OK] 강사 미제출 -> PENDING_INSTRUCTOR");
}

// 6) 산출식 수치 직접 검증: 학생 10명 전원 80점, 강사 100점 -> 절사 후 6명 모두 80
{
  const students = Array.from({ length: 10 }, (_, i) => makeEval(i + 1, "student", 80));
  const instructor = makeEval(100, "instructor", 100);
  const result = calcGroupResult([...students, instructor]);
  // (6*80 + 100*3) / (6+3) = (480+300)/9 = 86.666...
  const expected = (6 * 80 + 100 * 3) / 9;
  assert.ok(Math.abs((result.totalScore as number) - expected) < 1e-9);
  assert.equal(formatScore(result.totalScore), "86.7");
  console.log("[OK] 산출식 직접 검증, 총점:", formatScore(result.totalScore));
}

console.log("\n모든 검증 통과");
