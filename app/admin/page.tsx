"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Fragment, Suspense, useCallback, useEffect, useRef, useState } from "react";
import BackendError from "@/components/BackendError";
import TodoStrip from "@/components/GateList";
import CrossedSigns from "@/components/CrossedSigns";
import PageHeader from "@/components/PageHeader";
import Pager from "@/components/Pager";
import { RunNowLine } from "@/components/RunSteps";
import SignalItem from "@/components/SignalItem";
import SignalPanel from "@/components/SignalPanel";
import { fetchRunsPreview, type RunsPreview } from "@/lib/actions";
import { fetchJson } from "@/lib/api";
import { formatDay, plural } from "@/lib/format";
import { useMedia } from "@/lib/media";
import { useListPlace, withoutPlace } from "@/lib/paging";
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
const PAGE = 15; // findings a page: the Briefing stays short (plan 10, §4)

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
  const older = params.get("band") === "older"; // the findings' tab: recent findings, or older articles found now

  const [summary, setSummary] = useState<BriefingSummary | null>(null);
  const [items, setItems] = useState<FoundHit[] | null>(null);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState<unknown>(null);
  const [sourceName, setSourceName] = useState<string | null>(null);
  const [preview, setPreview] = useState<RunsPreview | null>(null);
  const listToken = useRef(0); // the latest list request: older answers are dropped
  const place = useListPlace("briefing-findings");

  const setParams = (changes: Record<string, string | null>) => {
    const next = withoutPlace(params); // another scope or filter starts at the first findings
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
    tech: tech || null, source_id: source || null, signal_id: type || null, older: String(older) })}`, [tech, source, type, older]);

  // one page of findings at the list's place (lib/paging): kept when you leave and come back
  const { start, go } = place;
  useEffect(() => {
    if (!summary) return;
    const token = ++listToken.current;
    fetchJson<FoundResponse>(listUrl(summary, start))
      .then((d) => {
        if (token !== listToken.current) return;
        if (d.total > 0 && start >= d.total) { go(Math.floor((d.total - 1) / PAGE) * PAGE); return; } // fewer now
        setItems(d.hits);
        setTotal(d.total);
      })
      .catch((e) => { if (token === listToken.current) setError(e); });
  }, [summary, listUrl, start, go]);

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
  const window_ = (
    <label>
      <span className="sr-only">Window</span>
      <select value={days} onChange={(e) => setParams({ days: e.target.value === "7" ? null : e.target.value })}
        className="rounded-full border border-line bg-white px-3 py-0.5 text-[14px] text-ink">
        {WINDOWS.map((w) => <option key={w.days} value={w.days}>{w.label}</option>)}
      </select>
    </label>
  );
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
          <li>What the radar found has two tabs. New: published within 30 days of the radar collecting it, or with no
            publication date (its row says so, with when it was collected). Old: published more than 30 days before the
            radar collected it, background rather than new. Either can be an article, a paper or a report.</li>
          <li>Your signal types come first, in the order of your signal list, then Other: notable findings that
            aren&apos;t on the list. Reorder the list in{" "}
            <Link href="/admin/signals/list" className="text-link hover:underline">Setup → Signal list</Link>, at no
            model cost.</li>
          <li>Kind of finding, beside the tabs, counts each type in the tab you&apos;re on; choose one to show only that
            type. A story reported on several pages shows once, with where else it was reported. The window menu, in
            the line under the title, sets how far back to look, by collection date.</li>
          <li>To do, at the top, one strip of three columns: what to settle before technologies are scored, what to
            settle before a Point of View goes to leaders (advice, not a gate), and Publish to leaders, with what has
            changed since the last edition. Each column lists what waits first; Open (or its title) shows its full list
            below the strip as cards, and this browser remembers which you left open. Each card counts technologies; its
            sentence opens where it&apos;s done, and Which ones lists them. A card that is one decision is done in
            place: a run (classify, assess, write) shows its model calls and asks before starting, and each possibly
            nascent technology gets Yes or No.</li>
          <li>Publish to leaders takes a copy of every Point of View and placement as they stand: leaders see only that
            copy, never your work in progress, until the next publish. It rewrites nothing, costs no model calls and
            keeps the editions before it.</li>
        </>}
      >
        {s && (
          <p className="mt-2 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[14.5px] text-muted">
            {runScope ? <>Collection of {formatDay(runScope.started_at)} · {runState(runScope)} · </> : window_}
            <b className="font-semibold text-ink">{s.counts.findings.toLocaleString()}</b>{" "}
            {s.counts.findings === 1 ? "finding" : "findings"} from{" "}
            <b className="font-semibold text-ink">{s.counts.pages.toLocaleString()}</b> new or changed{" "}
            {s.counts.pages === 1 ? "page" : "pages"}
            {!runScope && s.freshness && (
              <> · last collected {formatDay(s.freshness.finished_at)} from {plural(s.freshness.sources, "source")}</>
            )}
          </p>
        )}
        {(s?.updating_days ?? 0) > 0 && (
          <p className="mt-1 text-[13px] text-amber-900">
            Totals for {plural(s!.updating_days!, "earlier day")} are being brought up to date after a check of stored
            pages; until then they count as they stood before it. Today&apos;s are current.
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
          {!runScope && <RunNowLine />}
          <h2 className="mt-6 text-lg font-semibold">To do</h2>
          <p className="text-[13px] text-muted">What waits on you, in the order the radar&apos;s process needs it.</p>
          <TodoStrip />
          <CrossedSigns />

          <h2 className="mt-8 text-lg font-semibold">What the radar found</h2>
          {s && (
            <div role="tablist" aria-label="Findings" className="mt-2 flex flex-wrap items-baseline gap-1.5">
              {([[false, "New", s.counts.findings - s.counts.older], [true, "Old", s.counts.older]] as const)
                .map(([band, name, n]) => (
                  <button key={name} type="button" role="tab" aria-selected={older === band}
                    onClick={() => setParams({ band: band ? "older" : null })}
                    className={`rounded-full border px-3.5 py-1 text-[13px] ${older === band ? "border-navy bg-navy text-white" : "border-line bg-white hover:bg-ground"}`}>
                    {name} · {n.toLocaleString()}
                  </button>
                ))}
              <select aria-label="Kind of finding" className="ml-1 rounded-full border border-line bg-white px-3 py-1 text-[13px]"
                value={type ?? ""} onChange={(e) => setParams({ type: e.target.value || null })}>
                <option value="">Every kind of finding · {bandCount(older).toLocaleString()}</option>
                {s.types.map((t) => ({ ...t, n: typeCount(t.signal_id, older) }))
                  .filter((t) => t.n > 0 || t.signal_id === type).map((t) => (
                    <option key={t.signal_id} value={t.signal_id}>{t.signal_id === "other" ? "Other, not on your list" : t.name} · {t.n.toLocaleString()}</option>
                  ))}
              </select>
              <span className="basis-full text-[12.5px] text-muted">
                {older ? "Published more than 30 days before the radar collected it: background, not new."
                  : "Published within 30 days of the radar collecting it, or with no publication date; your signal types first. Copies of one story show once."}
              </span>
            </div>
          )}

          {s && (
            <div className={`mt-4 grid grid-cols-1 gap-7 ${docked
              ? "min-[1440px]:grid-cols-[minmax(0,1fr)_400px] min-[1800px]:grid-cols-[minmax(0,1fr)_460px]" : ""}`}>

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
                    {older && !type ? "No older articles were found in this window."
                      : type ? `No ${typeName(type)} findings here.`
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
                  <Findings items={items} grouped={!type} typeName={typeName} typeCount={(id) => typeCount(id, older)} />
                )}

                {items && items.length > 0 && (
                  total > PAGE ? <Pager className="mt-4" start={start} total={total} size={PAGE} go={go} what="findings" />
                    : <p className="mt-4 text-sm text-muted">That&apos;s all {plural(total, "finding")}.</p>
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

/** One tab's findings, with a small header per signal type (left out when
 *  one type is chosen). */
function Findings({ items, grouped, typeName, typeCount }: {
  items: FoundHit[];
  grouped: boolean;
  typeName: (id: string) => string;
  typeCount: (id: string) => number;
}) {
  return (
    <section className="overflow-hidden rounded-card border border-line bg-white">
      {items.map((h, i) => {
        const head = grouped && (i === 0 || items[i - 1].signal_id !== h.signal_id);
        return (
          <Fragment key={`${h.doc_id}:${h.n}`}>
            {head && (
              <div className={`flex gap-2 px-5 pb-1 pt-3.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-navy ${i > 0 ? "border-t border-neutral-100" : ""}`}>
                {h.signal_id === "other" ? "Other · not on your signal list" : typeName(h.signal_id)}
                <span className="text-faint">{typeCount(h.signal_id)}</span>
              </div>
            )}
            <div className={!head && i > 0 ? "border-t border-neutral-100" : ""}>
              <SignalItem item={h} />
              {(h.also?.length ?? 0) > 0 && (
                <p className="-mt-2 px-5 pb-3 text-[12.5px] text-muted">
                  Also reported by{" "}
                  {h.also!.map((a, k) => (
                    <Fragment key={a.url}>{k > 0 && ", "}<a href={a.url} target="_blank" rel="noreferrer" className="text-link hover:underline">{a.source}</a></Fragment>
                  ))}
                </p>
              )}
            </div>
          </Fragment>
        );
      })}
    </section>
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
