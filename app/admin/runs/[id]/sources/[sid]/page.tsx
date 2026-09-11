"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import BackendError from "@/components/BackendError";
import PageHeader from "@/components/PageHeader";
import { fetchJson } from "@/lib/api";
import { formatTime } from "@/lib/format";

type Doc = {
  id: string;
  end_url: string;
  depth?: number;
  kind?: string;
  title?: string | null;
  published_date?: string | null;
  scraped_at: string;
  is_stub: boolean;
  summary_text: string | null;
  summary_from_previous_runs: string | null;
  extracted_text?: string | null;
  text_pruned?: boolean;
  technologies?: string[];
  scout_take?: string | null;
};

type Run = {
  id: string;
  sources: { source_id: string; source_name: string; source_url: string; category: string }[];
};

const PAGE = 10; // full texts are heavy — page them

export default function RunSourcePage() {
  const { id, sid } = useParams<{ id: string; sid: string }>();
  const [docs, setDocs] = useState<Doc[] | null>(null);
  const [total, setTotal] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);
  const [run, setRun] = useState<Run | null>(null);
  const [error, setError] = useState<unknown>(null);

  const fetchPage = (skip: number) =>
    fetchJson<{ documents: Doc[]; total: number }>(
      `/api/runs/${id}/documents?source_id=${sid}&include_text=true&limit=${PAGE}&skip=${skip}`,
    );

  useEffect(() => {
    fetchPage(0)
      .then((d) => { setDocs(d.documents); setTotal(d.total); })
      .catch(setError);
    fetchJson<Run>(`/api/runs/${id}`).then(setRun).catch(() => {});
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
      <PageHeader eyebrow={`Run ${id}`} title={source?.source_name ?? sid}>
        <p className="mt-2 flex flex-wrap items-center gap-3 text-sm text-neutral-600">
          {source && <span className="font-mono text-xs">{source.category}</span>}
          {source && (
            <span className="font-mono text-xs text-neutral-500">{source.source_url}</span>
          )}
          <Link
            href={`/admin/runs/${id}`}
            className="text-[var(--accent)] underline underline-offset-4"
          >
            back to run
          </Link>
        </p>
      </PageHeader>

      {error != null && <BackendError error={error} />}

      {docs && (
        <div className="mt-7 border border-neutral-200 bg-white">
          {docs.length === 0 && (
            <p className="px-6 py-8 text-sm text-neutral-500">
              No documents were collected from this source in this run.
            </p>
          )}
          {docs.map((d, i) => (
            <div
              key={d.id}
              className={`flex gap-6 px-6 py-5 ${i > 0 ? "border-t border-neutral-100" : ""}`}
            >
              {/* left 65% — the article itself */}
              <div className="flex w-[65%] min-w-0 flex-col">
                <div className="font-medium leading-snug">
                  {d.title || d.end_url.replace(/^https?:\/\//, "")}
                </div>
                <a
                  href={d.end_url}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-0.5 block break-all font-mono text-xs text-[var(--accent)] hover:underline"
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
                    <span className="text-amber-700">unchanged since previous run</span>
                  )}
                </div>
                {(d.technologies?.length ?? 0) > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {d.technologies!.map((t) => (
                      <span
                        key={t}
                        className="rounded-full bg-[#8a4b2d]/10 px-2 py-0.5 text-[11px] text-[#7a3c1e]"
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                )}
                {d.extracted_text ? (
                  /* grows to match the summary column's height (the scroller is
                     absolutely positioned so long text never inflates the row);
                     min-h-60 keeps a readable box when the summary is short */
                  <div className="relative mt-3 min-h-60 flex-1 overflow-hidden rounded-lg border border-neutral-200/80 bg-gradient-to-b from-white to-[#faf9f7] shadow-[inset_0_1px_3px_rgba(28,26,23,0.06),0_1px_2px_rgba(28,26,23,0.04)]">
                    <div className="article-scroll absolute inset-0 overflow-y-auto px-4 py-3.5 pb-6 text-sm leading-relaxed text-neutral-700 whitespace-pre-wrap">
                      {d.extracted_text}
                    </div>
                    <div
                      aria-hidden
                      className="pointer-events-none absolute inset-x-0 bottom-0 h-7 bg-gradient-to-t from-[#faf9f7] to-transparent"
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
                className="w-px self-stretch bg-gradient-to-b from-transparent via-neutral-300 to-transparent"
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
                  <div className="mt-3 border-l-2 border-[#8a4b2d]/30 pl-3">
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
                className="border border-neutral-300 bg-white px-3 py-1.5 text-sm hover:bg-neutral-100 disabled:opacity-50"
              >
                {loadingMore ? "Loading…" : `Load more (${docs.length} of ${total})`}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
