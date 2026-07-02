import { getDirectSql, ensureSchema } from "./db";

// 조별 명단.txt 기준 시드 데이터 (2026-07-02 기준: 3조 조장 오소영)
const GROUPS = [
  {
    id: 1,
    name: "오도방정",
    leader: "임윤숙",
    members: ["나은수", "진대현", "안찬호", "임윤숙", "김형우"],
    topic: "개인정보 블락(Block) 서비스 구축",
  },
  {
    id: 2,
    name: "몽블랑 만년필 사조",
    leader: "류재훈",
    members: ["류재훈", "유찬재", "정민규", "임미성", "문교범"],
    topic: "산악구조실종자 수색지원 예측 시스템 구축",
  },
  {
    id: 3,
    name: "GIGO (Good In, Great Out)",
    leader: "오소영",
    members: ["정기홍", "김무영", "이재환", "이지형", "오소영"],
    topic: "응급환자 사전등록 QR 정보 시스템",
  },
];

const INSTRUCTOR_NAME = "이정현";

export async function seed(): Promise<void> {
  await ensureSchema();
  const sql = getDirectSql();

  const [{ c: groupCount }] = await sql<{ c: number }[]>`SELECT COUNT(*)::int as c FROM groups`;
  if (groupCount > 0) {
    console.log("이미 시드되어 있습니다. (groups:", groupCount, ")");
    return;
  }

  await sql.begin(async (tx) => {
    let userId = 1;
    for (const g of GROUPS) {
      await tx`
        INSERT INTO groups (id, name, leader, members, topic, self_report_completed, self_report_plan, self_report_ai)
        VALUES (
          ${g.id}, ${g.name}, ${g.leader}, ${JSON.stringify(g.members)}, ${g.topic},
          '(발표 전 자기신고 예정 — 강사가 사전에 입력 필요)',
          '(발표 전 자기신고 예정 — 강사가 사전에 입력 필요)',
          '(발표 전 자기신고 예정 — 강사가 사전에 입력 필요)'
        )
      `;
      for (const memberName of g.members) {
        await tx`INSERT INTO users (id, name, role, group_id) VALUES (${userId}, ${memberName}, 'student', ${g.id})`;
        userId++;
      }
    }
    await tx`INSERT INTO users (id, name, role, group_id) VALUES (${userId}, ${INSTRUCTOR_NAME}, 'instructor', NULL)`;
  });

  console.log("시드 완료:", GROUPS.length, "개 조,", GROUPS.reduce((s, g) => s + g.members.length, 0) + 1, "명");
}
