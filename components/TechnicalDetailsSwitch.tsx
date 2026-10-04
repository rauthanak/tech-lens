"use client";

import { setHood, useHood } from "@/lib/hood";

/** Shows technical detail (agents, sub-stages, model calls). Sits in the
 *  header of the four pages that have it; the choice is remembered in this
 *  browser. */
export default function TechnicalDetailsSwitch() {
  const on = useHood();
  return (
    <label className="flex shrink-0 cursor-pointer items-center gap-2 text-sm text-muted print:hidden"
      title="Show technical detail: agents, sub-stages, model calls">
      <button type="button" role="switch" aria-checked={on} onClick={() => setHood(!on)}
        className={`relative h-4 w-7 rounded-full transition-colors ${on ? "bg-azure" : "bg-neutral-300"}`}>
        <span className={`absolute top-0.5 h-3 w-3 rounded-full bg-white transition-all ${on ? "left-3.5" : "left-0.5"}`} />
      </button>
      Technical details
    </label>
  );
}
