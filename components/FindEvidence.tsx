"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import Dialog from "@/components/Dialog";
import JobLine from "@/components/JobLine";
import { errorText, fetchJson } from "@/lib/api";
import { type Gap, type Job, type JobResult, type PlaceDone, type Preview, forGap, startJob, useJob, usePastJobs } from "@/lib/findEvidence";
import { formatAt, plural } from "@/lib/format";

const LABELS: Record<Gap["kind"], string> = {
  technology: "Find evidence", measure: "Find evidence for this measure", use_case: "Find use cases", link: "Add a link", links: "Add evidence" };

/** "Find evidence": the vertical search for one technology. The button opens
 *  a panel: what it looks for (from the gap, under all the technology's
 *  names), where to look (the radar's data sources, its websites, the web;
 *  a place that can't be searched is greyed out with why), and how many per
 *  place, with the cost before anything runs. The pages are read like any
 *  collected page, and only the gap's call runs again. Under it, what past
 *  jobs for this gap found, so a result outlives a reload. `only`: just the
 *  button, or just the past jobs (nothing when there are none), for a page
 *  that shows them apart, such as a technology's. */
export default function FindEvidence({ gap, label = LABELS[gap.kind], only, onDone }: {
  gap: Omit<Gap, "url">;
  label?: string;
  only?: "button" | "past";
  onDone?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [chosen, setChosen] = useState<string[] | null>(null); // null: the preview's own choice, every place that can be searched
  const [perPlace, setPerPlace] = useState<number | null>(null);
  const [counts, setCounts] = useState<Record<string, number>>({}); // a place's own number; blank takes the shared one
  const [jobId, setJobId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const job = useJob(jobId, onDone);
  const past = usePastJobs(gap.tech_id);
  const mine = only === "button" ? [] : (past.jobs ?? []).filter((j) => forGap(j, gap));
  const params = new URLSearchParams(Object.entries(gap).filter((e): e is [string, string] => typeof e[1] === "string"));
  if (chosen) params.set("places", chosen.join(","));
  if (perPlace) params.set("per_place", String(perPlace));
  if (Object.keys(counts).length) params.set("counts", Object.entries(counts).map(([k, v]) => `${k}:${v}`).join(","));
  const q = params.toString();
  useEffect(() => {
    if (only !== "past" && open) fetchJson<Preview>(`/api/find-evidence/preview?${q}`).then(setPreview)
      .catch((e) => setError(`The cost couldn't be worked out: ${errorText(e)}`));
  }, [q, only, open]);

  if (only === "past") return mine.length || past.error ? <div className="mt-2 text-sm"><Past jobs={mine} error={past.error} /></div> : null;
  // this job while it runs, then until the past jobs show it (shown apart, they do at once)
  const live = job && (job.status === "running" || (only !== "button" && !mine.some((j) => j._id === job._id))) ? job : null;
  const picked = preview?.places.filter((p) => p.chosen).map((p) => p.id) ?? [];
  const toggle = (id: string) => setChosen(picked.includes(id) ? picked.filter((x) => x !== id) : [...picked, id]);
  return (
    <span className="inline-flex max-w-full flex-col items-start gap-1 sm:max-w-sm">
      {live ? (
        <JobLine job={live} failed="Find evidence failed">
          {live.query && <span className="text-muted"> Searched: &ldquo;{live.query}&rdquo;.</span>}
          {live.places_done?.length ? <PlacesDone done={live.places_done} /> : null}
        </JobLine>
      ) : (
        <span className="inline-flex flex-wrap items-center gap-2">
          <button type="button" onClick={() => { setOpen(true); setError(null); }}
            className="rounded-full border border-neutral-300 bg-white px-3 py-1 text-[13px] hover:bg-neutral-50">{label}</button>
          {error && !open && <span className="text-[12.5px] text-failed">{error}</span>}
        </span>
      )}
      <Dialog open={open} onClose={() => setOpen(false)} title={label}>
        <div className="text-[13px]">
          {!preview ? <span className="text-muted">Working out where it can look…</span> : <>
            <p className="text-muted">
              Searched under its names: <span className="text-ink">{preview.names.join(", ") || "—"}</span>.
              {preview.query && <> Web searches look for: <span className="text-ink">&ldquo;{preview.query}&rdquo;</span>.</>}
            </p>
            <fieldset className="mt-3">
              <legend className="font-medium">Where to look</legend>
              {preview.places.filter((p) => p.available).map((p) => (
                <label key={p.id} className="mt-2 flex items-start gap-2">
                  <input type="checkbox" className="mt-1" checked={!!p.chosen} onChange={() => toggle(p.id)} />
                  <span className="min-w-0 flex-1">
                    <span className="font-medium">{p.label}</span>
                    <span className="block text-[12px] text-muted">{p.gives}</span>
                  </span>
                  {p.kind === "counts" ? <span className="shrink-0 text-[12px] text-muted">1 page</span> : (
                    <span className="flex shrink-0 items-center gap-1 text-[12px] text-muted" onClick={(e) => e.preventDefault()}>
                      up to
                      <input type="number" min={1} max={50} aria-label={`How many from ${p.label}`} placeholder={String(preview.per_place)}
                        value={counts[p.id] ?? ""} className="w-14 rounded border border-neutral-300 px-1.5 py-0.5 text-[12px] text-ink"
                        onChange={(e) => {
                          const v = Number(e.target.value);
                          setCounts((c) => {
                            const rest = Object.fromEntries(Object.entries(c).filter(([k]) => k !== p.id));
                            return v >= 1 && v <= 50 ? { ...rest, [p.id]: v } : rest;
                          });
                        }} />
                    </span>
                  )}
                </label>
              ))}
              {/* what isn't set up yet, said plainly, without taking the eye from what can be chosen */}
              {preview.places.some((p) => !p.available) && (
                <p className="mt-3 rounded border border-line bg-ground/60 px-2.5 py-2 text-[12px] text-neutral-600">
                  <span className="font-medium text-neutral-700">Not set up yet: </span>{notSetUp(preview.places)}
                </p>
              )}
              <Link href="/admin/sources/new" className="mt-2 inline-block text-[12px] text-link hover:underline">Need another place? Add a source</Link>
            </fieldset>
            <PerPlace value={preview.per_place} onChange={setPerPlace} />
            <p className="mt-1 text-[12px] text-muted">For every place left blank above.</p>
            <p className={`mt-3 ${preview.why_not ? "text-amber-800" : "text-muted"}`}>
              {preview.why_not ?? `About ${plural(preview.cost.calls, "model call")}: up to ${plural(preview.cost.pages, "page")} to read` +
                (preview.cost.searches ? `, ${plural(preview.cost.searches, "web search", "web searches")}` : "") +
                ", and 1 to work out this gap again. Pages the radar already has aren't read again."}
            </p>
            <span className="mt-3 flex flex-wrap items-center gap-2">
              <button type="button" disabled={!!preview.why_not}
                className="rounded-full bg-navy px-3 py-1 text-[13px] font-medium text-white hover:bg-navy-strong disabled:opacity-50"
                onClick={async () => {
                  setError(null);
                  try { setJobId((await startJob({ ...gap, places: picked, per_place: preview.per_place, counts })).job_id); setOpen(false); }
                  catch (e) { setError(errorText(e)); }
                }}>Find</button>
              <button type="button" onClick={() => setOpen(false)} className="rounded-full px-3 py-1 text-[13px] text-link hover:underline">Cancel</button>
              {error && <span className="text-[12.5px] text-failed">{error}</span>}
            </span>
          </>}
        </div>
      </Dialog>
      {only !== "button" && <Past jobs={mine} error={past.error} />}
    </span>
  );
}

const PRESETS = [5, 10, 20];
const ADMIN = /, which your administrator adds \(see the Deployment Guide\)$/;

/** The places that can't be searched, grouped by why, said once:
 *  "Patents and Patent trends need the patent office's free key. Your administrator adds keys (Deployment Guide)." */
function notSetUp(places: Preview["places"]): string {
  const byWhy = new Map<string, string[]>();
  for (const p of places.filter((x) => !x.available)) {
    const why = (p.why ?? "").replace(/^not set up yet: /, "").replace(ADMIN, "");
    byWhy.set(why, [...(byWhy.get(why) ?? []), p.label]);
  }
  const parts = [...byWhy].map(([why, labels]) =>
    `${labels.join(" and ")} ${why.startsWith("needs ") && labels.length > 1 ? why.replace(/^needs /, "need ") : why}`);
  const keys = places.some((p) => !p.available && ADMIN.test(p.why ?? ""));
  return parts.join("; ") + "." + (keys ? " Your administrator adds keys (see the Deployment Guide)." : "");
}

/** How many per place: 5, 10, 20, or Other for any number up to 50. */
function PerPlace({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  const [other, setOther] = useState(!PRESETS.includes(value));
  return (
    <label className="mt-2 flex flex-wrap items-center gap-2">
      <span className="font-medium">How many per place</span>
      <select value={other ? "other" : String(value)} className="rounded border border-neutral-300 bg-white px-2 py-0.5"
        onChange={(e) => { const v = e.target.value; setOther(v === "other"); if (v !== "other") onChange(Number(v)); }}>
        {PRESETS.map((n) => <option key={n} value={n}>{n}</option>)}
        <option value="other">Other</option>
      </select>
      {other && <>
        <input type="number" min={1} max={50} aria-label="How many per place" defaultValue={value}
          className="w-20 rounded border border-neutral-300 px-2 py-0.5"
          onChange={(e) => { const n = Number(e.target.value); if (n >= 1 && n <= 50) onChange(n); }} />
        <span className="text-muted">up to 50</span></>}
    </label>
  );
}

/** After a search: what it means and the one thing to do next, pointing at the
 *  technology's Next step (which has the button and its cost). */
function WhatNow({ job }: { job: Job }) {
  const filed = job.results.some((r) => r.status === "filed");
  const kind = job.rerun?.kind ?? job.gap.kind;
  const text = !filed
    ? "Nothing new was filed, so nothing changed. Try other places or more per place, or Add evidence if you have a page."
    : kind === "measure" ? "That measure was scored again from the new pages, and its priority worked out again. Next: rewrite its Point of View so leaders see the change."
      : kind === "use_case" ? "Its use cases were worked out again from the new pages. Next: rewrite its Point of View so leaders see them."
        : "The new pages are filed under it, and its evidence was judged again. They count in its scores only once it's assessed again. Next: assess it again.";
  return (
    <span className="mt-1 block rounded border border-azure/30 bg-azure/5 px-2.5 py-1.5 text-[12.5px] text-ink">
      <b className="font-semibold">What now:</b> {text}{filed && <> <a href="#next-step" className="text-link hover:underline">Go to Next step ↑</a></>}
    </span>
  );
}

/** One line per place: what it found, or why it wasn't searched. */
function PlacesDone({ done }: { done: PlaceDone[] }) {
  return (
    <span className="mt-1 block">
      {done.map((d) => (
        <span key={d.place} className="block text-[12.5px]">
          {d.label}: {d.why ? <span className="text-muted">not searched, {d.why}</span> : plural(d.found, "result")}
        </span>
      ))}
    </span>
  );
}

/** The newest job in one line (when, then what came of it); "What was
 *  found" opens every job: the search or the pasted link, and each page
 *  filed, already collected, set aside (by which rule) or not read (why). */
function Past({ jobs, error }: { jobs: Job[]; error: string | null }) {
  const [open, setOpen] = useState(false);
  if (error) return <span className="text-[12.5px] text-failed">Past searches couldn&apos;t be loaded: {error}</span>;
  if (!jobs.length) return null;
  const [last] = jobs;
  return (
    <span className="block text-[12.5px]">
      <span className="text-muted">{last.gap.kind === "links" ? "Evidence added" : last.searched === false ? "Link added" : "Searched"} {formatAt(last.at, last.tz)}: </span>
      <JobLine job={last} failed={failedWords(last)} />{" "}
      <button type="button" onClick={() => setOpen(!open)} className="text-link hover:underline">
        {open ? "Hide" : jobs.length > 1 ? `What was found (all ${jobs.length})` : "What was found"}
      </button>
      {last.status === "completed" && <WhatNow job={last} />}
      {open && (
        <span className="mt-1.5 block space-y-2 border-l border-line pl-3">
          {jobs.map((j) => (
            <span key={j._id} className="block">
              <span className="block text-muted">
                {formatAt(j.at, j.tz)} · {j.gap.kind === "links" ? "links and files added by hand"
                  : j.searched === false ? "a pasted link" : <>searched &ldquo;{j.query}&rdquo; in {placesOf(j)}</>}
              </span>
              {j !== last && <span className="block"><JobLine job={j} failed={failedWords(j)} /></span>}
              {j.results.map((r) => (
                <span key={r.url} className="block">
                  {r.url.startsWith("upload:") ? <>{r.title} <span className="text-muted">(uploaded)</span></> : <>
                    <a href={r.url} target="_blank" rel="noreferrer" className="text-link hover:underline">{r.title || site(r.url)}</a>
                    {r.title && <span className="text-muted"> ({site(r.url)})</span>}</>} — <Status r={r} />
                </span>
              ))}
            </span>
          ))}
        </span>
      )}
    </span>
  );
}

function Status({ r }: { r: JobResult }) {
  if (r.status === "filed") return <span>filed under it</span>;
  if (r.status === "already") return <span className="text-muted">already collected, so not read again</span>;
  if (r.status === "set_aside") return (
    <span>set aside, not filed: the Can ignore rule &ldquo;{r.rule}&rdquo;{r.reason && <span className="text-muted"> ({r.reason.replace(/\.$/, "")})</span>}</span>
  );
  if (r.status === "failed") return <span className="text-failed">couldn&apos;t be read: {r.reason}</span>;
  return <span className="text-muted">being read…</span>;
}

/** Where a job looked, in words; a job from before places looked on the web. */
const placesOf = (j: Job) => (j.places_done?.length ? j.places_done.map((d) => d.label.replace(/ \(\d+\)$/, "")).join(", ") : "the web");

const failedWords = (j: Job) => (j.searched === false ? "The link wasn't added" : "Find evidence failed");

function site(url: string): string {
  try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return url; }
}
