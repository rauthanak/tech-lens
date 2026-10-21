import { type Job, stageWords } from "@/lib/findEvidence";

/** What came of a find-evidence job: its stage while it runs, then its
 *  summary, or `failed` and why; `children` add to the summary. */
export default function JobLine({ job, failed, children }: { job: Job; failed: string; children?: React.ReactNode }) {
  if (job.status === "running") return <span className="text-[12.5px] text-muted">{stageWords(job)}</span>;
  return (
    <span className={`text-[12.5px] ${job.status === "failed" ? "text-failed" : "text-neutral-700"}`}>
      {job.status === "failed" ? `${failed}: ${job.error}` : job.summary}
      {children}
    </span>
  );
}
