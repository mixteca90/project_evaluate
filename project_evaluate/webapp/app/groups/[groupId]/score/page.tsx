import { redirect, notFound } from "next/navigation";
import { getSession } from "@/lib/session";
import { getGroupById, getEvaluation } from "@/lib/repo";
import { isClosed } from "@/lib/db";
import ScoreForm from "./ScoreForm";

export default async function ScorePage({ params }: { params: Promise<{ groupId: string }> }) {
  const { groupId: groupIdStr } = await params;
  const groupId = Number(groupIdStr);
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role === "student" && session.groupId === groupId) redirect("/groups");

  const group = getGroupById(groupId);
  if (!group) notFound();

  const evaluation = getEvaluation(session.userId, groupId);
  const closed = isClosed();
  if (closed && !evaluation?.submitted) redirect("/groups");

  let initialLevels: Record<string, number> = {};
  try {
    initialLevels = evaluation ? JSON.parse(evaluation.item_scores) : {};
  } catch {
    initialLevels = {};
  }

  const members: string[] = JSON.parse(group.members);

  return (
    <ScoreForm
      groupId={groupId}
      groupName={group.name}
      leader={group.leader}
      members={members}
      topic={group.topic}
      selfReportCompleted={group.self_report_completed}
      selfReportPlan={group.self_report_plan}
      selfReportAi={group.self_report_ai}
      initialLevels={initialLevels}
      readOnly={closed}
    />
  );
}
