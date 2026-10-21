"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Fragment, Suspense, useCallback, useEffect, useRef, useState } from "react";
import BackendError from "@/components/BackendError";
import GateList from "@/components/GateList";
import PageHeader from "@/components/PageHeader";
import PublishEdition from "@/components/PublishEdition";
import SignalItem from "@/components/SignalItem";
import SignalPanel from "@/components/SignalPanel";
import { fetchRunsPreview, type RunsPreview } from "@/lib/actions";
import { fetchJson } from "@/lib/api";
import { formatDay, plural } from "@/lib/format";
import { useMedia } from "@/lib/media";
import { usePipeline } from "@/lib/pipeline";
import type { BriefingSummary, FoundHit, FoundResponse } from "@/lib/signals";
import { useTechLabel } from "@/lib/tech-labels";

// The Briefing: everything a window of collecting, or one collection, found,
// in one list. Recent findings come first, in the signal list's order, then
// other findings; older articles (published more than 30 days before they
// were collected) come last. The address holds what you see, so links and
// back links return to it: days or run (the scope), type, tech, source and
// signal (the side panel) — the names the Signals page used.

const WINDOWS = [
  { days: "7", label: "Last 7 days" },
  { days: "30", label: "Last 30 days" },
  { days: "90", label: "Last 90 days" },
  { days: "all", label: "All time" },
];
const PAGE = 20;

/** A query string from the values that are set. */
const query = (values: Record<string, string | null>) =>
  new URLSearchParams(Object.entries(values).filter((e): e is [string, string] => !!e[1])).toString();

/** A collection's state in a few words; a stop or failure says why. */
function runState(scope: { status: string; error: string | null }): string {
  if (scope.status === "completed") return "Completed";
  if (scope.status === "running" || scope.status === "terminating") return "Still collecting";
  if (scope.error === "terminated by user") return "Stopped by you";
  return `${scope.status === "failed" ? "Failed" : "Stopped"}${scope.error ? `: ${scope.error}` : ""}`;
}

function RadarBriefing() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const label = useTechLabel();
  const p = usePipeline();
  // wide screens read a finding in a column beside the list, opened when one is
  // clicked (the list keeps the width until then); narrower ones slide it over
  const wide = useMedia("(min-width: 1440px)");
  const docked = wide && !!params.get("signal");
  const run = params.get("run") ?? "";
  const days = WINDOWS.find((w) => w.days === params.get("days"))?.days ?? "7";
  const type = params.get("type") ?? "";
  const tech = params.get("tech") ?? "";
  const source = params.get("source") ?? "";

  const [summary, setSummary] = useState<BriefingSummary | null>(null);
  const [items, setItems] = useState<FoundHit[] | null>(null);
  const [total, setTotal] = useState(0);
  const [more, setMore] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [sourceName, setSourceName] = useState<string | null>(null);
  const [preview, setPreview] = useState<RunsPreview | null>(null);
  const listToken = useRef(0); // the latest list request: older answers are dropped

  const setParams = (changes: Record<string, string | null>) => {
    const next = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(changes)) {
      if (v) next.set(k, v);
      else next.delete(k);
    }
    next.delete("signal");
    const rest = next.toString();
    router.replace(rest ? `${pathname}?${rest}` : pathname, { scroll: false });
  };

  // the summary: again for a new scope or filter, and when a collection or check finishes
  const finished = p ? `${p.collect.run_id}:${p.collect.status}:${p.signals.recheck?.status ?? ""}` : "";
  useEffect(() => {
    let current = true;
    fetchJson<BriefingSummary>(`/api/briefing?${query({
      ...(run ? { run_id: run } : { days }), tech: tech || null, source_id: source || null })}`)
      .then((s) => { if (current) { setSummary(s); setError(null); } })
      .catch((e) => { if (current) setError(e); });
    return () => { current = false; };
  }, [run, days, tech, source, finished]);

  // the list pages through the summary's fixed scope
  const listUrl = useCallback((s: BriefingSummary, skip: number) => `/api/signals/found?${query({
    sort: "briefing", limit: String(PAGE), skip: String(skip),
    ...("run_id" in s.scope ? { run_id: s.scope.run_id } : { since: s.scope.from, until: s.scope.to }),
    tech: tech || null, source_id: source || null, signal_id: type || null })}`, [tech, source, type]);

  useEffect(() => {
    if (!summary) return;
    const token = ++listToken.current;
    fetchJson<FoundResponse>(listUrl(summary, 0))
      .then((d) => { if (token === listToken.current) { setItems(d.hits); setTotal(d.total); } })
      .catch((e) => { if (token === listToken.current) setError(e); });
  }, [summary, listUrl]);

  const showMore = () => {
    if (!summary || !items) return;
    const token = listToken.current;
    setMore(true);
    fetchJson<FoundResponse>(listUrl(summary, items.length))
      .then((d) => { if (token === listToken.current) { setItems([...items, ...d.hits]); setTotal(d.total); } })
      .catch(setError)
      .finally(() => setMore(false));
  };

  useEffect(() => {
    if (!source) return;
    fetchJson<{ name: string }>(`/api/sources/${encodeURIComponent(source)}`)
      .then((s) => setSourceName(s.name)).catch(() => {});
  }, [source]);

  const neverCollected = p?.collect.status === "none";
  useEffect(() => {
    if (neverCollected) fetchRunsPreview().then(setPreview).catch(() => {});
  }, [neverCollected]);

  const s = summary;
  const scope = s?.scope;
  const runScope = scope && "run_id" in scope ? scope : null;
  const typeRow = s?.types.find((t) => t.signal_id === type);
  const typeName = (id: string) => s?.types.find((t) => t.signal_id === id)?.name ?? id;
  // per band and type, counts for the headers (the summary has them per type)
  const bandCount = (older: boolean) => (typeRow ? (older ? typeRow.older : typeRow.count - typeRow.older)
    : s ? (older ? s.counts.older : s.counts.findings - s.counts.older) : 0);
  const typeCount = (id: string, older: boolean) => {
    const t = s?.types.find((x) => x.signal_id === id);
    return t ? (older ? t.older : t.count - t.older) : 0;
  };

  return (
    <div>
      <PageHeader title="Radar briefing"
        intro="What the radar found on the sources it watches, with your signal types first, in your signal list's order."
        help={<>
          <li>Each row is a finding: one development found on a page, like a funding round, a product launch or a
            partnership. Click it for the details, the quote and the source; a technology tag opens that technology.</li>
          <li>Recent findings were published within 30 days of being collected, or give no publication date (their
            row shows when they were collected instead). Older articles were published earlier and only found
            now.</li>
          <li>Your signal types come first, in the order of your signal list, then Other: notable findings that
            aren&apos;t on the list. Reorder the list in{" "}
            <Link href="/admin/signals/list" className="text-link hover:underline">Setup → Signal list</Link>, at no
            model cost.</li>
          <li>The rail counts each type; click one to show only that type. The window menu sets how far back to look,
            by collection date.</li>
          <li>The three cards at the top are your to-do: what to settle before technologies are scored, what to settle
            before a Point of View goes to leaders, and publishing what leaders see. Closed, each says what waits; click
            its title to open it, and this browser remembers which you left open. Each row counts technologies; its
            sentence opens where it&apos;s done. A row that is one decision is done in place: a run (classify, assess,
            write) shows its model calls and asks before starting, and each possibly nascent technology gets Yes or
            No.</li>
        </>}
        right={!run && (
        <label className="shrink-0">
          <span className="sr-only">Window</span>
          <select value={days} onChange={(e) => setParams({ days: e.target.value === "7" ? null : e.target.value })}
            className="rounded-full border border-line bg-white px-3.5 py-1.5 text-sm text-ink">
            {WINDOWS.map((w) => <option key={w.days} value={w.days}>{w.label}</option>)}
          </select>
        </label>
      )}>
        {s && (
          <p className="mt-2 text-[14.5px] text-muted">
            {runScope && (
              <>Collection of {formatDay(runScope.started_at)} · {runState(runScope)} · </>
            )}
            <b className="font-semibold text-ink">{s.counts.findings.toLocaleString()}</b>{" "}
            {s.counts.findings === 1 ? "finding" : "findings"} from{" "}
            <b className="font-semibold text-ink">{s.counts.pages.toLocaleString()}</b> new or changed{" "}
            {s.counts.pages === 1 ? "page" : "pages"}
            {!runScope && s.freshness && (
              <> · last collected {formatDay(s.freshness.finished_at)} from {plural(s.freshness.sources, "source")}</>
            )}
          </p>
        )}
      </PageHeader>

      {error != null && <BackendError error={error} />}

      {neverCollected ? (
        <div className="mt-8 rounded-card border border-line bg-white px-6 py-5">
          <p className="text-sm">
            Nothing collected yet.{" "}
            {preview && `A collection visits up to ${preview.pages_per_source * preview.websites} pages across ${plural(preview.websites + preview.data_sources, "source")} and finds what's new on each page.`}
          </p>
          <Link href="/admin/operations"
            className="mt-3 inline-block rounded-full bg-navy px-4 py-2 text-sm text-white hover:bg-navy-strong">
            Collect from Operations
          </Link>
        </div>
      ) : (
        <>
          <GateList />
          <div className="mt-3"><PublishEdition /></div>

          {s && (
            <div className={`mt-6 grid grid-cols-1 gap-7 min-[900px]:grid-cols-[240px_minmax(0,1fr)] ${docked
              ? "min-[1440px]:grid-cols-[220px_minmax(0,1fr)_400px] min-[1800px]:grid-cols-[240px_minmax(0,1fr)_460px]" : ""}`}>
              <nav aria-label="Signal types"
                className="min-w-0 min-[900px]:sticky min-[900px]:top-4 min-[900px]:max-h-[calc(100vh-2rem)] min-[900px]:self-start min-[900px]:overflow-y-auto">
                <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">
                  Found in this {runScope ? "collection" : "window"}
                </h2>
                <div className="flex gap-1.5 overflow-x-auto pb-1.5 min-[900px]:grid min-[900px]:gap-px min-[900px]:overflow-visible min-[900px]:pb-0">
                  {[{ signal_id: "", name: "All findings", count: s.counts.findings }, ...s.types].map((t) => {
                    const on = t.signal_id === type;
                    return (
                      <button key={t.signal_id || "all"} type="button" aria-pressed={on}
                        onClick={() => setParams({ type: on || !t.signal_id ? null : t.signal_id })}
                        className={`flex shrink-0 items-baseline justify-between gap-3 rounded-full border px-3 py-1 text-left text-[13px] min-[900px]:rounded-md min-[900px]:border-0 min-[900px]:px-2.5 ${
                          on ? "border-navy bg-navy text-white" : "border-line bg-white hover:bg-ground min-[900px]:bg-transparent"} ${
                          !t.signal_id ? "font-semibold min-[900px]:mb-1.5" : ""} ${t.signal_id === "other" ? "border-dashed min-[900px]:mt-1.5" : ""}`}>
                        <span>{t.name}</span>
                        <span className={`text-xs tabular-nums ${on ? "text-white/75" : "text-muted"}`}>{t.count}</span>
                      </button>
                    );
                  })}
                </div>
              </nav>

              <section aria-label="Findings" className="min-w-0">
                {(type || tech || source || run) && (
                  <div className="mb-3 flex flex-wrap items-center gap-2 text-sm text-muted">
                    Showing
                    {type && <FilterPill label={`${typeName(type)} · ${typeRow?.count ?? 0}`} onRemove={() => setParams({ type: null })} />}
                    {tech && <FilterPill label={`Technology: ${label(tech)}`} onRemove={() => setParams({ tech: null })} />}
                    {source && <FilterPill label={`Source: ${sourceName ?? source}`} onRemove={() => setParams({ source: null })} />}
                    {runScope && <FilterPill label={`Collection of ${formatDay(runScope.started_at)}`} onRemove={() => setParams({ run: null })} />}
                  </div>
                )}

                {items && items.length === 0 && (
                  <div className="rounded-card border border-line bg-white px-6 py-5 text-sm">
                    {type ? `No ${typeName(type)} findings here.`
                      : runScope ? "This collection found nothing new."
                        : `No findings in the ${WINDOWS.find((w) => w.days === days)!.label.toLowerCase()}.`}
                    {!type && !runScope && s.freshness && ` The last collection was ${formatDay(s.freshness.finished_at)}.`}
                    {!type && !runScope && days === "7" && (
                      <button type="button" onClick={() => setParams({ days: "30" })}
                        className="ml-3 rounded-full border border-line bg-white px-3.5 py-1 hover:bg-ground">
                        Show the last 30 days
                      </button>
                    )}
                  </div>
                )}

                {items && items.length > 0 && (
                  <Findings items={items} grouped={!type} typeName={typeName} bandCount={bandCount} typeCount={typeCount} />
                )}

                {items && items.length > 0 && (
                  <div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-muted">
                    {items.length < total ? (
                      <>
                        <button type="button" onClick={showMore} disabled={more}
                          className="rounded-full border border-line bg-white px-4 py-1.5 text-ink hover:bg-ground disabled:opacity-60">
                          {more ? "Loading…" : `Show ${Math.min(PAGE, total - items.length)} more`}
                        </button>
                        {items.length} of {total.toLocaleString()} shown
                      </>
                    ) : `That's all ${plural(total, "finding")}.`}
                  </div>
                )}
              </section>

              {docked && (
                <aside aria-label="Finding details" className="sticky top-4 self-start">
                  <SignalPanel docked />
                </aside>
              )}
            </div>
          )}
        </>
      )}

      {!wide && <SignalPanel />}
    </div>
  );
}

/** The findings in two bands, recent and older, each with a small header per
 *  signal type (left out when one type is chosen). */
function Findings({ items, grouped, typeName, bandCount, typeCount }: {
  items: FoundHit[];
  grouped: boolean;
  typeName: (id: string) => string;
  bandCount: (older: boolean) => number;
  typeCount: (id: string, older: boolean) => number;
}) {
  const bands = [false, true]
    .map((older) => ({ older, rows: items.filter((h) => h.older === older) }))
    .filter((b) => b.rows.length > 0);
  return (
    <div className="space-y-5">
      {bands.map(({ older, rows }) => (
        <section key={String(older)} className="overflow-hidden rounded-card border border-line bg-white">
          <header className={`flex flex-wrap items-baseline gap-x-3 gap-y-1 border-b border-neutral-100 px-5 py-3.5 ${older ? "bg-neutral-50" : ""}`}>
            <h2 className="text-[17px] font-semibold">{older ? "Older articles" : "Recent findings"} · {bandCount(older)}</h2>
            <p className="text-[13px] text-muted">
              {older ? "Published more than 30 days before they were collected: found now, but not new."
                : "Published within 30 days of being collected, or undated; your signal types first, in your signal list's order, then other findings."}
            </p>
          </header>
          {rows.map((h, i) => {
            const head = grouped && (i === 0 || rows[i - 1].signal_id !== h.signal_id);
            return (
              <Fragment key={`${h.doc_id}:${h.n}`}>
                {head && (
                  <div className={`flex gap-2 px-5 pb-1 pt-3.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-navy ${i > 0 ? "border-t border-neutral-100" : ""}`}>
                    {h.signal_id === "other" ? "Other · not on your signal list" : typeName(h.signal_id)}
                    <span className="text-faint">{typeCount(h.signal_id, older)}</span>
                  </div>
                )}
                <div className={!head && i > 0 ? "border-t border-neutral-100" : ""}>
                  <SignalItem item={h} />
                </div>
              </Fragment>
            );
          })}
        </section>
      ))}
    </div>
  );
}

/** An active filter, with × to remove it. */
function FilterPill({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-navy py-1 pl-3 pr-1.5 text-[13px] text-white">
      {label}
      <button type="button" onClick={onRemove} aria-label={`Remove ${label}`}
        className="rounded-full px-1.5 leading-none text-white/80 hover:bg-white/15 hover:text-white">
        ×
      </button>
    </span>
  );
}

export default function BriefingPage() {
  return (
    <Suspense fallback={null}>
      <RadarBriefing />
    </Suspense>
  );
}
