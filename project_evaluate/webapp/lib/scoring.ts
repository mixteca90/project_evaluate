import { ITEMS } from "./items";

export interface EvaluatorScore {
  evaluatorId: number;
  role: "student" | "instructor";
  itemScores: number[]; // length 13, raw integer scores per item
}

export interface GroupResult {
  totalScore: number | "PENDING_INSTRUCTOR";
  perItemScore: number[] | "PENDING_INSTRUCTOR"; // length 13
  trimmedEvaluatorIds: number[];
  tieBreakApplied: boolean;
  validStudentCount: number;
  trimApplied: boolean;
}

const ITEM_COUNT = ITEMS.length;

function sum(nums: number[]): number {
  return nums.reduce((a, b) => a + b, 0);
}

/**
 * 조별_프로젝트_평가기준.md 3-2, 앱_기능맵.md F6/F7과 동일한 절차.
 * 절사 대상은 총점 기준으로 1회만 결정하고, 그 결과를 총점·13개 세부항목 계산에 동일하게 적용한다.
 * 중간값은 반올림하지 않는다(반올림은 표시 시 formatScore에서만 수행).
 */
export function calcGroupResult(evaluators: EvaluatorScore[]): GroupResult {
  const students = evaluators.filter((e) => e.role === "student");
  const instructor = evaluators.find((e) => e.role === "instructor") ?? null;

  for (const e of evaluators) {
    if (e.itemScores.length !== ITEM_COUNT) {
      throw new Error(`evaluator ${e.evaluatorId} itemScores length must be ${ITEM_COUNT}`);
    }
  }

  const studentTotals = students.map((s) => ({
    evaluatorId: s.evaluatorId,
    total: sum(s.itemScores),
  }));

  // 총점 기준 정렬(오름차순), 동점은 evaluator id 오름차순을 보조 기준으로 사용
  const sortedAsc = [...studentTotals].sort(
    (a, b) => a.total - b.total || a.evaluatorId - b.evaluatorId
  );

  const trimApplied = sortedAsc.length >= 5;
  let trimmedIds: number[] = [];
  let tieBreakApplied = false;

  if (trimApplied) {
    const lowest2 = sortedAsc.slice(0, 2);
    const highest2 = sortedAsc.slice(-2);
    trimmedIds = [...lowest2, ...highest2].map((s) => s.evaluatorId);

    // 절사 경계(3번째로 낮은/높은 값)와 동점이면 보조 기준(evaluator id)이 실제로 적용된 것
    const n = sortedAsc.length;
    if (n > 2) {
      const lowBoundaryTie = sortedAsc[1].total === sortedAsc[2].total;
      const highBoundaryTie = sortedAsc[n - 2].total === sortedAsc[n - 3].total;
      tieBreakApplied = lowBoundaryTie || highBoundaryTie;
    }
  }

  const trimmedSet = new Set(trimmedIds);
  const validStudents = students.filter((s) => !trimmedSet.has(s.evaluatorId));
  const validStudentCount = validStudents.length;

  if (!instructor) {
    return {
      totalScore: "PENDING_INSTRUCTOR",
      perItemScore: "PENDING_INSTRUCTOR",
      trimmedEvaluatorIds: trimmedIds,
      tieBreakApplied,
      validStudentCount,
      trimApplied,
    };
  }

  const denominator = validStudentCount + 3;

  const perItemScore: number[] = [];
  for (let i = 0; i < ITEM_COUNT; i++) {
    const studentSum = sum(validStudents.map((s) => s.itemScores[i]));
    const instructorWeighted = instructor.itemScores[i] * 3;
    perItemScore.push((studentSum + instructorWeighted) / denominator);
  }

  const studentTotalSum = sum(validStudents.map((s) => sum(s.itemScores)));
  const instructorTotalWeighted = sum(instructor.itemScores) * 3;
  const totalScore = (studentTotalSum + instructorTotalWeighted) / denominator;

  return {
    totalScore,
    perItemScore,
    trimmedEvaluatorIds: trimmedIds,
    tieBreakApplied,
    validStudentCount,
    trimApplied,
  };
}

// 표시/확정 저장 시에만 소수 둘째 자리에서 반올림해 첫째 자리까지 사용
export function formatScore(score: number | "PENDING_INSTRUCTOR"): string {
  if (score === "PENDING_INSTRUCTOR") return "강사 평가 대기 중";
  return (Math.round(score * 10) / 10).toFixed(1);
}
