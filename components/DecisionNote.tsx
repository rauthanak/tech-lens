"use client";

import ActButton from "@/components/ActButton";
import { type Decision, undo } from "@/lib/decisions";
import { formatAt } from "@/lib/format";

/** "Set by a person on Oct 21, 9:40 AM CDT: <reason> · Undo". */
export default function DecisionNote({ what, decision, onUndone }: {
  what: string;
  decision: Pick<Decision, "_id" | "at" | "tz" | "reason">;
  onUndone: () => void;
}) {
  return (
    <p className="text-[12.5px] text-muted">
      {what} by a person on {formatAt(decision.at, decision.tz)}
      {decision.reason && <>: <span className="text-ink">{decision.reason}</span></>}
      {" · "}
      <ActButton label="Undo" run={() => undo(decision._id)} onDone={onUndone} />
    </p>
  );
}
