"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import BackendError from "@/components/BackendError";
import CollectButton from "@/components/CollectButton";
import PageHeader from "@/components/PageHeader";
import StatusChip from "@/components/StatusChip";
import { fetchJson } from "@/lib/api";
import { duration, formatTime, plural } from "@/lib/format";
import { stageWord, usePipeline } from "@/lib/pipeline";

type RunRow = {
  id: string;
  status: string;
  stage?: string;
  run_start_date_time: string;
  run_end_date_time: string | null;
  error: string | null;
  incomplete?: number;
  totals: {
    sources: number; pages_visited: number; documents: number; new_documents: number;
    signals?: number; other_signals?: number; set_aside?: number;
  };
};

export default function RunsPage() {
  const router = useRouter();
  const p = usePipeline();
  const [runs, setRuns] = useState<RunRow[] | null>(null);
  const [error, setError] = useState<unknown>(null);

  // the table reloads when the latest collection moves on
  const latest = p ? `${p.collect.run_id}:${p.collect.status}:${p.collect.stage}:${p.collect.pages}` : "";
  useEffect(() => {
    fetchJson<{ runs: RunRow[] }>("/api/runs")
      .then((d) => { setRuns(d.runs); setError(null); })
      .catch(setError);
  }, [latest]);

  return (
    <div>
      <PageHeader eyebrow="Operations" title="Collections" right={<CollectButton label="Start a collection" />}
        intro="Every collection: one pass over all switched-on sources for new and changed pages."
        help={<>
          <li>Websites are crawled page by page; data sources run their saved searches. Only new or changed pages
            are analysed, at about one model call each; unchanged pages cost nothing.</li>
          <li>Pages saved · new or changed: pages kept from the collection, and how many were new or had changed.
            ◐ marks websites that reached the page limit set in Crawl settings.</li>
          <li>Findings · set aside: findings on its new or changed pages, and pages set aside by a Can ignore rule
            (kept, but not used for technologies or assessments). The counts are as of the collection.</li>
          <li>Click a collection for its detail, source by source. Start a collection asks before anything
            starts.</li>
        </>}>
        {runs && <p className="mt-1 text-sm text-muted">{plural(runs.length, "collection")}</p>}
      </PageHeader>

      {error != null && <BackendError error={error} />}

      {runs && (
        <div className="mt-6 overflow-x-auto rounded-card border border-line bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-neutral-200 text-left font-mono text-[11px] uppercase tracking-wider text-neutral-500">
                <th className="px-4 py-2.5 font-medium">Collection</th>
                <th className="px-4 py-2.5 font-medium">Status</th>
                <th className="px-4 py-2.5 font-medium">Started</th>
                <th className="px-4 py-2.5 font-medium">Took</th>
                <th className="px-4 py-2.5 font-medium">Sources</th>
                <th className="px-4 py-2.5 font-medium">Pages saved · new or changed</th>
                <th className="px-4 py-2.5 font-medium" title="Pages set aside are kept, but not used for technologies or assessments">
                  Findings · set aside
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {runs.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-6 text-neutral-500">
                    Nothing collected yet. Start a collection.
                  </td>
                </tr>
              )}
              {runs.map((r) => (
                <tr key={r.id} onClick={() => router.push(`/admin/runs/${r.id}`)}
                  className="cursor-pointer hover:bg-neutral-50">
                  <td className="px-4 py-2.5 font-mono text-xs">{r.id}</td>
                  <td className="px-4 py-2.5">
                    <StatusChip status={r.status} />
                    {(r.status === "running" || r.status === "terminating") && r.stage && (
                      <span className="ml-2 font-mono text-[11px]">{stageWord(r.stage)}</span>
                    )}
                    {(r.incomplete ?? 0) > 0 && (
                      <span className="ml-2 text-xs text-muted">◐ {plural(r.incomplete ?? 0, "website")} reached the page limit</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5">{formatTime(r.run_start_date_time)}</td>
                  <td className="px-4 py-2.5 font-mono text-xs">
                    {duration(r.run_start_date_time, r.run_end_date_time)}
                  </td>
                  <td className="px-4 py-2.5">{r.totals?.sources ?? 0}</td>
                  <td className="px-4 py-2.5">
                    {r.totals?.documents ?? 0}
                    <span className="text-neutral-500"> · {r.totals?.new_documents ?? 0} new</span>
                  </td>
                  <td className="px-4 py-2.5 text-xs">
                    {r.totals?.signals === undefined ? "—" : (
                      <>
                        {plural(r.totals.signals + (r.totals.other_signals ?? 0), "finding")}
                        <span className="text-neutral-500"> · {r.totals.set_aside ?? 0} set aside</span>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
