import { redirect } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/lib/session";
import { getGroups, getMatrix, computeProvisionalResult, checkCompleteness } from "@/lib/repo";
import { formatScore } from "@/lib/scoring";
import { isClosed } from "@/lib/db";
import { closeEvaluationAction } from "@/app/actions";

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ closeError?: string }>;
}) {
  const { closeError } = await searchParams;
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role !== "instructor") redirect("/groups");

  const closed = isClosed();
  const groups = getGroups();

  const groupData = groups.map((g) => {
    const matrix = getMatrix(g.id);
    const result = computeProvisionalResult(g.id);
    const completeness = checkCompleteness(g.id);
    const trimmedSet = new Set(result.trimmedEvaluatorIds);
    return { group: g, matrix, result, completeness, trimmedSet };
  });

  const allComplete = groupData.every((gd) => gd.completeness.missingEvaluators.length === 0);

  return (
    <div className="flex flex-col min-h-screen">
      <div className="pt-10 px-5 pb-3 bg-white border-b border-slate-100 flex items-center justify-between">
        <Link href="/groups" className="text-slate-400 text-lg">
          ←
        </Link>
        <p className="text-sm font-semibold text-slate-900">강사 전용 관리</p>
        <span
          className={`text-[11px] px-2 py-1 rounded-full font-semibold ${
            closed ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
          }`}
        >
          {closed ? "확정" : "잠정"}
        </span>
      </div>

      <div className="flex-1 px-5 py-4 space-y-5 overflow-y-auto">
        {closeError && (
          <p className="text-xs font-semibold text-red-600 bg-red-50 rounded-lg px-3 py-2">{closeError}</p>
        )}

        {groupData.map(({ group, matrix, result, completeness, trimmedSet }) => (
          <div key={group.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-bold text-slate-900">
                {group.id}조 · {group.name}
              </p>
              <span
                className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                  completeness.missingEvaluators.length === 0
                    ? "bg-emerald-50 text-emerald-700"
                    : "bg-amber-50 text-amber-700"
                }`}
              >
                {completeness.submittedComplete}/{completeness.expected}명 완료
              </span>
            </div>

            {result.tieBreakApplied && (
              <p className="text-[11px] text-blue-600 mb-2">※ 절사 경계 동점 발생 — 평가자 ID 오름차순 보조 기준 적용됨</p>
            )}

            <table className="w-full text-[12px]">
              <thead>
                <tr className="text-slate-400 text-left border-b border-slate-100">
                  <th className="py-1 font-medium">평가자</th>
                  <th className="py-1 font-medium text-right">총점</th>
                  <th className="py-1 font-medium text-right">제출</th>
                  <th className="py-1 font-medium text-right">절사</th>
                </tr>
              </thead>
              <tbody>
                {matrix.map((m) => (
                  <tr key={m.evaluatorId} className="border-b border-slate-50 last:border-0">
                    <td className="py-1.5 text-slate-700">
                      {m.name} {m.role === "instructor" && <span className="text-blue-600">(강사×3)</span>}
                    </td>
                    <td className="py-1.5 text-right font-semibold text-slate-800">{m.total}</td>
                    <td className="py-1.5 text-right">{m.submitted ? "✅" : "—"}</td>
                    <td className="py-1.5 text-right">{trimmedSet.has(m.evaluatorId) ? "🔻절사" : ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <p className="text-sm font-bold text-slate-900 mt-2 text-right">총점 {formatScore(result.totalScore)}</p>

            {completeness.missingEvaluators.length > 0 && (
              <div className="mt-2 bg-amber-50 rounded-lg p-2">
                <p className="text-[11px] font-semibold text-amber-700 mb-1">미완료 평가자</p>
                {completeness.missingEvaluators.map((e) => (
                  <p key={e.id} className="text-[11px] text-amber-700">
                    · {e.name} ({e.reason})
                  </p>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="p-4 bg-white border-t border-slate-100">
        {closed ? (
          <p className="text-center text-sm font-semibold text-emerald-700">✅ 평가가 마감 처리되었습니다.</p>
        ) : (
          <form action={closeEvaluationAction}>
            <button
              type="submit"
              disabled={!allComplete}
              className={`w-full py-3.5 rounded-xl font-semibold text-sm shadow-lg ${
                allComplete
                  ? "bg-blue-600 text-white shadow-blue-600/30"
                  : "bg-slate-200 text-slate-400 shadow-none cursor-not-allowed"
              }`}
            >
              {allComplete ? "평가 마감 처리" : "전원 제출 후 마감 가능"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
