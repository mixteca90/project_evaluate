import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/lib/session";
import { getGroupById, getEvaluation, getMissingItemIds } from "@/lib/repo";
import { isClosed } from "@/lib/db";
import { submitEvaluationAction } from "@/app/actions";

export default async function CommentPage({
  params,
  searchParams,
}: {
  params: Promise<{ groupId: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { groupId: groupIdStr } = await params;
  const groupId = Number(groupIdStr);
  const { error } = await searchParams;
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role === "student" && session.groupId === groupId) redirect("/groups");

  const group = await getGroupById(groupId);
  if (!group) notFound();
  if (await isClosed()) redirect("/groups");

  const evaluation = await getEvaluation(session.userId, groupId);
  const missing = await getMissingItemIds(session.userId, groupId);
  const submitAction = submitEvaluationAction.bind(null, groupId);

  return (
    <div className="flex flex-col min-h-screen">
      <div className="pt-10 px-5 pb-3 bg-white border-b border-slate-100 flex items-center justify-between">
        <Link href={`/groups/${groupId}/score`} className="text-slate-400 text-lg">
          ←
        </Link>
        <p className="text-sm font-semibold text-slate-900">{group.name} · 의견 입력</p>
        <span className="w-5" />
      </div>

      <div className="flex-1 px-5 py-4 space-y-4">
        {(error || missing.length > 0) && (
          <p className="text-xs font-semibold text-red-600 bg-red-50 rounded-lg px-3 py-2">
            {error ?? `아직 선택하지 않은 세부항목이 ${missing.length}개 있습니다. 이전 화면에서 모두 선택해주세요.`}
          </p>
        )}

        <form action={submitAction} className="space-y-3">
          <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
            <p className="text-xs font-semibold text-slate-500 mb-2">감상 또는 의견 (선택 사항)</p>
            <textarea
              name="comment"
              defaultValue={evaluation?.comment ?? ""}
              rows={8}
              placeholder="이 조의 발표에 대한 감상이나 의견을 자유롭게 남겨주세요. 비워둔 채로도 제출할 수 있습니다."
              className="w-full text-sm rounded-xl border border-slate-200 p-3 outline-none focus:border-blue-500 resize-none"
            />
          </div>

          <button
            type="submit"
            className="w-full py-3.5 rounded-xl bg-blue-600 text-white font-semibold text-sm shadow-lg shadow-blue-600/30"
          >
            {evaluation?.submitted ? "재제출" : "제출"}
          </button>
        </form>
      </div>
    </div>
  );
}
