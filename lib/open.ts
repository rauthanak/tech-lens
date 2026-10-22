import { andList, plural } from "@/lib/format";
import { FINANCE_SHOWN } from "@/lib/value";

/** What's still open for a technology in one fabric (the summary's `open`,
 *  services/gates.fabric_open). */
export type FabricOpen = {
  fabric_id: string;
  fabric: string;
  priority: string | null;
  unscored: number;
  blocking: boolean;
  waiting_for_tata: number;
  override_moved: boolean;
  suggested_use_cases: string[];
  finance_missing: string[];
  step: string | null;
  next_step: { name: string; in_hand: boolean; missing: { label: string; where: string }[] } | null;
  blockers: boolean;
  owner: boolean;
  resources: boolean; // people, budget or a trial recorded
  leader: "undefined" | "defined" | "aligned" | "integrated"; // the owner's record's state
};

/** One thing to do, and the part of the fabric tab it's done in (its anchor). */
export type OpenItem = { label: string; anchor: string };

/** What needs a person before the Point of View goes to leaders (the Before
 *  publishing list, Gate 2): the fabric tab's badge counts these. */
export function beforePublishing(o: FabricOpen): OpenItem[] {
  return [
    o.unscored > 0 && { label: `${plural(o.unscored, "measure")} the pages couldn't score${o.blocking ? ", so it has no priority" : ""}`,
      anchor: "measures" },
    o.waiting_for_tata > 0 && { label: `${plural(o.waiting_for_tata, "figure")} for you to enter`, anchor: "measures" },
    o.override_moved && { label: "Your priority override: the computed priority has moved since", anchor: "priority" },
    o.suggested_use_cases.length > 0 && {
      label: `${plural(o.suggested_use_cases.length, "suggested use case")} to accept or reject`, anchor: "use-cases" },
    o.finance_missing.length > 0 && { label: `Finance: ${andList(o.finance_missing)}`, anchor: "finance" },
  ].filter((x): x is OpenItem => !!x);
}

/** How many things need a person before publishing: each measure, each
 *  suggested use case, the override and the finance card count one. */
export const toSettle = (o: FabricOpen) => o.unscored + o.waiting_for_tata + o.suggested_use_cases.length
  + (o.override_moved ? 1 : 0) + (o.finance_missing.length > 0 ? 1 : 0);

/** What the owner's record still lacks (how far Tata has got, the blockers,
 *  an owner) and what the next step needs: not needed to publish. */
export function notRecorded(o: FabricOpen): OpenItem[] {
  const next = o.next_step && !o.next_step.in_hand && o.next_step.missing.length > 0 ? o.next_step : null;
  return [
    !o.step && { label: "How far Tata has got", anchor: "path" },
    next && { label: `For ${next.name}: ${andList(next.missing.map((m) => m.label))}`,
      anchor: FINANCE_SHOWN && next.missing.every((m) => m.where === "finance") ? "finance" : "path" },
    !o.blockers && { label: "What could stop it scaling", anchor: "blockers" },
    !o.owner && { label: "Owner and next action", anchor: "owner" },
  ].filter((x): x is OpenItem => !!x);
}
