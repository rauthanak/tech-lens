"use client";

import { useState } from "react";
import JobLine from "@/components/JobLine";
import { errorText } from "@/lib/api";
import { type Gap, startJob, useJob } from "@/lib/findEvidence";

/** "Add a link": a person pastes a page they know; it's read like a collected
 *  page and the gap's call runs again. No search, so no daily budget. Once
 *  it ends, what came of it shows with the gap's past jobs (FindEvidence). */
export default function AddLink({ gap, onDone }: { gap: Omit<Gap, "kind" | "url">; onDone?: () => void }) {
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState("");
  const [jobId, setJobId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const job = useJob(jobId, () => { setOpen(false); setUrl(""); onDone?.(); });
  if (job?.status === "running") return <JobLine job={job} failed="The link wasn't added" />;
  if (!open) return <button type="button" onClick={() => setOpen(true)} className="text-[13px] text-link hover:underline">Add a link</button>;
  return (
    <form className="inline-flex flex-wrap items-center gap-1.5" onSubmit={async (e) => {
      e.preventDefault();
      setError(null);
      try { setJobId((await startJob({ ...gap, kind: "link", url: url.trim() })).job_id); }
      catch (err) { setError(errorText(err)); }
    }}>
      <input autoFocus type="url" required value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://… a page with the evidence"
        className="w-64 max-w-full rounded border border-neutral-300 bg-white px-2 py-1 text-[13px]" />
      <button type="submit" className="rounded-full bg-navy px-3 py-1 text-[13px] text-white">Read it</button>
      <button type="button" onClick={() => setOpen(false)} className="text-[13px] text-muted">Cancel</button>
      {error && <span className="basis-full text-[12.5px] text-failed">{error}</span>}
    </form>
  );
}
