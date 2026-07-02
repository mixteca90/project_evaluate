"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { ITEMS, LEVEL_LABELS, levelToScore, TOTAL_POINTS } from "@/lib/items";
import { saveItemLevelAction } from "@/app/actions";

interface Props {
  groupId: number;
  groupName: string;
  leader: string;
  members: string[];
  topic: string;
  selfReportCompleted: string;
  selfReportPlan: string;
  selfReportAi: string;
  initialLevels: Record<string, number>;
  readOnly: boolean;
}

const GROUP_ORDER = ["①", "②", "③", "④", "⑤"] as const;

export default function ScoreForm(props: Props) {
  const { groupId, groupName, leader, members, topic, selfReportCompleted, selfReportPlan, selfReportAi, initialLevels, readOnly } = props;
  const [levels, setLevels] = useState<Record<string, number>>(initialLevels);
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const total = useMemo(
    () => ITEMS.reduce((sum, it) => sum + (levels[it.id] !== undefined ? levelToScore(levels[it.id], it.points) : 0), 0),
    [levels]
  );
  const answeredCount = ITEMS.filter((it) => levels[it.id] !== undefined).length;

  function selectLevel(itemId: string, level: number) {
    if (readOnly) return;
    setLevels((prev) => ({ ...prev, [itemId]: level }));
    setSaving(itemId);
    setError(null);
    startTransition(async () => {
      const res = await saveItemLevelAction(groupId, itemId, level);
      setSaving(null);
      if (!res.ok) setError(res.error ?? "저장 실패");
    });
  }

  return (
    <div className="flex flex-col min-h-screen">
      <div className="pt-10 px-5 pb-3 bg-white border-b border-slate-100 flex items-center justify-between">
        <Link href="/groups" className="text-slate-400 text-lg">
          ←
        </Link>
        <p className="text-sm font-semibold text-slate-900">
          {groupName}
          {readOnly && " (확정)"}
        </p>
        <span className="w-5" />
      </div>

      <div className="flex-1 px-5 py-4 space-y-4 overflow-y-auto">
        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
          <p className="text-xs text-slate-400">
            조장 · {leader} / 조원 · {members.join(", ")}
          </p>
          <p className="text-sm font-semibold text-slate-800 mt-1.5">{topic}</p>
          <div className="mt-3 space-y-1.5 text-xs text-slate-600">
            <p>
              <span className="font-semibold text-emerald-700">완료범위</span> {selfReportCompleted}
            </p>
            <p>
              <span className="font-semibold text-amber-700">향후계획</span> {selfReportPlan}
            </p>
            <p>
              <span className="font-semibold text-blue-700">AI협업범위</span> {selfReportAi}
            </p>
          </div>
        </div>

        {error && <p className="text-xs font-semibold text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}

        {GROUP_ORDER.map((groupKey) => {
          const itemsInGroup = ITEMS.filter((it) => it.group === groupKey);
          return (
            <div key={groupKey} className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
              <p className="text-xs font-bold text-blue-600 mb-3">
                {groupKey} {itemsInGroup[0].groupName}
              </p>
              {itemsInGroup.map((item, idx) => {
                const level = levels[item.id];
                return (
                  <div key={item.id} className={idx < itemsInGroup.length - 1 ? "mb-4" : ""}>
                    <div className="flex justify-between items-baseline mb-1.5">
                      <p className="text-[13px] text-slate-700">{item.name}</p>
                      <span className="text-[11px] text-slate-400">
                        {item.points}점{saving === item.id ? " · 저장 중" : ""}
                      </span>
                    </div>
                    <div className="grid grid-cols-6 gap-1">
                      {[0, 1, 2, 3, 4, 5].map((lv) => {
                        const selected = level === lv;
                        return (
                          <button
                            key={lv}
                            type="button"
                            disabled={readOnly}
                            title={LEVEL_LABELS[lv]}
                            onClick={() => selectLevel(item.id, lv)}
                            className={`py-2 rounded-lg border text-[10px] font-bold ${
                              selected
                                ? "border-blue-600 bg-blue-600 text-white"
                                : "border-slate-200 text-slate-400 bg-white"
                            } ${readOnly ? "opacity-60" : ""}`}
                          >
                            {levelToScore(lv, item.points)}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>

      <div className="p-4 bg-white border-t border-slate-100 flex items-center justify-between gap-3">
        <div>
          <p className="text-[10px] text-slate-400">
            현재까지 합계 ({answeredCount}/{ITEMS.length})
          </p>
          <p className="text-base font-bold text-slate-900">
            {total}
            <span className="text-xs text-slate-400 font-normal"> / {TOTAL_POINTS}</span>
          </p>
        </div>
        {readOnly ? (
          <span className="flex-1 text-center py-3.5 rounded-xl bg-slate-100 text-slate-400 font-semibold text-sm">
            마감됨
          </span>
        ) : (
          <Link
            href={`/groups/${groupId}/comment`}
            className="flex-1 py-3.5 rounded-xl bg-blue-600 text-white font-semibold text-sm shadow-lg shadow-blue-600/30 text-center"
          >
            다음(의견 입력)
          </Link>
        )}
      </div>
    </div>
  );
}
