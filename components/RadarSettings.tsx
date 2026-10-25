"use client";

import { useEffect, useState } from "react";
import SavedNote from "@/components/SavedNote";
import { configChanged, errorText, fetchJson, sendJson } from "@/lib/api";
import { plural } from "@/lib/format";
import { usePipeline } from "@/lib/pipeline";

type Radar = {
  wake_after_pages: number; default_time_zone: string; evidence_floor: number; classify_after_collection: boolean;
  classify_pages_cap: number; emerging_availability: string[];
  find_evidence_results: number; find_evidence_daily_budget: number;
};

const field = "mt-1 block w-full rounded border border-neutral-300 bg-white px-3 py-1.5 text-sm outline-none focus:border-neutral-500";

/** The radar's own settings: judging each technology's evidence (the
 *  Classify step) and its limits, the pages a technology needs before it
 *  counts as ready, when a switched-off technology is flagged, Find
 *  evidence's limits, and the time zone used when a write didn't say one. */
export default function RadarSettings() {
  const p = usePipeline();
  const [form, setForm] = useState<Radar | null>(null);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [kept, setKept] = useState<string>(""); // the saved values, to say when the form has edits not saved yet
  useEffect(() => { fetchJson<Radar>("/api/settings/radar").then((r) => { setForm(r); setKept(JSON.stringify(r)); }).catch(() => {}); }, []);
  if (!form) return null;
  const dirty = JSON.stringify(form) !== kept;
  const num = (k: keyof Radar) => (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [k]: Number(e.target.value) });
  const row = (k: keyof Radar, label: string, note: string) => (
    <label className="block text-sm font-medium">
      {label}
      <input type="number" min={0} className={field} value={String(form[k])} onChange={num(k)} />
      <span className="mt-1 block text-xs font-normal text-neutral-500">
        {note}
      </span>
    </label>
  );
  return (
    <section className="mt-12 border-t border-neutral-200 pt-8">
      <h2 className="text-lg font-semibold">Judging technologies, finding evidence, time zone</h2>
      <p className="mt-1 text-sm text-neutral-600">How many pages judging reads for each technology, Find evidence&apos;s limits, and the time zone used by default.</p>
      <form className="mt-5 grid grid-cols-1 gap-x-10 gap-y-5 lg:grid-cols-2"
        onSubmit={async (e) => {
          e.preventDefault();
          setError(null);
          setSaved(false);
          try {
            const r = await sendJson<Radar>("/api/settings/radar", "PUT", form);
            setForm(r);
            setKept(JSON.stringify(r));
            setSaved(true);
            configChanged();
          } catch (err) {
            setError(errorText(err));
          }
        }}>
        <label className="block text-sm font-medium">
          Judge the evidence after each collection
          <span className="mt-1 flex items-center gap-2 text-sm font-normal">
            <input type="checkbox" checked={form.classify_after_collection}
              onChange={(e) => setForm({ ...form, classify_after_collection: e.target.checked })} />
            When a collection ends, each technology with new pages has its evidence judged (the Classify step): one
            model call each.
          </span>
          {p?.classify && (
            <span className="mt-1 block text-xs font-normal text-ink">
              {p.classify.pending > 0
                ? `Right now ${plural(p.classify.pending, "technology", "technologies")} wait to be judged: about ${plural(p.classify.pending, "model call")} at the end of the next collection, plus one for each technology it brings new pages for.`
                : "None wait to be judged now: the next collection costs one model call for each technology it brings new pages for."}
              {" "}Switched off, they wait for Classify on Operations.
            </span>
          )}
        </label>
        {row("classify_pages_cap", "Pages read per technology when judging", "Pages with findings first, then the newest. How many pages it has in all is still counted.")}
        {row("evidence_floor", "Pages needed before a technology counts as ready", "Until its evidence is judged, a technology is ready to assess once it has at least this many pages.")}
        {row("wake_after_pages", "Flag a switched-off technology after this many new pages", "It shows on the Briefing, under Before assessing, once this many new pages about it arrive.")}
        {row("find_evidence_results", "Find evidence: results per search", "How many web results one search reads.")}
        {row("find_evidence_daily_budget", "Find evidence: searches per day", "Counted in the default time zone. A search past it is refused, with the reason.")}
        <label className="block text-sm font-medium">
          Default time zone
          <input className={field} value={form.default_time_zone} onChange={(e) => setForm({ ...form, default_time_zone: e.target.value })} />
          <span className="mt-1 block text-xs font-normal text-neutral-500">Counts the Find evidence day, and stands in for a write that didn&apos;t record its zone. Each time on screen shows in the zone of the person who did the thing.</span>
        </label>
        <div className="lg:col-span-2">
          {error && <p className="text-sm text-failed">Not saved: {error}</p>}
          <SavedNote show={saved} />
          <button type="submit" className="rounded-full bg-navy px-4 py-2 text-sm font-medium text-white hover:bg-navy-strong">Save judging, evidence and time zone settings</button>
          {dirty && <span className="ml-3 text-sm text-amber-800">Edits here aren&apos;t saved yet</span>}
        </div>
      </form>
    </section>
  );
}
