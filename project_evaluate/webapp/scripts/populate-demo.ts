import { getSql, ensureSchema } from "../lib/db";
import { ITEMS } from "../lib/items";
import { upsertItemLevel, submitEvaluation } from "../lib/repo";

const COMMENTS = [
  "문제 정의가 명확하고 실제 현장에서 쓸 수 있을 것 같습니다. 시연도 안정적이었어요.",
  "AI 협업 과정을 구체적으로 설명해주셔서 이해가 잘 됐습니다. 프롬프트 개선 과정이 인상적이었어요.",
  "핵심 기능은 잘 작동했는데 UI가 조금 더 직관적이면 좋을 것 같습니다.",
  "질의응답 대응이 근거가 확실해서 신뢰가 갔습니다.",
  "완성도가 높고 확장 가능성도 잘 설명해주셨습니다.",
  "",
  "향후 계획이 구체적이라 좋았습니다. 다음 단계 설계까지 준비된 점이 인상적입니다.",
  "발표 전달력이 좋았고 시연 흐름도 매끄러웠습니다.",
  "직접 구현한 부분에 대한 판단 근거가 명확해서 좋았습니다.",
  "전체적으로 완성도 있는 프로젝트였습니다. 수고하셨습니다.",
];

async function main() {
  await ensureSchema();
  const sql = getSql();

  function evaluatorsFor(groupId: number) {
    return sql<{ id: number; role: string }[]>`
      SELECT id, role FROM users WHERE (role='instructor') OR (role='student' AND group_id != ${groupId})
    `;
  }

  async function scoreAndSubmit(evaluatorId: number, groupId: number, base: number, spread: number, commentIdx: number) {
    for (let idx = 0; idx < ITEMS.length; idx++) {
      const jitter = ((evaluatorId + idx) % (spread + 1)) - Math.floor(spread / 2);
      const level = Math.max(0, Math.min(5, base + jitter));
      await upsertItemLevel(evaluatorId, groupId, ITEMS[idx].id, level);
    }
    await submitEvaluation(evaluatorId, groupId, COMMENTS[commentIdx % COMMENTS.length]);
  }

  // 1조: 중간 수준, 다소 편차 있음 (절사 효과를 볼 수 있도록)
  const g1 = await evaluatorsFor(1);
  let ci = 0;
  for (const ev of g1) {
    const base = ev.role === "instructor" ? 4 : 3;
    await scoreAndSubmit(ev.id, 1, base, 3, ci++);
    console.log("1조 채점 완료:", ev.id, ev.role);
  }

  // 2조: 고르게 우수
  const g2 = await evaluatorsFor(2);
  for (const ev of g2) {
    const base = ev.role === "instructor" ? 5 : 4;
    await scoreAndSubmit(ev.id, 2, base, 1, ci++);
    console.log("2조 채점 완료:", ev.id, ev.role);
  }

  // 3조: 최고 수준
  const g3 = await evaluatorsFor(3);
  for (const ev of g3) {
    const base = 5;
    await scoreAndSubmit(ev.id, 3, base, 0, ci++);
    console.log("3조 채점 완료:", ev.id, ev.role);
  }

  console.log("\n전체 조 데이터 채우기 완료 (마감 처리는 하지 않음 — I1에서 직접 눌러보실 수 있습니다)");
  await sql.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
