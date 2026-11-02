"use client";

import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import BackendError from "@/components/BackendError";
import Hood from "@/components/Hood";
import ListEditor from "@/components/ListEditor";
import PageHeader from "@/components/PageHeader";
import SavedNote from "@/components/SavedNote";
import { clusterName } from "@/components/SourceBrowser";
import { configChanged, errorText, fetchJson, sendJson } from "@/lib/api";
import { readingLine } from "@/lib/crawl";
import { formatTime } from "@/lib/format";
import BackLink from "@/components/BackLink";

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
  pages?: number; // its own page budget; absent: the default
  progress?: Progress[];
  updated_at?: string;
};

type Adapter = { name: string; label: string; search_help: string; example: string; keys: string[]; configured: boolean };
type Horizons = Record<string, { label?: string; meaning?: string }>;
type Crawl = { pages_per_source: number; link_depth?: number; links_per_level?: number | null };

const field =
  "mt-1 w-full rounded border border-neutral-300 bg-white px-3 py-1.5 text-sm outline-none focus:border-neutral-500 disabled:bg-neutral-50 disabled:text-neutral-500";
const label = "block text-sm font-medium";
const help = "mt-0.5 block text-xs font-normal text-neutral-500";

// Add source opens this page at /admin/sources/new: an empty form that adds
const NEW: Source = { source_id: "", name: "", url: "", horizon: "H2", cluster: "analysts_trade_press", cost: "free",
  enabled: true, access: "crawl" };
/** The id the API makes from a name: "Converge Digest" → converge_digest. */
const idOf = (name: string) => name.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 60);

export default function SourceEditorPage() {
  const { id } = useParams<{ id: string }>();
  const isNew = id === "new";
  const router = useRouter();
  const added = useSearchParams().get("added") === "1"; // just added: the Add form brought the admin here
  const [form, setForm] = useState<Source | null>(isNew ? NEW : null);
  const [adapters, setAdapters] = useState<Adapter[]>([]);
  const [adaptersError, setAdaptersError] = useState<string | null>(null);
  // the horizons' words and the kinds of source in use, from the Sources list
  const [horizons, setHorizons] = useState<Horizons>({});
  const [clusters, setClusters] = useState<string[]>([]);
  const [crawl, setCrawl] = useState<Crawl | null>(null); // the defaults a blank page budget falls back to
  const [error, setError] = useState<unknown>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isNew) fetchJson<Source>(`/api/sources/${id}`).then(setForm).catch(setError);
    fetchJson<Crawl>("/api/settings/crawl").then(setCrawl).catch(() => {});
    fetchJson<Adapter[]>("/api/sources/adapters").then(setAdapters).catch((e) => setAdaptersError(errorText(e)));
    fetchJson<{ horizons: Horizons; sources: { cluster: string }[] }>("/api/sources")
      .then((d) => {
        setHorizons(d.horizons);
        setClusters([...new Set(d.sources.map((s) => s.cluster))].sort((a, b) => clusterName(a).localeCompare(clusterName(b))));
      })
      .catch(() => {});
  }, [id, isNew]);

  const set = (patch: Partial<Source>) => setForm((f) => (f ? { ...f, ...patch } : f));
  const adapter = adapters.find((a) => a.name === form?.adapter) ?? null;
  const access = form?.access ?? "crawl";
  const never = access === "none";

  async function save() {
    if (!form) return;
    setSaving(true);
    setSaveError(null);
    setSaved(false);
    try {
      const added = await sendJson<Source>(isNew ? "/api/sources" : `/api/sources/${id}`, isNew ? "POST" : "PUT", {
        ...(isNew ? { access, adapter: access === "query" ? form.adapter : null } : {}),
        name: form.name,
        url: form.url,
        horizon: form.horizon,
        cluster: form.cluster,
        cost: form.cost,
        enabled: form.enabled,
        note: form.enabled ? "" : (form.note ?? "").trim(), // a reason to be off goes when it's switched on
        pages: Number(form.pages) || 0, // blank: the default
        ...(access === "crawl"
          ? { entry_urls: form.entry_urls ?? [], follow_outbound: Boolean(form.follow_outbound) }
          : {}),
        ...(access === "query" ? { searches: form.searches ?? [] } : {}),
      });
      configChanged();
      setSaved(true);
      if (isNew) router.replace(`/admin/sources/${added.source_id}?added=1`);
    } catch (e) {
      setSaveError(errorText(e));
    } finally {
      setSaving(false);
    }
  }

  const progressFor = (search: string) => form?.progress?.find((p) => p.search === search);

  return (
    <div>
      <Suspense fallback={null}><BackLink fallback="/admin/sources" fallbackLabel="Sources" /></Suspense>
      <PageHeader eyebrow="Sources" title={isNew ? "Add source" : form?.name ?? "Edit source"}
        intro={isNew ? "A website or a data source for the radar to read. It's live as soon as it's saved, and shows on Changes, where Keep as defaults saves it into the seeding data."
          : "How the radar reads this source. Saving costs no model calls and applies from the next collection."}
        help={<>
          <li>Websites: the crawl starts at the start pages, in their order, or at the source&apos;s address when there
            are none, and takes up to its Pages per collection, or when that&apos;s blank the page budget set in Setup › Settings. RSS or Atom feeds work as start
            pages.</li>
          <li>Follow links to other sites, one hop: pages on other sites that this one links to are collected
            too, but their own links aren&apos;t followed.</li>
          <li>Data sources: each saved search runs at every collection. Progress shows how far it has collected and
            what&apos;s still to collect when the page budget ran out; &ldquo;too broad&rdquo; means narrow the
            search.</li>
          <li>Pages per collection: this source&apos;s own page budget; blank uses the default. For a website, the line
            under it says how it will be read (pages, levels of links, links per level, from Settings), in amber when
            a fixed links-per-level can&apos;t reach it. A data source&apos;s saved searches share it.</li>
          <li>Horizon, cost and kind of source organise the list on Sources. Switched on, at the top, decides
            whether the next collection reads it; Save keeps it.</li>
        </>}>
        <p className="mt-2 flex flex-wrap items-center gap-3 text-sm text-neutral-600">
          {form && !isNew && (never ? "Not collected"
            : access === "query" ? `Data source (${adapter?.label ?? form.adapter}): answers its saved searches`
              : "Website, crawled page by page")}
          {!isNew && <Hood><span className="font-mono text-xs text-neutral-500">{id}</span></Hood>}
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
          {!never && (
            <label className={`flex w-fit items-center gap-2 rounded-card border px-4 py-2.5 text-sm ${form.enabled
              ? "border-line bg-white" : "border-amber-200 bg-amber-50 text-amber-900"}`}>
              <input type="checkbox" checked={form.enabled} onChange={(e) => set({ enabled: e.target.checked })} />
              {form.enabled ? "Switched on: the next collection reads this source" : "Switched off: collections skip this source"}
            </label>
          )}
          {!never && !form.enabled && (
            <div className="grid grid-cols-1 gap-x-10 lg:grid-cols-2"><div>
              <label className={label} htmlFor="note">Why it&apos;s off
                <span className={help}>In plain words, for whoever looks next: shown on the Sources list. For example: its robots.txt asks crawlers not to read it.</span>
              </label>
              <input id="note" className={field} value={form.note ?? ""} maxLength={500}
                onChange={(e) => set({ note: e.target.value })} />
            </div></div>
          )}
          <fieldset disabled={never} className="grid grid-cols-1 items-start gap-x-10 gap-y-5 lg:grid-cols-2">
            <div className="space-y-5">
              {isNew && (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className={label} htmlFor="access">What kind</label>
                    <select id="access" className={field} value={access}
                      onChange={(e) => set({ access: e.target.value as Source["access"], adapter: undefined })}>
                      <option value="crawl">Website: the radar reads its pages</option>
                      <option value="query">Data source: saved searches through a connector</option>
                    </select>
                  </div>
                  {access === "query" && (
                    <div>
                      <label className={label} htmlFor="adapter">Connector</label>
                      <select id="adapter" className={field} value={form.adapter ?? ""} required
                        onChange={(e) => set({ adapter: e.target.value })}>
                        <option value="" disabled>Choose…</option>
                        {adapters.map((a) => <option key={a.name} value={a.name}>{a.label}</option>)}
                      </select>
                      {adaptersError && <span className="mt-0.5 block text-xs text-failed">Connectors couldn&apos;t be loaded: {adaptersError}</span>}
                    </div>
                  )}
                </div>
              )}
              <div>
                <label className={label} htmlFor="name">Name</label>
                <input id="name" className={field} value={form.name}
                  onChange={(e) => set({ name: e.target.value })} required />
                {isNew && idOf(form.name) && <span className={help}>Saved as <span className="font-mono">{idOf(form.name)}</span>; the id never changes.</span>}
              </div>

              <div>
                <label className={label} htmlFor="url">URL</label>
                <input id="url" className={`${field} font-mono text-xs`} value={form.url}
                  onChange={(e) => set({ url: e.target.value })} type="url" required />
              </div>

              <div>
                <label className={label} htmlFor="pages">Pages per collection</label>
                <input id="pages" type="number" min={1} max={500} className={`${field} w-32`} value={form.pages ?? ""}
                  placeholder={crawl ? String(crawl.pages_per_source) : ""}
                  onChange={(e) => set({ pages: e.target.value === "" ? undefined : Number(e.target.value) })} />
                <span className={help}>
                  Blank: the default{crawl ? `, ${crawl.pages_per_source} pages` : ""} (Setup › Settings).
                  {access === "query" && " Its saved searches share these pages."}
                </span>
                {crawl && access === "crawl" && (() => {
                  const line = readingLine(form.pages || crawl.pages_per_source, crawl.link_depth ?? 8, crawl.links_per_level ?? null);
                  return <span className={`mt-0.5 block text-xs ${line.short ? "text-amber-800" : "text-neutral-500"}`}>{line.text}</span>;
                })()}
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
                {!isNew && (form.searches ?? []).length > 0 && (
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
          <SavedNote show={saved || added} what={saved ? undefined : "Added and live: the next collection reads it."} />

          <div className="flex items-center gap-3">
            {!never && (
              <button type="submit" disabled={saving}
                className="rounded-full bg-navy px-4 py-2 text-sm font-medium text-white hover:bg-navy-strong disabled:opacity-50">
                {saving ? "Saving…" : isNew ? "Add source" : "Save"}
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
