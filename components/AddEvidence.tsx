"use client";

import { useState } from "react";
import { calls } from "@/lib/actions";
import { errorText, sendForm } from "@/lib/api";
import { plural } from "@/lib/format";
import { useJob } from "@/lib/findEvidence";
import { refreshPipeline } from "@/lib/pipeline";
import { LIVE_DOT } from "@/lib/theme";

const ACCEPT = ".pdf,.txt,.md,.html,.htm";
// the steps a job goes through, by its stage; the last two only when it goes on to the Point of View
const STEPS = ["Read the pages", "Judge its evidence", "Assess it", "Write its Point of View"];
const pickFiles = "inline-block cursor-pointer rounded-full border border-line bg-white px-3.5 py-1 text-[13px] hover:bg-ground focus-within:ring-2 focus-within:ring-azure";
const AT: Record<string, number> = { reading: 0, "re-running": 1, assessing: 2, writing: 3 };

/** Add evidence for one technology: links and files a person has, read like
 *  collected pages and filed under it. Its evidence is then judged again and,
 *  unless the person chose to stop there, it's assessed and its Point of View
 *  written, by itself. The cost shows before it starts; each step shows while
 *  it runs; a step that can't go on says why (the job's summary). */
export default function AddEvidence({ techId, name, assessCalls, hasPov, onDone }: {
  techId: string; name: string; assessCalls: number; hasPov: boolean; onDone?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [links, setLinks] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [through, setThrough] = useState<"pov" | "judge">("pov");
  const [anyway, setAnyway] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const job = useJob(jobId, () => { refreshPipeline(); onDone?.(); });

  const urls = links.split(/\s+/).map((u) => u.trim()).filter(Boolean);
  const pages = urls.length + files.length;
  const cost = pages + 1 + (through === "pov" ? assessCalls + 1 : 0);
  const reset = () => { setJobId(null); setLinks(""); setFiles([]); setError(null); };

  if (job) {
    const steps = STEPS.slice(0, job.gap.through === "pov" ? 4 : 2);
    const at = job.status === "running" ? (AT[job.stage ?? "reading"] ?? 0) : steps.length;
    return (
      <section aria-label="Add evidence" className="mt-3 rounded-card border border-line bg-white px-4 py-3 text-sm">
        <ol className="flex flex-wrap gap-x-5 gap-y-1">
          {steps.map((s, i) => (
            <li key={s} className={`flex items-center gap-1.5 ${i > at ? "text-muted" : ""}`}>
              {i < at ? <span aria-hidden className="text-navy">✓</span> : i === at ? <span className={LIVE_DOT} /> : <span aria-hidden>·</span>}
              {i + 1}. {s}
            </li>
          ))}
        </ol>
        {job.status === "running" ? (
          <p className="mt-2 text-muted">This runs by itself; you can leave the page. Its result shows here and under Past searches and links.</p>
        ) : (
          <div className="mt-2 flex flex-wrap items-baseline gap-3">
            <p className={job.status === "failed" ? "text-failed" : ""}>
              {job.status === "failed" ? `It didn't finish: ${job.error ?? "no reason was recorded"}.` : job.summary}
              {job.status === "completed" && job.gap.through !== "pov" && (
                <span className="text-muted"> The new judgement is under Overview below (Evidence, with Why?), and Next step
                  above says what comes next.</span>
              )}
            </p>
            <button type="button" onClick={reset} className="text-link hover:underline">Add more</button>
          </div>
        )}
      </section>
    );
  }

  if (!open)
    return (
      <button type="button" onClick={() => setOpen(true)}
        className="rounded-full border border-line bg-white px-3.5 py-1.5 text-sm hover:bg-ground">
        Add evidence: links or files
      </button>
    );

  const start = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setStarting(true);
    const form = new FormData();
    form.append("tech_id", techId);
    form.append("urls", JSON.stringify(urls));
    form.append("through", through);
    form.append("assess_anyway", String(through === "pov" && anyway));
    files.forEach((f) => form.append("files", f));
    try {
      setJobId((await sendForm<{ job_id: string }>("/api/find-evidence/add", form)).job_id);
      setOpen(false);
    } catch (err) {
      setError(errorText(err));
    } finally {
      setStarting(false);
    }
  };

  return (
    <form onSubmit={start} aria-label="Add evidence"
      className="mt-3 space-y-3 rounded-card border border-line bg-white px-4 py-3 text-sm">
      <p className="font-semibold">Add evidence for {name}</p>
      <label className="block">
        <span className="font-medium">Links</span>{" "}
        <span className="text-muted">one address per line. Each is read as one page: the links on it aren&apos;t followed.</span>
        <textarea value={links} onChange={(e) => setLinks(e.target.value)} rows={3}
          placeholder="https://… a page about it"
          className="mt-1 block w-full rounded border border-neutral-300 px-2 py-1.5 font-mono text-[12.5px]" />
      </label>
      <div>
        <span className="font-medium">Files</span> <span className="text-muted">PDF, text, Markdown or HTML, up to 25 MB each.
          For a page behind a login, save it as a PDF and add it here; never put a password in a link.</span>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <label className={pickFiles}>
            Choose files…
            <input type="file" multiple accept={ACCEPT} className="sr-only"
              onChange={(e) => { setFiles([...files, ...Array.from(e.target.files ?? [])]); e.target.value = ""; }} />
          </label>
          {files.length === 0 && <span className="text-[13px] text-muted">None chosen</span>}
          {files.map((f, i) => (
            <span key={`${f.name}-${i}`} className="inline-flex items-center gap-1 rounded-full bg-ground px-2.5 py-0.5 text-[12.5px]">
              {f.name}
              <button type="button" aria-label={`Remove ${f.name}`} onClick={() => setFiles(files.filter((_, j) => j !== i))}
                className="text-muted hover:text-ink">✕</button>
            </span>
          ))}
        </div>
      </div>
      <fieldset className="space-y-1">
        <legend className="font-medium">Then</legend>
        <label className="flex items-start gap-2">
          <input type="radio" name="through" checked={through === "pov"} onChange={() => setThrough("pov")} className="mt-1" />
          <span>
            {hasPov ? "Judge its evidence, assess it again and rewrite its Point of View with these pages, by itself"
              : "Judge its evidence, assess it and write its Point of View, by itself"}
            <span className="block text-xs text-muted">
              {hasPov ? "Leaders keep the published version until you publish again." : "It waits for you to publish."}
            </span>
          </span>
        </label>
        {through === "pov" && (
          <label className="ml-6 flex items-start gap-2 text-muted">
            <input type="checkbox" checked={anyway} onChange={(e) => setAnyway(e.target.checked)} className="mt-1" />
            <span>Assess even if its evidence is still judged thin (otherwise it stops there and says so)</span>
          </label>
        )}
        <label className="flex items-start gap-2">
          <input type="radio" name="through" checked={through === "judge"} onChange={() => setThrough("judge")} className="mt-1" />
          <span>
            Only judge its evidence
            <span className="block text-xs text-muted">You see the new judgement on this page and decide whether to assess.</span>
          </span>
        </label>
      </fieldset>
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={pages === 0 || starting}
          className="rounded-full bg-navy px-4 py-1.5 text-white hover:bg-navy-strong disabled:opacity-40">
          {starting ? "Starting…" : "Start"}{pages > 0 && <span className="text-white/70"> · {calls(cost)}</span>}
        </button>
        <button type="button" onClick={() => { setOpen(false); setError(null); }} className="text-muted hover:text-ink">Cancel</button>
        {pages > 0 && (
          <span className="text-xs text-muted">
            {plural(pages, "page")} to read (one call each), one to judge its evidence
            {through === "pov" ? `, about ${plural(assessCalls, "call")} to assess and one for the Point of View` : ""}.
            Pages already collected aren&apos;t read again.
          </span>
        )}
      </div>
      {error && <p className="text-failed">{error}</p>}
    </form>
  );
}
