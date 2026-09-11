"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import BackendError from "@/components/BackendError";
import PageHeader from "@/components/PageHeader";
import { ApiError, fetchJson, sendJson } from "@/lib/api";
import { formatTime } from "@/lib/format";

type Tech = {
  _id: string;
  name: string;
  enabled: boolean;
  aliases: string[];
  doc_count?: number;
  page_count?: number;
  source_count?: number;
  horizons?: Record<string, number>;
  kinds?: Record<string, number>;
};

type Doc = {
  id: string;
  end_url: string;
  title?: string | null;
  kind?: string;
  category?: string;
  source_id?: string;
  run_id?: string;
  scraped_at: string;
  published_date?: string | null;
  is_stub: boolean;
  summary_text: string | null;
  technologies?: string[];
};

export default function TechnologyPage() {
  const { id } = useParams<{ id: string }>();
  const [tech, setTech] = useState<Tech | null>(null);
  const [docs, setDocs] = useState<Doc[] | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [rename, setRename] = useState("");
  const [alias, setAlias] = useState("");
  const [mergeName, setMergeName] = useState("");
  const [total, setTotal] = useState(0);

  const load = useCallback(() => {
    fetchJson<Tech>(`/api/technologies/${id}`)
      .then((t) => {
        setTech(t);
        setRename(t.name);
      })
      .catch(setError);
    fetchJson<{ documents: Doc[]; total: number }>(`/api/technologies/${id}/documents`)
      .then((d) => {
        setDocs(d.documents);
        setTotal(d.total);
      })
      .catch(setError);
  }, [id]);

  const loadMore = () =>
    fetchJson<{ documents: Doc[]; total: number }>(
      `/api/technologies/${id}/documents?skip=${docs?.length ?? 0}`,
    )
      .then((d) => {
        setDocs((prev) => [...(prev ?? []), ...d.documents]);
        setTotal(d.total);
      })
      .catch(setError);

  useEffect(() => {
    load();
  }, [load]);

  async function act(fn: () => Promise<unknown>, done: string) {
    setNotice(null);
    try {
      await fn();
      setNotice(done);
      load();
    } catch (e) {
      setNotice(e instanceof ApiError ? (e.detail ?? e.message) : "failed");
    }
  }

  return (
    <div>
      <PageHeader eyebrow="Technology" title={tech?.name ?? id}>
        <p className="mt-2 flex flex-wrap items-center gap-3 text-sm text-neutral-600">
          {tech && (
            <span className="font-mono text-xs text-neutral-500">
              {tech.doc_count ?? 0} docs · {tech.page_count ?? 0} pages ·{" "}
              {tech.source_count ?? 0} sources
            </span>
          )}
          <Link href="/admin/technologies" className="text-[var(--accent)] underline underline-offset-4">
            back to technologies
          </Link>
        </p>
      </PageHeader>

      {error != null && <BackendError error={error} />}
      {notice && <p className="mt-3 font-mono text-xs text-[#7a3c1e]">{notice}</p>}

      {tech && (
        <div className="mt-6 border border-neutral-200 bg-white px-5 py-4">
          <div className="font-mono text-[11px] uppercase tracking-wider text-neutral-500">
            Aliases — the raw strings resolved into this technology
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {tech.aliases.map((a) => (
              <span key={a}
                className="rounded-full bg-[#8a4b2d]/10 px-2 py-0.5 text-[11px] text-[#7a3c1e]">
                {a}
              </span>
            ))}
          </div>
          <div className="mt-4 flex flex-wrap items-end gap-x-6 gap-y-3 border-t border-neutral-100 pt-4 text-sm">
            <label>
              Rename
              <input
                className="mt-1 block w-56 rounded border border-neutral-300 px-3 py-1.5 text-sm outline-none focus:border-neutral-500"
                value={rename} onChange={(e) => setRename(e.target.value)} />
            </label>
            <button
              onClick={() =>
                act(() => sendJson(`/api/technologies/${id}`, "PUT",
                  { name: rename, enabled: tech.enabled }), "renamed — documents restamped")}
              className="border border-neutral-300 px-3 py-1.5 hover:bg-neutral-100">
              Save name
            </button>
            <label>
              Claim an alias from another technology
              <input
                className="mt-1 block w-56 rounded border border-neutral-300 px-3 py-1.5 text-sm outline-none focus:border-neutral-500"
                placeholder="exact raw string" value={alias}
                onChange={(e) => setAlias(e.target.value)} />
            </label>
            <button
              onClick={() =>
                act(() => sendJson(`/api/technologies/${id}/claim_alias`, "POST",
                  { alias: alias.trim() }), "alias claimed — documents restamped")}
              disabled={!alias.trim()}
              className="border border-neutral-300 px-3 py-1.5 hover:bg-neutral-100 disabled:opacity-50">
              Claim
            </button>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={tech.enabled}
                onChange={(e) =>
                  act(() => sendJson(`/api/technologies/${id}`, "PUT",
                    { name: tech.name, enabled: e.target.checked }), "saved")} />
              Enabled — assessed in scoring runs
            </label>
          </div>
          <div className="mt-4 flex flex-wrap items-end gap-x-6 gap-y-3 border-t border-neutral-100 pt-4 text-sm">
            <label>
              Merge another technology into this one
              <input
                className="mt-1 block w-72 rounded border border-neutral-300 px-3 py-1.5 text-sm outline-none focus:border-neutral-500"
                placeholder="its exact name, e.g. ai agents" value={mergeName}
                onChange={(e) => setMergeName(e.target.value)} />
            </label>
            <button
              onClick={() =>
                act(() => sendJson(`/api/technologies/${id}/merge`, "POST",
                  { others: [mergeName.trim()] }),
                  `merged — this name (${tech.name}) survives, documents restamped`)}
              disabled={!mergeName.trim()}
              className="border border-neutral-300 px-3 py-1.5 hover:bg-neutral-100 disabled:opacity-50">
              Merge into {tech.name}
            </button>
            <span className="pb-2 text-xs text-neutral-500">
              its aliases move here, its entry disappears, this document list becomes the union
            </span>
          </div>
        </div>
      )}

      {docs && (
        <div className="mt-6 divide-y divide-neutral-100 border border-neutral-200 bg-white">
          {docs.map((d) => (
            <div key={d.id} className="px-5 py-3.5">
              <div className="flex items-baseline gap-3">
                <span className="min-w-0 flex-1 truncate font-medium">
                  {d.title || d.end_url.replace(/^https?:\/\//, "")}
                </span>
                <span className="shrink-0 bg-neutral-100 px-1.5 py-0.5 font-mono text-[11px] uppercase text-neutral-600">
                  {d.kind ?? "article"}
                </span>
                <span className="shrink-0 font-mono text-[11px] text-neutral-500">{d.category}</span>
              </div>
              <a href={d.end_url} target="_blank" rel="noreferrer"
                className="mt-0.5 block truncate font-mono text-xs text-[var(--accent)] hover:underline">
                {d.end_url}
              </a>
              {d.summary_text && (
                <p className="mt-1.5 text-sm leading-relaxed text-neutral-600">{d.summary_text}</p>
              )}
              <div className="mt-1.5 flex flex-wrap gap-x-4 font-mono text-[11px] text-neutral-500">
                <span>{d.source_id}</span>
                <span>extracted {formatTime(d.scraped_at)}</span>
                {d.published_date && <span>published {d.published_date}</span>}
                {d.run_id && (
                  <Link href={`/admin/runs/${d.run_id}`} className="hover:underline">
                    run {d.run_id}
                  </Link>
                )}
              </div>
            </div>
          ))}
          {docs.length === 0 && (
            <p className="px-5 py-6 text-sm text-neutral-500">No documents stamped with this technology.</p>
          )}
        </div>
      )}
      {docs && docs.length < total && (
        <button
          onClick={loadMore}
          className="mt-3 border border-neutral-300 bg-white px-4 py-2 text-sm hover:bg-neutral-100"
        >
          Load more ({docs.length} of {total})
        </button>
      )}
    </div>
  );
}
