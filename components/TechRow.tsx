"use client";

import Link from "next/link";
import { memo } from "react";
import ActButton from "@/components/ActButton";
import NascentFlag from "@/components/NascentFlag";
import { type Catalog, type CitedPage, type Classification, sourceWords, type Status, STATUS_LABELS, STATUS_STYLE,
  VERDICT_STYLE, VERDICT_WORDS, type View } from "@/lib/classification";
import { undo } from "@/lib/decisions";
import { formatAt, formatDay, plural, timeTitle } from "@/lib/format";
import { withFrom } from "@/lib/here";
import { rememberOpened } from "@/lib/paging";
import { type Scored, type TechState, thinScoring } from "@/lib/states";

export const LIST = "technologies"; // the list's name for keeping its place (lib/paging)
const HORIZON_ORDER = ["H1", "H2", "H3"];

export type Tech = {
  _id: string;
  name: string;
  enabled: boolean;
  aliases: string[];
  catalog: Catalog;
  imported?: { file: string } | null;
  state: TechState;
  status: Status;
  reason: string;
  notes: string[];
  classification: Classification;
  new_pages: number;
  measures: Scored | null;
  priorities: { fabric_id: string; fabric: string; priority: string | null; override?: boolean }[];
  pov: { scoring_run_id: string; composed_at: string; composed_tz: string | null } | null;
  switched_off_at?: string | null;
  switched_off_tz?: string | null;
  pages_since_off?: number;
  wake?: boolean;
  doc_count?: number;
  page_count?: number;
  source_count?: number;
  horizons?: Record<string, number>;
};

function OnSwitch({ on, label, onChange }: { on: boolean; label: string; onChange: (on: boolean) => void }) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={`${label}: ${on ? "switched on" : "switched off"}`}
      onClick={() => onChange(!on)}
      className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${on ? "bg-azure" : "bg-neutral-300"}`}>
      <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${on ? "translate-x-4" : "translate-x-0.5"}`} />
    </button>
  );
}

/** One row of the Technologies list. Drawn again only when its own row,
 *  tick or the page's columns change, not when another row does or a poll
 *  comes back. */
function TechRow({ t, name, picked, view, hood, here, cited, onToggle, onSwitch, onUndone, onNascent }: {
  t: Tech; name: string; picked: boolean; view: View | null; hood: boolean; here: string; cited?: CitedPage;
  onToggle: (id: string) => void; onSwitch: (t: Tech, on: boolean) => void; onUndone: (t: Tech) => void;
  onNascent: (name: string, done: string) => void;
}) {
  const c = t.classification;
  const undoMove = (decisionId: string | null | undefined) => decisionId ? (
    <> · <ActButton label="Undo" title="Go back to what the model judged" run={() => undo(decisionId)} onDone={() => onUndone(t)} /></>
  ) : null;
  return (
    <tbody data-row={t._id} className="border-t border-neutral-100 first-of-type:border-t-0">
                  <tr className={picked ? "bg-azure/5" : "hover:bg-neutral-50"}>
                    <td className="py-2.5 pl-5 align-top">
                      <input type="checkbox" aria-label={`Select ${name}`} checked={picked} onChange={() => onToggle(t._id)} />
                    </td>
                    <td className="px-3 py-2.5 align-top">
                      <Link href={withFrom(`/admin/technologies/${t._id}`, here)} onClick={() => rememberOpened(LIST, t._id)}
                        className={`font-medium hover:underline ${t.enabled ? "" : "text-neutral-400"}`}>{name}</Link>
                      {t.catalog.in && (
                        <span className="ml-1.5 whitespace-nowrap rounded bg-navy/[0.07] px-1 text-[10.5px] text-navy"
                          title={t.catalog.decision_id ? "Added to the catalog by a person" : t.imported?.file ? `From ${t.imported.file}` : undefined}>in catalog</span>
                      )}
                      {view !== "nascent" && c.nascent.flag && c.nascent.decision !== "no" && (
                        <span className="ml-1.5 rounded bg-amber-100 px-1 text-[10.5px] text-amber-900"
                          title={c.nascent.flag.reason}>{c.nascent.decision === "yes" ? "nascent" : "possibly nascent"}</span>
                      )}
                    </td>
                    <td className="max-w-[22rem] px-3 py-2.5 align-top">
                      <span className={`whitespace-nowrap rounded-full px-2 py-0.5 text-[11.5px] ${STATUS_STYLE[t.status]}`}>{STATUS_LABELS[t.status]}</span>
                      <span className="ml-1.5 text-[12.5px] text-neutral-700">
                        {t.status === "off" && t.switched_off_at ? `on ${formatAt(t.switched_off_at, t.switched_off_tz)}` : t.reason}</span>
                      {t.measures && t.measures.of > 0 && (t.status === "placed" || t.status === "held") && (
                        <span className={`block text-[11.5px] ${thinScoring(t.measures) ? "text-amber-800" : "text-muted"}`}>
                          {t.measures.scored} of {t.measures.of} measures scored{thinScoring(t.measures) && ", too few to rely on"}
                          {t.pov && <> · <Link href={withFrom(`/admin/scoring/pov/${t.pov.scoring_run_id}/${t._id}`, here)}
                            title={timeTitle("Written", t.pov.composed_at, t.pov.composed_tz)}
                            className="text-link hover:underline">Point of View {formatDay(t.pov.composed_at)}</Link></>}
                        </span>
                      )}
                      {t.notes.map((x) => <span key={x} className="block text-[11.5px] text-muted">{x}</span>)}
                      {t.wake && (
                        <Link href={withFrom(`/admin/technologies/${t._id}`, here)} className="block text-[11.5px] text-amber-800 hover:underline">
                          {plural(t.pages_since_off ?? 0, "new page")} since: have a look?
                        </Link>
                      )}
                    </td>
                    <td className="px-3 py-2.5 align-top text-[13px]">
                      {c.availability.name}
                      <span className="block text-[11px] text-muted">
                        {sourceWords(c.availability)}
                        {c.availability.source === "person" && !c.availability.imported && undoMove(c.availability.decision_id)}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5 align-top text-[13px]" title={c.trl.name ?? undefined}>
                      {c.trl.level ?? <span className="text-muted">—</span>}
                    </td>
                    <td className="px-3 py-2.5 align-top text-[13px]">
                      {c.domain.source === "none" ? <span className="text-muted">Not known yet</span> : c.domain.name}
                      {c.domain.subdomain && <span className="block text-[11.5px] text-muted">› {c.domain.subdomain}</span>}
                      {c.domain.source === "person" && (
                        <span className="block text-[11px] text-muted">
                          {sourceWords(c.domain)}{!c.domain.imported && undoMove(c.domain.decision_id)}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 align-top text-[13px]">
                      {c.evidence ? (
                        <>
                          <span className={`whitespace-nowrap rounded-full px-2 py-0.5 text-[11.5px] ${VERDICT_STYLE[c.evidence.verdict]}`}>
                            {VERDICT_WORDS[c.evidence.verdict]}</span>
                          <span className="block text-[11px] text-muted">{plural(c.evidence.of, "page")} · {plural(c.evidence.sources, "source")}</span>
                        </>
                      ) : <span className="text-muted">Not judged yet</span>}
                    </td>
                    {hood && (
                      <td className="px-3 py-2.5 text-right align-top font-mono text-xs tabular-nums text-neutral-500">
                        {t.page_count ?? 0} · {t.source_count ?? 0} · {HORIZON_ORDER.map((h) => t.horizons?.[h] ?? 0).join("·")}
                      </td>
                    )}
                    <td className="px-5 py-2.5 align-top">
                      <OnSwitch on={t.enabled} label={name} onChange={(on) => onSwitch(t, on)} />
                    </td>
                  </tr>
                  {view === "nascent" && c.nascent.flag && (
                    <tr className={picked ? "bg-azure/5" : ""}>
                      <td />
                      <td colSpan={hood ? 8 : 7} className="px-3 pb-3">
                        <NascentFlag techId={t._id} nascent={c.nascent} page={cited}
                          tracked={t.status === "placed" || t.status === "held"}
                          onChanged={(done) => onNascent(name, done)} />
                      </td>
                    </tr>
                  )}
                </tbody>
  );
}

// drawn again only when what it shows changes; its callbacks only set the page's state and reload
export default memo(TechRow, (a, b) => a.t === b.t && a.picked === b.picked && a.name === b.name && a.view === b.view
  && a.hood === b.hood && a.here === b.here && a.cited === b.cited);
