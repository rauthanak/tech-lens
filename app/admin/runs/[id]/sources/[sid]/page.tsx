"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import BackendError from "@/components/BackendError";
import Hood from "@/components/Hood";
import PageHeader from "@/components/PageHeader";
import SignalItem from "@/components/SignalItem";
import SignalPanel from "@/components/SignalPanel";
import TechnicalDetailsSwitch from "@/components/TechnicalDetailsSwitch";
import { fetchJson } from "@/lib/api";
import { formatTime } from "@/lib/format";
import type { AnalysisError, Hit } from "@/lib/signals";

type Doc = {
  id: string;
  end_url: string;
  depth?: number;
  kind?: string;
  title?: string | null;
  published_date?: string | null;
  scraped_at: string;
  is_stub: boolean;
  ref_doc_id?: string | null; // a stub's earlier page, which holds its signals
  summary_text: string | null;
  summary_from_previous_runs: string | null;
  extracted_text?: string | null;
  text_pruned?: boolean;
  technologies?: string[];
  scout_take?: string | null;
  signals?: Hit[];
  ignored_by?: string | null;
  parts?: number | null;
  partial?: boolean;
  analysis_error?: AnalysisError | null;
};

/** The reason a page couldn't be analysed, in one sentence. */
function failureText(e: AnalysisError): string {
  if (e.reason === "some parts failed") return `Partly analysed: ${e.detail}.`;
  return `Couldn't be analysed: ${e.reason}${e.detail ? ` (${e.detail})` : ""}.`;
}

type Run = {
  id: string;
  sources: { source_id: string; source_name: string; source_url: string; category: string }[];
};

const PAGE = 10; // full texts are heavy — page them

export default function Page() {
  return (
    <Suspense>
      <RunSourcePage />
    </Suspense>
  );
}

function RunSourcePage() {
  const { id, sid } = useParams<{ id: string; sid: string }>();
  const [docs, setDocs] = useState<Doc[] | null>(null);
  const [total, setTotal] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);
  const [run, setRun] = useState<Run | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [rules, setRules] = useState<Record<string, string>>({});

  const fetchPage = (skip: number) =>
    fetchJson<{ documents: Doc[]; total: number }>(
      `/api/runs/${id}/documents?source_id=${sid}&include_text=true&limit=${PAGE}&skip=${skip}`,
    );

  useEffect(() => {
    fetchPage(0)
      .then((d) => { setDocs(d.documents); setTotal(d.total); })
      .catch(setError);
    fetchJson<Run>(`/api/runs/${id}`).then(setRun).catch(() => {});
    fetchJson<{ signals: { _id: string; name: string }[] }>("/api/signals")
      .then((d) => setRules(Object.fromEntries(d.signals.map((r) => [r._id, r.name]))))
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, sid]);

  const loadMore = () => {
    setLoadingMore(true);
    fetchPage(docs?.length ?? 0)
      .then((d) => { setDocs((prev) => [...(prev ?? []), ...d.documents]); setTotal(d.total); })
      .catch(setError)
      .finally(() => setLoadingMore(false));
  };

  const source = run?.sources.find((s) => s.source_id === sid);

  return (
    <div>
      <PageHeader eyebrow={`Collection ${id}`} title={source?.source_name ?? sid} right={<TechnicalDetailsSwitch />}
        intro="Every page this source gave in one collection, and what the radar made of each."
        help={<>
          <li>Pages are in the order they were collected. Each shows its type, its crawl depth (0 is a start page),
            when it was collected and published, and the technology names first found on it.</li>
          <li>&ldquo;Unchanged since previous run&rdquo;: the page hadn&apos;t changed, so it cost no model call and
            reuses the earlier analysis. &ldquo;Set aside&rdquo;: a Can ignore rule matched it, so it&apos;s kept but
            not used for technologies or assessments.</li>
          <li>Click a finding for its details and source. Beside each page are its summary and the model&apos;s own
            read of it (Scout&apos;s take).</li>
          <li>&ldquo;Couldn&apos;t be analysed&rdquo; and &ldquo;Partly analysed&rdquo; give the reason; Check again on
            Operations retries them.</li>
        </>}>
        <p className="mt-2 flex flex-wrap items-center gap-3 text-sm text-neutral-600">
          {source && <span className="font-mono text-xs">{source.category}</span>}
          {source && (
            <span className="font-mono text-xs text-neutral-500">{source.source_url}</span>
          )}
          <Link
            href={`/admin/runs/${id}`}
            className="text-link underline underline-offset-4"
          >
            back to the collection
          </Link>
        </p>
      </PageHeader>

      {error != null && <BackendError error={error} />}

      {docs && (
        <div className="mt-7 rounded-card border border-line bg-white">
          {docs.length === 0 && (
            <p className="px-6 py-8 text-sm text-neutral-500">
              No documents were collected from this source in this run.
            </p>
          )}
          {docs.map((d, i) => (
            <div
              key={d.id}
              className={`flex flex-col gap-6 px-6 py-5 md:flex-row ${i > 0 ? "border-t border-neutral-100" : ""}`}
            >
              {/* left 65% — the article itself */}
              <div className="flex min-w-0 flex-col md:w-[65%]">
                <div className="font-medium leading-snug">
                  {d.title || d.end_url.replace(/^https?:\/\//, "")}
                </div>
                <a
                  href={d.end_url}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-0.5 block break-all font-mono text-xs text-link hover:underline"
                >
                  {d.end_url}
                </a>
                <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-[11px] text-neutral-500">
                  <span className="bg-neutral-100 px-1.5 py-0.5 uppercase">
                    {d.kind ?? "article"}
                  </span>
                  <span>depth {d.depth ?? "—"}</span>
                  <span>extracted {formatTime(d.scraped_at)}</span>
                  {d.published_date && <span>published {d.published_date}</span>}
                  {d.is_stub && (
                    <span className="text-ink">unchanged since previous run</span>
                  )}
                  {d.ignored_by && (
                    <span className="bg-neutral-200 px-1.5 py-0.5 text-neutral-700"
                      title="Kept for checking; excluded from technologies and scoring">
                      Set aside: {rules[d.ignored_by] ?? d.ignored_by}
                    </span>
                  )}
                  {(d.analysis_error || d.partial) && (
                    d.analysis_error && d.analysis_error.reason !== "some parts failed"
                      ? <span className="bg-failed/10 px-1.5 py-0.5 text-failed">Couldn&apos;t be analysed</span>
                      : <span className="bg-neutral-100 px-1.5 py-0.5 text-ink">◐ Partly analysed</span>
                  )}
                  <Hood>
                    {(d.parts ?? 0) > 1 && <span>split into {d.parts} parts</span>}
                  </Hood>
                </div>
                {d.analysis_error && (
                  <p className="mt-1.5 text-xs text-failed">
                    {failureText(d.analysis_error)} Check again retries it.{" "}
                    <span className="font-mono text-[11px] text-neutral-500">{formatTime(d.analysis_error.at)}</span>
                  </p>
                )}
                {(d.technologies?.length ?? 0) > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {d.technologies!.map((t) => (
                      <span
                        key={t}
                        className="rounded-full bg-navy/5 px-2 py-0.5 text-[11px] text-ink"
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                )}
                {(d.signals?.length ?? 0) > 0 && (
                  <div className="mt-2 divide-y divide-neutral-100 overflow-hidden rounded-md border border-neutral-100">
                    {d.signals!.map((h, n) => (
                      <SignalItem key={n} withTechnologies={false} item={{
                        ...h, n,
                        // only non-stub pages are found by doc_id: a stub's signals live on its earlier page
                        doc_id: (d.is_stub && d.ref_doc_id) || d.id,
                        url: d.end_url, title: d.title ?? null, source_id: sid, run_id: id,
                        scraped_at: d.scraped_at, published_date: d.published_date ?? null, older: false,
                        technologies: [], technology_ids: [], // the page shows its own above
                      }} />
                    ))}
                  </div>
                )}
                {d.extracted_text ? (
                  /* grows to match the summary column's height (the scroller is
                     absolutely positioned so long text never inflates the row);
                     min-h-60 keeps a readable box when the summary is short */
                  <div className="relative mt-3 min-h-60 flex-1 overflow-hidden rounded-lg border border-line bg-ground">
                    <div className="article-scroll absolute inset-0 overflow-y-auto px-4 py-3.5 pb-6 text-sm leading-relaxed text-neutral-700 whitespace-pre-wrap">
                      {d.extracted_text}
                    </div>
                    <div
                      aria-hidden
                      className="pointer-events-none absolute inset-x-0 bottom-0 h-7 bg-gradient-to-t from-ground to-transparent"
                    />
                  </div>
                ) : d.text_pruned ? (
                  <p className="mt-3 font-mono text-[11px] text-neutral-400">
                    full text aged out by retention — summary retained
                  </p>
                ) : null}
              </div>

              {/* thin fading separator */}
              <div
                aria-hidden
                className="hidden w-px self-stretch bg-gradient-to-b from-transparent via-neutral-300 to-transparent md:block"
              />

              {/* right — the summary */}
              <div className="min-w-0 flex-1">
                <div className="font-mono text-[11px] uppercase tracking-wider text-neutral-500">
                  Summary
                </div>
                <p className="mt-1.5 text-sm leading-relaxed text-neutral-700">
                  {d.summary_text ?? "—"}
                </p>
                {d.scout_take && (
                  <div className="mt-3 border-l-2 border-navy/30 pl-3">
                    <div className="font-mono text-[11px] uppercase tracking-wider text-neutral-500">
                      Scout&apos;s take
                    </div>
                    <p className="mt-1 text-sm italic leading-relaxed text-neutral-600">
                      {d.scout_take}
                    </p>
                  </div>
                )}
                {d.summary_from_previous_runs && !d.is_stub && (
                  <details className="mt-2">
                    <summary className="cursor-pointer font-mono text-[11px] text-neutral-500">
                      summary from previous runs
                    </summary>
                    <p className="mt-1 text-sm leading-relaxed text-neutral-500">
                      {d.summary_from_previous_runs}
                    </p>
                  </details>
                )}
              </div>
            </div>
          ))}
          {docs.length < total && (
            <div className="border-t border-neutral-100 px-6 py-3">
              <button
                onClick={loadMore}
                disabled={loadingMore}
                className="rounded-full border border-line bg-white px-3 py-1.5 text-sm hover:bg-neutral-100 disabled:opacity-50"
              >
                {loadingMore ? "Loading…" : `Load more (${docs.length} of ${total})`}
              </button>
            </div>
          )}
        </div>
      )}
      <SignalPanel />
    </div>
  );
}
