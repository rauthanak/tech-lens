"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import BackendError from "@/components/BackendError";
import Hood from "@/components/Hood";
import ListEditor from "@/components/ListEditor";
import PageHeader from "@/components/PageHeader";
import SavedNote from "@/components/SavedNote";
import { clusterName } from "@/components/SourceBrowser";
import { configChanged, errorText, fetchJson, sendJson } from "@/lib/api";
import { formatTime } from "@/lib/format";

type Progress = {
  search: string;
  through?: string;
  remaining?: number;
  too_broad?: boolean;
  checked_at?: string;
  last_count?: number | null;
  error?: string;
};

type Source = {
  source_id: string;
  name: string;
  url: string;
  horizon: "H1" | "H2" | "H3";
  cluster: string;
  cost: string;
  enabled: boolean;
  access?: "crawl" | "query" | "none";
  entry_urls?: string[];
  follow_outbound?: boolean;
  adapter?: string;
  searches?: string[];
  note?: string;
  progress?: Progress[];
  updated_at?: string;
};

type Adapter = { name: string; label: string; search_help: string; example: string; keys: string[]; configured: boolean };
type Horizons = Record<string, { label?: string; meaning?: string }>;

const field =
  "mt-1 w-full rounded border border-neutral-300 bg-white px-3 py-1.5 text-sm outline-none focus:border-neutral-500 disabled:bg-neutral-50 disabled:text-neutral-500";
const label = "block text-sm font-medium";
const help = "mt-0.5 block text-xs font-normal text-neutral-500";

export default function SourceEditorPage() {
  const { id } = useParams<{ id: string }>();
  const [form, setForm] = useState<Source | null>(null);
  const [adapter, setAdapter] = useState<Adapter | null>(null);
  // the horizons' words and the kinds of source in use, from the Sources list
  const [horizons, setHorizons] = useState<Horizons>({});
  const [clusters, setClusters] = useState<string[]>([]);
  const [error, setError] = useState<unknown>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchJson<Source>(`/api/sources/${id}`)
      .then((s) => {
        setForm(s);
        if (s.access === "query" && s.adapter)
          fetchJson<Adapter[]>("/api/sources/adapters")
            .then((list) => setAdapter(list.find((a) => a.name === s.adapter) ?? null))
            .catch(() => {});
      })
      .catch(setError);
    fetchJson<{ horizons: Horizons; sources: { cluster: string }[] }>("/api/sources")
      .then((d) => {
        setHorizons(d.horizons);
        setClusters([...new Set(d.sources.map((s) => s.cluster))].sort((a, b) => clusterName(a).localeCompare(clusterName(b))));
      })
      .catch(() => {});
  }, [id]);

  const set = (patch: Partial<Source>) => setForm((f) => (f ? { ...f, ...patch } : f));
  const access = form?.access ?? "crawl";
  const never = access === "none";

  async function save() {
    if (!form) return;
    setSaving(true);
    setSaveError(null);
    setSaved(false);
    try {
      await sendJson(`/api/sources/${id}`, "PUT", {
        name: form.name,
        url: form.url,
        horizon: form.horizon,
        cluster: form.cluster,
        cost: form.cost,
        enabled: form.enabled,
        ...(access === "crawl"
          ? { entry_urls: form.entry_urls ?? [], follow_outbound: Boolean(form.follow_outbound) }
          : {}),
        ...(access === "query" ? { searches: form.searches ?? [] } : {}),
      });
      configChanged();
      setSaved(true);
    } catch (e) {
      setSaveError(errorText(e));
    } finally {
      setSaving(false);
    }
  }

  const progressFor = (search: string) => form?.progress?.find((p) => p.search === search);

  return (
    <div>
      <PageHeader eyebrow="Sources" title={form?.name ?? "Edit source"}
        intro="How the radar reads this source. Saving costs no model calls and applies from the next collection."
        help={<>
          <li>Websites: the crawl starts at the start pages, in their order, or at the source&apos;s address when there
            are none, and takes up to the page budget set in Setup › Settings. RSS or Atom feeds work as start
            pages.</li>
          <li>Follow links to other sites, one hop: pages on other sites that this one links to are collected
            too, but their own links aren&apos;t followed.</li>
          <li>Data sources: each saved search runs at every collection. Progress shows how far it has collected and
            what&apos;s still to collect when the page budget ran out; &ldquo;too broad&rdquo; means narrow the
            search.</li>
          <li>Horizon, cost and kind of source organise the list on Sources. Enabled decides whether the next
            collection reads it.</li>
        </>}>
        <p className="mt-2 flex flex-wrap items-center gap-3 text-sm text-neutral-600">
          {form && (never ? "Not collected"
            : access === "query" ? `Data source (${adapter?.label ?? form.adapter}): answers its saved searches`
              : "Website, crawled page by page")}
          <Hood><span className="font-mono text-xs text-neutral-500">{id}</span></Hood>
        </p>
      </PageHeader>

      {error != null && <BackendError error={error} />}

      {form && never && (
        <p className="mt-6 rounded-card border border-neutral-300 bg-neutral-50 px-4 py-3 text-sm text-neutral-700">
          🔒 This source is never collected{form.note ? `: ${form.note}` : "."} It stays on the Sources list for reference.
        </p>
      )}

      {form && (
        <form className="mt-7 space-y-5" onSubmit={(e) => { e.preventDefault(); save(); }}>
          {/* two columns on wide screens: the register entry, then how it's read */}
          <fieldset disabled={never} className="grid grid-cols-1 items-start gap-x-10 gap-y-5 lg:grid-cols-2">
            <div className="space-y-5">
              <div>
                <label className={label} htmlFor="name">Name</label>
                <input id="name" className={field} value={form.name}
                  onChange={(e) => set({ name: e.target.value })} required />
              </div>

              <div>
                <label className={label} htmlFor="url">URL</label>
                <input id="url" className={`${field} font-mono text-xs`} value={form.url}
                  onChange={(e) => set({ url: e.target.value })} type="url" required />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className={label}>Horizon</span>
                  <div className="mt-1 flex overflow-hidden rounded border border-neutral-300 bg-white text-sm">
                    {(["H1", "H2", "H3"] as const).map((h) => (
                      <button key={h} type="button" onClick={() => set({ horizon: h })} title={horizons[h]?.label}
                        className={`flex-1 px-3 py-1.5 ${form.horizon === h ? "bg-navy font-medium text-white" : "hover:bg-neutral-100"}`}>
                        {h}
                      </button>
                    ))}
                  </div>
                  {horizons[form.horizon]?.label && (
                    <span className={help}>{form.horizon} · {horizons[form.horizon].label}</span>
                  )}
                </div>
                <div>
                  <label className={label} htmlFor="cost">Cost</label>
                  <select id="cost" className={field} value={form.cost} onChange={(e) => set({ cost: e.target.value })}>
                    <option value="free">Free</option>
                    <option value="free_tier">Free up to a limit</option>
                    <option value="licensed">Paid subscription (skipped unless paid sources are allowed)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className={label} htmlFor="cluster">Kind of source <span className="font-normal text-neutral-500">(groups the Sources list)</span></label>
                <select id="cluster" className={field} value={form.cluster} onChange={(e) => set({ cluster: e.target.value })}>
                  {[...new Set([form.cluster, ...clusters])].map((c) => <option key={c} value={c}>{clusterName(c)}</option>)}
                </select>
              </div>

              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={form.enabled} onChange={(e) => set({ enabled: e.target.checked })} />
                Enabled — the radar reads this source
              </label>
            </div>

            {access === "crawl" && (
              <div className="space-y-5">
                <div>
                  <span className={label}>Start pages</span>
                  <span className={help}>Empty means start from the source URL. RSS or Atom feeds work too. Read in this order.</span>
                  <ListEditor ordered items={form.entry_urls ?? []} placeholder="https://…"
                    onChange={(items) => set({ entry_urls: items })} />
                </div>
                <label className="flex items-start gap-2 text-sm">
                  <input type="checkbox" className="mt-1" checked={Boolean(form.follow_outbound)}
                    onChange={(e) => set({ follow_outbound: e.target.checked })} />
                  <span>
                    Follow links to other sites, one hop
                    <span className={help}>For link aggregators such as Hacker News: the linked articles are collected, but not their links.</span>
                  </span>
                </label>
              </div>
            )}

            {access === "query" && (
              <div>
                <span className={label}>Saved searches</span>
                {adapter && (
                  <span className={help}>
                    {adapter.search_help} Example: <span className="font-mono">{adapter.example}</span>
                  </span>
                )}
                {adapter && !adapter.configured && (
                  <span className="mt-1 block bg-neutral-100 px-2 py-1 text-xs">
                    Not configured: set {adapter.keys.join(" and ")} in .env
                  </span>
                )}
                <ListEditor items={form.searches ?? []} placeholder={adapter?.example ?? "a saved search"}
                  onChange={(items) => set({ searches: items })} />
                {(form.searches ?? []).length > 0 && (
                  <div className="mt-3 space-y-1 border-t border-neutral-100 pt-3">
                    <div className="font-mono text-[11px] uppercase tracking-wider text-neutral-500">Progress per search</div>
                    {(form.searches ?? []).map((q) => {
                      const p = progressFor(q);
                      const owed = (p?.remaining ?? 0) > 0 || p?.too_broad;
                      return (
                        <div key={q} className="text-xs">
                          <span className="font-mono">{q}</span>
                          <span className={`ml-2 ${owed ? "text-ink" : "text-neutral-500"}`}>
                            {!p ? "not run yet" : [
                              p.through ? `collected through ${p.through}` : null,
                              p.last_count != null ? `${p.last_count} open at the last run` : null,
                              (p.remaining ?? 0) > 0 ? `${p.remaining} still to collect` : null,
                              p.too_broad ? "too broad: narrow the search" : null,
                              p.checked_at ? `checked ${formatTime(p.checked_at)}` : null,
                            ].filter(Boolean).join(" · ")}
                          </span>
                          {owed && <span className="ml-2">— raise the page budget or narrow the search.</span>}
                          {p?.error && <span className="ml-2 text-failed">error: {p.error}</span>}
                        </div>
                      );
                    })}
                    <p className="text-[11px] text-neutral-500">Removing a search also removes its progress.</p>
                  </div>
                )}
              </div>
            )}

          </fieldset>

          {saveError && <p className="text-sm text-failed">Save failed: {saveError}</p>}
          <SavedNote show={saved} />

          <div className="flex items-center gap-3">
            {!never && (
              <button type="submit" disabled={saving}
                className="rounded-full bg-navy px-4 py-2 text-sm font-medium text-white hover:bg-navy-strong disabled:opacity-50">
                {saving ? "Saving…" : "Save"}
              </button>
            )}
            <Link href="/admin/sources" className="px-2 py-2 text-sm text-neutral-600 hover:text-black">
              {never ? "Back" : "Cancel"}
            </Link>
          </div>
        </form>
      )}
    </div>
  );
}
