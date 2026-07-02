import { redirect } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/lib/session";
import { getGroups, computeProvisionalResult, checkCompleteness, getAllFinalResults } from "@/lib/repo";
import { formatScore } from "@/lib/scoring";
import { isClosed } from "@/lib/db";

export default async function ResultsPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const closed = isClosed();
  const groups = getGroups();

  type Row = { groupId: number; name: string; topic: string; totalScore: number | "PENDING_INSTRUCTOR"; rank: number | null; progress: string };
  let rows: Row[];

  if (closed) {
    const finals = getAllFinalResults();
    rows = finals.map((f) => {
      const g = groups.find((gg) => gg.id === f.group_id)!;
      const c = checkCompleteness(f.group_id);
      return {
        groupId: f.group_id,
        name: g.name,
        topic: g.topic,
        totalScore: f.total_score,
        rank: f.rank,
        progress: `${c.submittedComplete}/${c.expected}명 완료`,
      };
    });
  } else {
    const computed = groups.map((g) => {
      const result = computeProvisionalResult(g.id);
      const c = checkCompleteness(g.id);
      return {
        groupId: g.id,
        name: g.name,
        topic: g.topic,
        totalScore: result.totalScore,
        progress: `${c.submittedComplete}/${c.expected}명 완료`,
      };
    });
    const ranked = [...computed]
      .filter((r) => typeof r.totalScore === "number")
      .sort((a, b) => (b.totalScore as number) - (a.totalScore as number));
    const pending = computed.filter((r) => r.totalScore === "PENDING_INSTRUCTOR");

    let prevScore: number | null = null;
    let prevRank = 0;
    rows = [
      ...ranked.map((r, idx) => {
        const score = r.totalScore as number;
        let rank: number;
        if (prevScore !== null && score === prevScore) {
          rank = prevRank;
        } else {
          rank = idx + 1;
          prevRank = rank;
          prevScore = score;
        }
        return { ...r, rank };
      }),
      ...pending.map((r) => ({ ...r, rank: null })),
    ];
  }

  return (
    <div className="flex flex-col min-h-screen">
      <div className="pt-10 px-5 pb-4 bg-white border-b border-slate-100">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-900">전체 결과</h2>
          <span
            className={`text-[11px] px-2.5 py-1 rounded-full font-semibold ${
              closed ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
            }`}
          >
            {closed ? "확정 결과" : "잠정 결과"}
          </span>
        </div>
        <p className="text-xs text-slate-400 mt-1">
          {closed ? "마감 처리 완료 · 더 이상 변동 없음" : "조회 시점 기준 계산값 · 마감 후 확정"}
        </p>
      </div>

      <div className="flex-1 px-5 py-4 space-y-3">
        {rows.map((r) => (
          <Link
            key={r.groupId}
            href={`/results/${r.groupId}`}
            className={`rounded-2xl border p-4 flex items-center gap-3 shadow-sm ${
              r.rank === 1 ? "border-2 border-blue-600 bg-blue-50" : "border-slate-200 bg-white"
            }`}
          >
            <div
              className={`w-9 h-9 rounded-full text-sm font-bold flex items-center justify-center ${
                r.rank === 1 ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-500"
              }`}
            >
              {r.rank ?? "-"}
            </div>
            <div className="flex-1">
              <p className="text-sm font-bold text-slate-900">{r.name}</p>
              <p className="text-[11px] text-slate-500 mt-0.5">{r.progress}</p>
            </div>
            <p className={`text-xl font-extrabold ${r.rank === 1 ? "text-blue-700" : "text-slate-700"}`}>
              {formatScore(r.totalScore)}
            </p>
          </Link>
        ))}
        <p className="text-center text-[11px] text-slate-400 pt-2">조를 선택하면 세부항목 점수와 익명 의견을 볼 수 있어요 →</p>
      </div>

      <div className="p-3 bg-white border-t border-slate-100 flex justify-around">
        <Link href="/groups" className="flex flex-col items-center gap-0.5 text-slate-400">
          <span className="text-lg">📋</span>
          <span className="text-[10px] font-semibold">평가하기</span>
        </Link>
        <span className="flex flex-col items-center gap-0.5 text-blue-600">
          <span className="text-lg">🏆</span>
          <span className="text-[10px] font-semibold">결과</span>
        </span>
        {session.role === "instructor" && (
          <Link href="/admin" className="flex flex-col items-center gap-0.5 text-slate-400">
            <span className="text-lg">🛠️</span>
            <span className="text-[10px] font-semibold">관리</span>
          </Link>
        )}
      </div>
    </div>
  );
}
