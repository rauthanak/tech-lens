"use client";

import { useCallback, useEffect, useState } from "react";
import BackendError from "@/components/BackendError";
import PageHeader from "@/components/PageHeader";
import { configChanged, errorText, fetchJson, sendJson } from "@/lib/api";
import { formatAt, plural } from "@/lib/format";

type FieldDiff = { field: string; seeding_value: unknown; live_value: unknown };
type Change = {
  collection: string;
  id: string;
  label: string;
  kind: "added" | "edited" | "deleted";
  updated_at: string | null;
  fields: FieldDiff[];
};
type ChangesResponse = { count: number; loaded_at: string | null; items: Change[] };

const LIST_LABELS: Record<string, string> = {
  sources: "Source",
  prompts: "Skill",
  signals: "Signal",
  settings: "Setting",
  fabrics: "Fabric",
  measures: "Measure",
  scoring_config: "Scoring method",
  recipes: "Combined call",
  availability: "Commercial availability",
  domains: "Domain",
  subdomains: "Sub-domain",
  trl_levels: "TRL level",
  path_steps: "Path to scale step",
  mechanisms: "Value mechanism",
};

// each stored field by the label its Setup page gives it; one not named here shows its name in words
const FIELD_LABELS: Record<string, string> = {
  // Settings: collecting pages
  skip_url_patterns: "Links the crawler never follows", pages_per_source: "Page budget per source",
  page_part_chars: "Page part size (characters)", page_part_concurrency: "Parts processed in parallel",
  lookback_days: "First-run lookback (days)",
  // Settings: judging technologies, finding evidence, time zone
  classify_after_collection: "Judge the evidence after each collection",
  classify_token_budget: "Most tokens one judging run may use", classify_pages_cap: "Pages read per technology when judging",
  evidence_floor: "Pages needed before a technology counts as ready",
  wake_after_pages: "Flag a switched-off technology after this many new pages",
  find_evidence_results: "Find evidence: results per search", find_evidence_daily_budget: "Find evidence: searches per day",
  default_time_zone: "Default time zone", emerging_availability: "Values that count as emerging",
  // scoring method
  max_dossier_tokens: "Most evidence sent per technology", timeline_cutpoints: "How soon: cut-points",
  potential_cutpoints: "How big: cut-points", grid: "Priority grid", unscorable_policy: "When a measure can't be scored",
  open_question: "Open question",
  // signals, skills, sources
  look_for: "What to look for", prompt: "Skill text", system: "Instructions sent first", entry_urls: "Start pages",
  searches: "Saved searches", follow_outbound: "Follow links to other sites, one hop", cluster: "Kind of source",
  enabled: "Switched on", url: "URL",
  // fabrics, measures, path steps
  tcl_today: "What Tata has today", anchors: "What low, middle and high scores look like",
  weight: "Weight within its score", evidence_needed: "Proof needed to reach it", decision: "Then Tata can decide to",
};
const fieldLabel = (f: string) => FIELD_LABELS[f] ?? f.replaceAll("_", " ").replace(/^./, (x) => x.toUpperCase());

const key = (c: Change) => `${c.collection}:${c.id}`;

function show(value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "string") return value;
  return JSON.stringify(value, null, 2);
}

/** Edits apply the moment they're saved. This page only decides which of
 * them are kept as the defaults (the seeding data) — the configuration a
 * fresh install loads. */
export default function ChangesPage() {
  const [data, setData] = useState<ChangesResponse | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [ticked, setTicked] = useState<Set<string>>(new Set());
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);

  const load = useCallback(() => {
    fetchJson<ChangesResponse>("/api/changes")
      .then((d) => {
        setData(d);
        setError(null);
        setTicked((prev) => new Set([...prev].filter((k) => d.items.some((c) => key(c) === k))));
      })
      .catch(setError);
  }, []);

  useEffect(() => { load(); }, [load]);

  const toggle = (k: string) =>
    setTicked((prev) => {
      const next = new Set(prev);
      if (next.has(k)) next.delete(k);
      else next.add(k);
      return next;
    });

  async function update() {
    if (!data) return;
    setBusy(true);
    setConfirming(false);
    setResult(null);
    const items = data.items.filter((c) => ticked.has(key(c))).map((c) => ({ collection: c.collection, id: c.id }));
    try {
      const r = await sendJson<{ written: number; files: string[] }>("/api/changes/update-seeding-data", "POST", { items });
      setResult({
        ok: true,
        text: r.files.length
          ? `Kept as the defaults (${r.files.join(", ")}). Saving a version shares them.`
          : "Nothing to keep: those edits already match the defaults.",
      });
      setTicked(new Set());
    } catch (e) {
      setResult({ ok: false, text: errorText(e) });
    } finally {
      setBusy(false);
      configChanged();
      load();
    }
  }

  const all = data ? data.items.map(key) : [];
  const allTicked = all.length > 0 && all.every((k) => ticked.has(k));

  return (
    <div>
      <PageHeader title="Changes"
        intro="Setup edits that aren't kept as the defaults yet. Each one already works; a fresh install starts from the defaults, so keep the edits that should last."
        help={<>
          <li>Every edit applies the moment it&apos;s saved. This page only decides which edits become the defaults a
            fresh install starts from (Technical details: the seeding data, in tech-atlas/seeds).</li>
          <li>Each card shows what changed: the old value struck through and the new one in bold. &ldquo;+
            added&rdquo; and &ldquo;deleted&rdquo; mark whole items.</li>
          <li>Tick the edits to keep and click Keep as defaults. Nothing else changes, and it costs no model calls;
            saving a version shares them.</li>
          <li>A fresh install replaces any edit that wasn&apos;t kept as a default.</li>
        </>} />

      {error != null && <BackendError error={error} />}

      {data && (
        <>
          <p className="mt-5 border-l-2 border-neutral-300 pl-3 text-xs text-neutral-600">
            Defaults last loaded {formatAt(data.loaded_at)}. A fresh install replaces edits that weren&apos;t kept as
            defaults.
          </p>

          {result && (
            <p className={`mt-4 rounded-card border px-4 py-2 text-sm ${result.ok ? "border-line bg-white" : "border-failed/40 bg-failed/5 text-failed"}`}>
              {result.text}
            </p>
          )}

          {data.items.length === 0 ? (
            <p className="mt-6 text-sm text-neutral-500">
              Every setup edit is kept as a default.
            </p>
          ) : (
            <>
              <div className="mt-6 flex flex-wrap items-center gap-3">
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={allTicked}
                    onChange={() => setTicked(allTicked ? new Set() : new Set(all))} />
                  Select all
                </label>
                {confirming ? (
                  <span className="flex items-center gap-2 text-sm">
                    Keep {plural(ticked.size, "edit")} as the defaults? A fresh install will start from them.
                    <button onClick={update} disabled={busy}
                      className="rounded-full bg-navy px-3 py-1.5 text-sm font-medium text-white hover:bg-navy-strong">Keep</button>
                    <button onClick={() => setConfirming(false)}
                      className="rounded-full border border-line bg-white px-3 py-1.5 text-sm hover:bg-neutral-100">Cancel</button>
                  </span>
                ) : (
                  <button onClick={() => setConfirming(true)} disabled={ticked.size === 0 || busy}
                    className="rounded-full bg-navy px-3.5 py-1.5 text-sm font-medium text-white hover:bg-navy-strong disabled:cursor-not-allowed disabled:opacity-50">
                    {busy ? "Saving…" : `Keep as defaults${ticked.size ? ` (${ticked.size})` : ""}`}
                  </button>
                )}
              </div>

              <div className="mt-4 space-y-3">
                {data.items.map((c) => (
                  <div key={key(c)} className="rounded-card border border-line bg-white px-5 py-3.5">
                    <label className="flex cursor-pointer flex-wrap items-center gap-3">
                      <input type="checkbox" checked={ticked.has(key(c))} onChange={() => toggle(key(c))} />
                      <span className="font-medium">
                        {LIST_LABELS[c.collection] ?? c.collection} · {c.label}
                      </span>
                      <span className="bg-neutral-100 px-2 py-0.5 font-mono text-[11px] uppercase">
                        {c.kind === "added" && "+ "}{c.kind}
                      </span>
                      {c.updated_at && (
                        <span className="font-mono text-[11px] text-neutral-500">edited {formatAt(c.updated_at)}</span>
                      )}
                    </label>
                    <div className="mt-3 space-y-2.5">
                      {c.fields.map((f) => <FieldRow key={f.field} diff={f} kind={c.kind} />)}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}

function FieldRow({ diff, kind }: { diff: FieldDiff; kind: Change["kind"] }) {
  // a sub-domain's status in words: the model proposed it, or a person accepted it
  const word = (v: unknown) => diff.field === "status" ? ({ new: "proposed", seeded: "accepted" } as Record<string, string>)[String(v)] ?? show(v) : show(v);
  const before = word(diff.seeding_value);
  const after = word(diff.live_value);
  const long = before.length > 80 || after.length > 80 || before.includes("\n") || after.includes("\n");
  const box = "max-h-64 overflow-y-auto whitespace-pre-wrap break-words border px-3 py-2 font-mono text-[11.5px] leading-relaxed";
  return (
    <div>
      <div className="text-[12px] font-medium text-neutral-600" title={diff.field}>{fieldLabel(diff.field)}</div>
      {long ? (
        <div className="mt-1 grid grid-cols-2 gap-2">
          <div>
            <div className="text-[11px] text-neutral-500">Default</div>
            <div className={`${box} border-neutral-200 bg-neutral-50 text-neutral-600`}>{kind === "added" ? "—" : before}</div>
          </div>
          <div>
            <div className="text-[11px] text-neutral-500">Live</div>
            <div className={`${box} border-navy/30 bg-navy/5`}>{kind === "deleted" ? "— (deleted)" : after}</div>
          </div>
        </div>
      ) : (
        <div className="mt-0.5 text-sm">
          <span className="text-neutral-500 line-through decoration-neutral-300">{kind === "added" ? "—" : before}</span>
          <span className="mx-2 text-neutral-400">→</span>
          <span className="font-medium">{kind === "deleted" ? "— (deleted)" : after}</span>
        </div>
      )}
    </div>
  );
}
