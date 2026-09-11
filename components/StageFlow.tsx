"use client";

import { duration } from "@/lib/format";

type HistoryEntry = { stage: string; at: string };

type BoxState = "done" | "active" | "failed" | "pending";

const BOX_STYLE: Record<BoxState, string> = {
  done: "border border-neutral-300 bg-white",
  active: "border border-transparent bg-[#8a4b2d]/5 text-[#7a3c1e]",
  failed: "border border-red-300 bg-red-50",
  pending: "border border-dashed border-neutral-200 bg-neutral-50 text-neutral-400",
};

/**
 * Vertical process-flow ladder for a run: one box per canonical stage,
 * marching-ants border on the executing stage, green check on completed ones.
 */
export default function StageFlow({
  stages,
  history,
  status,
  endTime,
}: {
  stages: string[];
  history: HistoryEntry[];
  status: string;
  endTime?: string | null;
}) {
  const canonical = new Set(stages);
  const inFlow = history.filter((h) => canonical.has(h.stage));

  // last occurrence of each stage (a resume re-enters "scoring")
  const startOf = new Map<string, string>();
  const endOf = new Map<string, string>();
  inFlow.forEach((h, i) => {
    startOf.set(h.stage, h.at);
    const next = inFlow[i + 1];
    if (next) endOf.set(h.stage, next.at);
  });

  const currentIdx = inFlow.length
    ? stages.indexOf(inFlow[inFlow.length - 1].stage)
    : -1;
  const live = status === "running" || status === "terminating";
  const stopped = status === "failed" || status === "terminated";

  function stateFor(i: number): BoxState {
    if (status === "completed") return "done";
    if (i < currentIdx) return "done";
    if (i === currentIdx) return live ? "active" : stopped ? "failed" : "done";
    return "pending";
  }

  function subFor(i: number, state: BoxState): string {
    if (state === "active") return "in progress";
    if (state === "failed") return status === "terminated" ? "stopped here" : "failed here";
    if (state === "pending") return "";
    const start = startOf.get(stages[i]);
    if (!start) return "";
    const end = endOf.get(stages[i]) ?? endTime ?? undefined;
    return end ? duration(start, end) : "";
  }

  return (
    <div className="flex flex-col">
      {stages.map((stage, i) => {
        const state = stateFor(i);
        const sub = subFor(i, state);
        return (
          <div key={stage} className="flex flex-col items-center">
            {i > 0 && (
              <span
                className={`h-4 w-px ${state === "pending" ? "bg-neutral-200" : "bg-neutral-300"}`}
              />
            )}
            <div className={`relative w-full px-4 py-2.5 text-center ${BOX_STYLE[state]}`}>
              {state === "active" && (
                <span aria-hidden className="stage-ants pointer-events-none absolute -inset-px" />
              )}
              {state === "done" && (
                <span className="absolute -right-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-emerald-600 text-[9px] font-bold text-white">
                  ✓
                </span>
              )}
              {state === "failed" && (
                <span className="absolute -right-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-600 text-[9px] font-bold text-white">
                  ✕
                </span>
              )}
              <div className="font-mono text-[11px] uppercase tracking-wider">{stage}</div>
              {sub && (
                <div
                  className={`mt-0.5 font-mono text-[10px] ${state === "active" ? "text-[#8a4b2d]" : "text-neutral-400"}`}
                >
                  {sub}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
