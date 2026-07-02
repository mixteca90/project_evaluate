export type ItemGroup = "①" | "②" | "③" | "④" | "⑤";

export interface ItemDef {
  id: string;
  group: ItemGroup;
  groupName: string;
  name: string;
  points: number;
}

// 조별_프로젝트_평가기준.md 5-2 세부항목 채점표 순서와 배점을 그대로 반영 (총 100점, 13개)
export const ITEMS: ItemDef[] = [
  { id: "1", group: "①", groupName: "문제 정의 및 기획력", name: "문제의식의 명확성·구체성", points: 10 },
  { id: "2", group: "①", groupName: "문제 정의 및 기획력", name: "대상 사용자·활용 시나리오의 구체성", points: 5 },
  { id: "3", group: "①", groupName: "문제 정의 및 기획력", name: "문제 해결의 실질적 가치", points: 5 },
  { id: "4", group: "②", groupName: "바이브 코딩(AI 협업) 과정", name: "프롬프트 설계의 구체성", points: 10 },
  { id: "5", group: "②", groupName: "바이브 코딩(AI 협업) 과정", name: "AI 코드 이해·검증 및 오류 해결 과정", points: 10 },
  { id: "6", group: "②", groupName: "바이브 코딩(AI 협업) 과정", name: "반복 개선 과정", points: 5 },
  { id: "7", group: "③", groupName: "결과물의 완성도 및 작동성", name: "핵심 기능 작동 및 시연 가능성", points: 10 },
  { id: "8", group: "③", groupName: "결과물의 완성도 및 작동성", name: "실행 안정성 및 결과값의 근거성", points: 10 },
  { id: "9", group: "③", groupName: "결과물의 완성도 및 작동성", name: "UI 이해 용이성", points: 5 },
  { id: "10", group: "④", groupName: "실용성 및 활용 가치", name: "실제 업무·일상 적용 가능성", points: 10 },
  { id: "11", group: "④", groupName: "실용성 및 활용 가치", name: "향후 확장·응용 가능성", points: 10 },
  { id: "12", group: "⑤", groupName: "발표 및 시연 설득력", name: "시연 전달력 및 개발 과정 설명", points: 5 },
  { id: "13", group: "⑤", groupName: "발표 및 시연 설득력", name: "질의응답 대응의 근거성", points: 5 },
];

export const TOTAL_POINTS = ITEMS.reduce((sum, it) => sum + it.points, 0); // 100

// 6단계 선택(레벨 0~5) -> 점수. 배점이 5의 배수라 항상 정수로 떨어짐(F3 규칙)
export function levelToScore(level: number, points: number): number {
  if (level < 0 || level > 5) throw new Error(`invalid level: ${level}`);
  return (level / 5) * points;
}

export const LEVEL_LABELS = ["매우부족", "부족", "보통", "양호", "우수", "매우우수"];
