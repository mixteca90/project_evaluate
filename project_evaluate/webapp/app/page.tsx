import Link from "next/link";

const PRINCIPLES = [
  { title: "근거 기반 채점", desc: "발표·시연·질의응답에서 실제로 확인된 내용에 근거해 점수를 매깁니다." },
  { title: "완성도 ↔ 확장계획 분리", desc: "발표 시점에 시연·검증된 결과물만 완성도(③)로 채점하고, 향후 계획은 ④에서만 반영합니다." },
  { title: "AI 협업은 비율이 아닌 과정 품질", desc: "AI 활용 비율이 아니라 프롬프트 설계·검증·개선 과정의 품질로 채점합니다(②)." },
  { title: "자기 조 채점 제외", desc: "본인이 속한 조는 평가 대상에서 자동으로 제외됩니다." },
];

export default function Page() {
  return (
    <div className="flex flex-col min-h-screen">
      <div className="pt-10 px-6 pb-4">
        <p className="text-xs text-blue-600 font-semibold tracking-wide">조별 프로젝트 평가</p>
        <h1 className="text-xl font-bold text-slate-900 mt-1">평가 시 유의사항</h1>
        <p className="text-sm text-slate-500 mt-1">시작 전 아래 원칙을 확인해주세요.</p>
      </div>

      <div className="flex-1 px-6 py-4 space-y-3">
        {PRINCIPLES.map((p) => (
          <div key={p.title} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-sm font-bold text-slate-900">{p.title}</p>
            <p className="text-xs text-slate-500 mt-1 leading-relaxed">{p.desc}</p>
          </div>
        ))}
      </div>

      <div className="p-5 bg-white border-t border-slate-100">
        <Link
          href="/login"
          className="block w-full text-center py-3.5 rounded-xl bg-blue-600 text-white font-semibold text-sm shadow-lg shadow-blue-600/30"
        >
          확인했습니다
        </Link>
      </div>
    </div>
  );
}
