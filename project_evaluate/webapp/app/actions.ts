"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import {
  clearSession,
  findInstructor,
  findUserByName,
  getSession,
  setSession,
} from "@/lib/session";
import { upsertItemLevel, submitEvaluation, finalizeAllGroups, getGroupById } from "@/lib/repo";
import { isClosed } from "@/lib/db";

export async function loginAsStudentAction(formData: FormData): Promise<void> {
  const name = String(formData.get("name") ?? "").trim();
  const user = findUserByName(name);
  if (!user) {
    redirect(`/login?error=${encodeURIComponent("명단에서 이름을 찾을 수 없습니다.")}`);
  }
  await setSession({ userId: user.id, name: user.name, role: "student", groupId: user.group_id });
  redirect("/groups");
}

export async function loginAsInstructorAction(formData: FormData): Promise<void> {
  const password = String(formData.get("password") ?? "");
  if (!password || password !== process.env.INSTRUCTOR_PASSWORD) {
    redirect(`/login?error=${encodeURIComponent("비밀번호가 일치하지 않습니다.")}&instructor=1`);
  }
  const instructor = findInstructor();
  if (!instructor) {
    redirect(`/login?error=${encodeURIComponent("강사 계정을 찾을 수 없습니다.")}`);
  }
  await setSession({
    userId: instructor.id,
    name: instructor.name,
    role: "instructor",
    groupId: null,
  });
  redirect("/groups");
}

export async function logoutAction(): Promise<void> {
  await clearSession();
  redirect("/login");
}

export async function saveItemLevelAction(groupId: number, itemId: string, level: number): Promise<{ ok: boolean; error?: string }> {
  const session = await getSession();
  if (!session) return { ok: false, error: "로그인이 필요합니다." };
  if (isClosed()) return { ok: false, error: "평가가 마감되었습니다." };
  if (session.role === "student" && session.groupId === groupId) {
    return { ok: false, error: "본인 소속 조는 평가할 수 없습니다." };
  }
  const group = getGroupById(groupId);
  if (!group) return { ok: false, error: "존재하지 않는 조입니다." };
  try {
    upsertItemLevel(session.userId, groupId, itemId, level);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "저장 실패" };
  }
}

export async function submitEvaluationAction(groupId: number, formData: FormData): Promise<void> {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session!.role === "student" && session!.groupId === groupId) {
    redirect(`/groups?error=${encodeURIComponent("본인 소속 조는 평가할 수 없습니다.")}`);
  }
  const comment = String(formData.get("comment") ?? "");
  try {
    submitEvaluation(session!.userId, groupId, comment);
  } catch (e) {
    redirect(
      `/groups/${groupId}/comment?error=${encodeURIComponent(e instanceof Error ? e.message : "제출 실패")}`
    );
  }
  revalidatePath("/groups");
  revalidatePath("/results");
  redirect("/groups");
}

export async function closeEvaluationAction(): Promise<void> {
  const session = await getSession();
  if (!session || session.role !== "instructor") redirect("/login");
  const result = finalizeAllGroups();
  revalidatePath("/results");
  revalidatePath("/admin");
  if (!result.ok) {
    redirect(`/admin?closeError=${encodeURIComponent("완결성 검증에 실패한 조가 있어 마감을 취소했습니다. 아래 명단을 확인해주세요.")}`);
  }
  redirect("/admin");
}
