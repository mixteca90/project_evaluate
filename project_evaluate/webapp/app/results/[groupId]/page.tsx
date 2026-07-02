import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/lib/session";
import { getGroupById, computeProvisionalResult, getFinalResult, getComments } from "@/lib/repo";
import { formatScore } from "@/lib/scoring";
import { ITEMS } from "@/lib/items";
import { isClosed } from "@/lib/db";

const GROUP_ORDER = ["①", "②", "③", "④", "⑤"] as const;

export default async function ResultDetailPage({ params }: { params: Promise<{ groupId: string }> }) {
  const { groupId: groupIdStr } = await params;
  const groupId = Number(groupIdStr);
  const session = await getSession();
  if (!session) redirect("/login");

  const group = await getGroupById(groupId);
  if (!group) notFound();

  const closed = await isClosed();
  let perItemScore: number[] | "PENDING_INSTRUCTOR";
  let totalScore: number | "PENDING_INSTRUCTOR";

  if (closed) {
    const final = await getFinalResult(groupId);
    perItemScore = final ? JSON.parse(final.per_item_final_score) : "PENDING_INSTRUCTOR";
    totalScore = final ? final.total_score : "PENDING_INSTRUCTOR";
  } else {
    const provisional = await computeProvisionalResult(groupId);
    perItemScore = provisional.perItemScore;
    totalScore = provisional.totalScore;
  }

  const comments = await getComments(groupId);

  return (
    <div className="flex flex-col min-h-screen">
      <div className="pt-10 px-5 pb-3 bg-white border-b border-slate-100 flex items-center justify-between">
        <Link href="/results" className="text-slate-400 text-lg">
          ←
        </Link>
        <p className="text-sm font-semibold text-slate-900">{group.name}</p>
        <span className="w-5" />
      </div>

      <div className="flex-1 px-5 py-4 space-y-4 overflow-y-auto">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm flex items-center justify-between">
          <div>
            <span
              className={`text-[11px] px-2 py-1 rounded-full font-semibold ${
                closed ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
              }`}
            >
              {closed ? "확정 결과" : "잠정 결과"}
            </span>
            <p className="text-xs text-slate-400 mt-1.5">{group.topic}</p>
          </div>
          <p className="text-2xl font-extrabold text-slate-900">{formatScore(totalScore)}</p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-bold text-slate-500 mb-3">세부항목별 최종 점수</p>
          {perItemScore === "PENDING_INSTRUCTOR" ? (
            <p className="text-sm text-slate-400 py-4 text-center">강사 평가 대기 중</p>
          ) : (
            GROUP_ORDER.map((groupKey) => {
              const itemsInGroup = ITEMS.filter((it) => it.group === groupKey);
              return (
                <div key={groupKey} className="mb-3 last:mb-0">
                  <p className="text-[11px] font-bold text-blue-600 mb-1">
                    {groupKey} {itemsInGroup[0].groupName}
                  </p>
                  {itemsInGroup.map((item) => {
                    const idx = ITEMS.findIndex((it) => it.id === item.id);
                    const score = (perItemScore as number[])[idx];
                    return (
                      <div key={item.id} className="flex justify-between text-[13px] py-1 border-b border-slate-50 last:border-0">
                        <span className="text-slate-600">{item.name}</span>
                        <span className="font-semibold text-slate-800">
                          {formatScore(score)} <span className="text-slate-400 font-normal">/ {item.points}</span>
                        </span>
                      </div>
                    );
                  })}
                </div>
              );
            })
          )}
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-bold text-slate-500 mb-3">평가자 의견 ({comments.length}건, 익명)</p>
          {comments.length === 0 ? (
            <p className="text-sm text-slate-400 py-2">아직 제출된 의견이 없습니다.</p>
          ) : (
            <div className="space-y-2">
              {comments.map((c) => (
                <div key={c.anonLabel} className="bg-slate-50 rounded-xl p-3">
                  <p className="text-[11px] font-semibold text-slate-400 mb-1">평가자 {c.anonLabel}</p>
                  <p className="text-sm text-slate-700 whitespace-pre-wrap">{c.comment || "(의견 없음)"}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
