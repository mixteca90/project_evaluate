import { redirect } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/lib/session";
import { getGroups, getEvaluation } from "@/lib/repo";
import { isClosed } from "@/lib/db";
import { logoutAction } from "@/app/actions";

export default async function GroupsPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const closed = isClosed();
  const allGroups = getGroups();
  const targets = allGroups.filter((g) => !(session!.role === "student" && g.id === session!.groupId));

  return (
    <div className="flex flex-col min-h-screen">
      <div className="pt-10 px-5 pb-3 bg-white border-b border-slate-100 flex items-center justify-between">
        <div>
          <p className="text-xs text-slate-400">
            {session.role === "instructor" ? "강사" : "수강생"} · {session.name}님
          </p>
          <h2 className="text-lg font-bold text-slate-900">평가 대상 조</h2>
        </div>
        <form action={logoutAction}>
          <button type="submit" className="text-xs text-slate-400 underline">
            나가기
          </button>
        </form>
      </div>

      <div className="flex-1 px-5 py-4 space-y-3">
        {targets.map((g) => {
          const ev = getEvaluation(session.userId, g.id);
          const submitted = !!ev?.submitted;
          const badge = closed
            ? submitted
              ? { text: "🔒 제출완료·수정불가", cls: "bg-slate-100 text-slate-500" }
              : { text: "⚠️ 미제출", cls: "bg-red-50 text-red-600" }
            : submitted
              ? { text: "✅ 제출완료·수정가능", cls: "bg-emerald-50 text-emerald-700" }
              : { text: "⏳ 미완료", cls: "bg-amber-50 text-amber-700" };

          return (
            <Link
              key={g.id}
              href={closed && !submitted ? "#" : `/groups/${g.id}/score`}
              className="block rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
            >
              <div className="flex items-center justify-between">
                <p className="text-sm font-bold text-slate-900">
                  {g.id}조 · {g.name}
                </p>
                <span className={`text-[11px] px-2 py-1 rounded-full font-semibold ${badge.cls}`}>{badge.text}</span>
              </div>
              <p className="text-xs text-slate-500 mt-1">{g.topic}</p>
            </Link>
          );
        })}
      </div>

      <div className="p-3 bg-white border-t border-slate-100 flex justify-around">
        <span className="flex flex-col items-center gap-0.5 text-blue-600">
          <span className="text-lg">📋</span>
          <span className="text-[10px] font-semibold">평가하기</span>
        </span>
        <Link href="/results" className="flex flex-col items-center gap-0.5 text-slate-400">
          <span className="text-lg">🏆</span>
          <span className="text-[10px] font-semibold">결과</span>
        </Link>
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
