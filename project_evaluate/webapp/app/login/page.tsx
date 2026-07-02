import { listStudentsByGroup } from "@/lib/session";
import { getGroups } from "@/lib/repo";
import { loginAsInstructorAction, loginAsStudentAction } from "@/app/actions";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; instructor?: string }>;
}) {
  const { error, instructor } = await searchParams;
  const groups = getGroups();
  const studentsByGroup = listStudentsByGroup();

  return (
    <div className="flex flex-col min-h-screen">
      <div className="pt-10 px-6 pb-4 bg-white border-b border-slate-100">
        <p className="text-xs text-slate-400 font-medium">조별 프로젝트 평가</p>
        <h2 className="text-lg font-bold text-slate-900 mt-0.5">본인 이름을 선택해주세요</h2>
        {error && (
          <p className="mt-2 text-xs font-semibold text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
        )}
      </div>

      <div className="flex-1 px-5 py-4 space-y-5 overflow-y-auto">
        {groups.map((g) => (
          <div key={g.id}>
            <p className="text-xs font-semibold text-slate-400 mb-2 px-1">
              {g.id}조 · {g.name}
            </p>
            <div className="grid grid-cols-2 gap-2">
              {(studentsByGroup.get(g.id) ?? []).map((s) => (
                <form key={s.id} action={loginAsStudentAction}>
                  <input type="hidden" name="name" value={s.name} />
                  <button
                    type="submit"
                    className="w-full px-3 py-3 rounded-xl border border-slate-200 bg-white text-sm text-slate-700 text-left shadow-sm active:bg-slate-100"
                  >
                    {s.name}
                  </button>
                </form>
              ))}
            </div>
          </div>
        ))}

        <div className="flex items-center gap-3 py-1">
          <div className="h-px flex-1 bg-slate-200" />
          <span className="text-xs text-slate-400">또는</span>
          <div className="h-px flex-1 bg-slate-200" />
        </div>

        <form action={loginAsInstructorAction} className="space-y-2">
          <p className="text-xs font-semibold text-slate-500 px-1">강사(이정현)로 입장</p>
          <input
            type="password"
            name="password"
            placeholder="비밀번호 입력"
            autoFocus={instructor === "1"}
            className="w-full px-4 py-3 rounded-xl border border-slate-300 bg-white text-sm outline-none focus:border-blue-500"
          />
          <button
            type="submit"
            className="w-full px-4 py-3 rounded-xl border border-slate-300 bg-white text-sm font-semibold text-slate-600 flex items-center justify-center gap-2"
          >
            🔒 강사로 입장
          </button>
        </form>
      </div>
    </div>
  );
}
