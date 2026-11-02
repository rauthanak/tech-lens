"use client";

import { useState } from "react";
import Dialog from "@/components/Dialog";
import JobLine from "@/components/JobLine";
import { calls } from "@/lib/actions";
import { errorText } from "@/lib/api";
import { type Gap, startJob, useJob } from "@/lib/findEvidence";

/** "Add a link": a person pastes a page they know, in a box over the page; it's
 *  read like a collected page (one model call) and the gap's call runs again
 *  (one more). No search. Once it ends, what came of it shows with the gap's
 *  past jobs (FindEvidence). */
export default function AddLink({ gap, onDone }: { gap: Omit<Gap, "kind" | "url">; onDone?: () => void }) {
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState("");
  const [starting, setStarting] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const job = useJob(jobId, () => { setUrl(""); onDone?.(); });
  if (job?.status === "running") return <JobLine job={job} failed="The link wasn't added" />;
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="text-[13px] text-link hover:underline">Add a link</button>
      <Dialog open={open} onClose={() => { setOpen(false); setError(null); }} title="Add a link">
        <form className="space-y-3 text-[13px]" onSubmit={async (e) => {
          e.preventDefault();
          setError(null);
          setStarting(true);
          try { setJobId((await startJob({ ...gap, kind: "link", url: url.trim() })).job_id); setOpen(false); }
          catch (err) { setError(errorText(err)); }
          finally { setStarting(false); }
        }}>
          <label className="block">A page with the evidence
            <input type="url" required value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…"
              className="mt-1 w-full rounded border border-neutral-300 bg-white px-2 py-1" />
          </label>
          <p className="text-muted">It&apos;s read like a collected page, then only this gap&apos;s call runs again.</p>
          <span className="flex flex-wrap items-center gap-2">
            <button type="submit" disabled={starting} className="rounded-full bg-navy px-3 py-1 text-white hover:bg-navy-strong disabled:opacity-50">
              {starting ? "Starting…" : "Read it"} <span className="text-white/70">· {calls(2)}</span>
            </button>
            <button type="button" onClick={() => setOpen(false)} className="text-muted hover:text-ink">Cancel</button>
          </span>
          {error && <p className="text-failed">{error}</p>}
        </form>
      </Dialog>
    </>
  );
}
