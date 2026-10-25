"use client";

import { useEffect, useState } from "react";
import ConfirmAction from "@/components/ConfirmAction";
import JobLine from "@/components/JobLine";
import { errorText, fetchJson } from "@/lib/api";
import { type Gap, type Job, type JobResult, type Preview, forGap, startJob, useJob, usePastJobs } from "@/lib/findEvidence";
import { formatAt, plural } from "@/lib/format";

const LABELS: Record<Gap["kind"], string> = {
  technology: "Find evidence", measure: "Find evidence for this measure", use_case: "Find use cases", link: "Add a link", links: "Add evidence" };

/** "Find evidence": a web search for one gap, the new pages read like any
 *  collected page, and only the gap's call run again. The cost shows first;
 *  without a search set up, or past today's budget, it says why. Under it,
 *  what past jobs for this gap found, so a result outlives a reload.
 *  `only`: just the button, or just the past jobs (nothing when there are
 *  none), for a page that shows them apart, such as a technology's. */
export default function FindEvidence({ gap, label = LABELS[gap.kind], only, onDone }: {
  gap: Omit<Gap, "url">;
  label?: string;
  only?: "button" | "past";
  onDone?: () => void;
}) {
  const [preview, setPreview] = useState<Preview | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const job = useJob(jobId, onDone);
  const past = usePastJobs(gap.tech_id);
  const mine = only === "button" ? [] : (past.jobs ?? []).filter((j) => forGap(j, gap));
  const q = new URLSearchParams(Object.entries(gap).filter((e): e is [string, string] => typeof e[1] === "string")).toString();
  useEffect(() => {
    if (only !== "past") fetchJson<Preview>(`/api/find-evidence/preview?${q}`).then(setPreview)
      .catch((e) => setError(`The cost couldn't be worked out: ${errorText(e)}`));
  }, [q, only]);

  if (only === "past") return mine.length || past.error ? <div className="mt-2 text-sm"><Past jobs={mine} error={past.error} /></div> : null;
  // this job while it runs, then until the past jobs show it (shown apart, they do at once)
  const live = job && (job.status === "running" || (only !== "button" && !mine.some((j) => j._id === job._id))) ? job : null;
  return (
    <span className="inline-flex max-w-full flex-col items-start gap-1 sm:max-w-sm">
      {live ? (
        <JobLine job={live} failed="Find evidence failed">
          {live.query && <span className="text-muted"> Searched: &ldquo;{live.query}&rdquo;.</span>}
        </JobLine>
      ) : (
        <span className="inline-flex flex-wrap items-center gap-2">
          <ConfirmAction label={label} secondary disabled={preview?.why_not ?? null}
            cost={preview ? `1 search, up to ${plural(preview.page_reads, "page")}` : undefined}
            question={`Search the web for "${preview?.query ?? ""}"? One search, up to ${plural(preview?.page_reads ?? 5, "page")} read like collected pages (a model call each), then only this gap's call again. ${preview ? `${preview.budget.used} of today's ${preview.budget.limit} searches used.` : ""}`}
            onConfirm={async () => {
              setError(null);
              try { setJobId((await startJob(gap)).job_id); }
              catch (e) { setError(errorText(e)); }
            }} />
          {error && <span className="text-[12.5px] text-failed">{error}</span>}
        </span>
      )}
      {only !== "button" && <Past jobs={mine} error={past.error} />}
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
      {open && (
        <span className="mt-1.5 block space-y-2 border-l border-line pl-3">
          {jobs.map((j) => (
            <span key={j._id} className="block">
              <span className="block text-muted">
                {formatAt(j.at, j.tz)} · {j.gap.kind === "links" ? "links and files added by hand"
                  : j.searched === false ? "a pasted link" : <>searched &ldquo;{j.query}&rdquo;</>}
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

const failedWords = (j: Job) => (j.searched === false ? "The link wasn't added" : "Find evidence failed");

function site(url: string): string {
  try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return url; }
}
