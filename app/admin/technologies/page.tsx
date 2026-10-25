"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import ActButton from "@/components/ActButton";
import AddTechnology from "@/components/AddTechnology";
import BackendError from "@/components/BackendError";
import BulkBar from "@/components/BulkBar";
import ConfirmAction from "@/components/ConfirmAction";
import ImportLink from "@/components/ImportLink";
import PageHeader from "@/components/PageHeader";
import Pager from "@/components/Pager";
import TechRow, { LIST, type Tech } from "@/components/TechRow";
import TechnicalDetailsSwitch from "@/components/TechnicalDetailsSwitch";
import { assessQuestion, assessSet, calls, resumeAssessment, runCalls, startAssessment, writePovs } from "@/lib/actions";
import { errorText, fetchJson, sendJson } from "@/lib/api";
import { type CitedPage, type Facets, type ListItem, type Status, STATUS_LABELS, STATUS_MEANING, VERDICT_WORDS, type View,
  VIEW_LABELS, VIEW_MEANING, VIEW_ORDER } from "@/lib/classification";
import { decide, type DecisionIn } from "@/lib/decisions";
import { andList, formatDay, orList, plural } from "@/lib/format";
import { useHere } from "@/lib/here";
import { useHood } from "@/lib/hood";
import { blockedReason, usePipeline } from "@/lib/pipeline";
import { PAGE_SIZE, useBackToOpened, useListPlace, withoutPlace } from "@/lib/paging";
import type { TechState } from "@/lib/states";
import { useTechLabel } from "@/lib/tech-labels";
import { LIVE_DOT } from "@/lib/theme";
import { everyVisible } from "@/lib/visible";

type Payload = {
  technologies: Tech[];
  total: number;
  view_counts: Partial<Record<View | "all", number>>;
  status_counts: Partial<Record<Status, number>>;
  facets: Facets;
  cited_pages: Record<string, CitedPage>;
  summary: { tech_count: number };
  catalog: CatalogSource;
  last_resolve: { status: string; finished_at?: string; new_pages?: number | null; raw_strings?: number; technologies?: number; docs_stamped?: number; error?: string } | null;
  updating?: number; // technologies whose answers (status, counts) are being worked out again
};

// where the catalog came from: each imported file, and how many a person added or took out
type CatalogSource = { files: { file: string; at: string; tz: string | null; technologies: number }[]; emptied?: number;
  added: number; taken_out: number };

// what the status line says after an action; `undo` puts it back
type Note = { text: string; failed?: boolean; undo?: { label: string; run: () => Promise<unknown> } };

const LEVELS = [1, 2, 3, 4, 5, 6, 7, 8, 9];
const FILTERS = ["availability", "domain", "subdomain", "trl_min", "trl_max", "evidence_verdict", "fabric", "catalog"] as const;
const CATALOG = { yes: "In the catalog", no: "Not in the catalog" } as const;
const select = "rounded-full border border-line bg-white px-3 py-1.5 text-[13px] text-ink";
const barSelect = "rounded-full border border-white/40 bg-navy px-3 py-1 text-white disabled:opacity-50";
// the state filters other pages link to (the Briefing's lists), each with its batch action
const STATE_FILTERS = {
  new_evidence: "New pages since its assessment", no_pov: "Ready for a Point of View", stopped_partway: "Stopped partway",
} satisfies Partial<Record<TechState, string>>;

const listUrl = (key: string, more: Record<string, string>) =>
  `/api/technologies?${new URLSearchParams([...new URLSearchParams(key), ...Object.entries(more)])}`;
const sendSwitch = (ids: string[], on: boolean) =>
  sendJson("/api/technologies/bulk", "POST", { ids, action: on ? "switch_on" : "switch_off" });
/** `xs` in runs of `n`: the API takes up to 500 ids at once, an address about 100. */
const chunks = <T,>(xs: T[], n: number) => Array.from({ length: Math.ceil(xs.length / n) }, (_, i) => xs.slice(i * n, (i + 1) * n));

/** One call per id, 20 at a time; how many were done, and the failures counted by their reason. */
async function eachOf(ids: string[], one: (id: string) => Promise<unknown>) {
  const failed: Record<string, number> = {};
  let done = 0;
  for (const run of chunks(ids, 20)) {
    for (const r of await Promise.allSettled(run.map(one))) {
      if (r.status === "fulfilled") done += 1;
      else failed[errorText(r.reason)] = (failed[errorText(r.reason)] ?? 0) + 1;
    }
  }
  return { done, failed };
}

/** How a technology lands in each group, and how to move it: closed until opened. */
function HowGroupsWork({ emerging, neither, catalog }: { emerging: string; neither?: string; catalog: CatalogSource }) {
  const byHand = [catalog.added && `${catalog.added.toLocaleString()} added`, catalog.taken_out && `${catalog.taken_out.toLocaleString()} taken out`]
    .filter(Boolean).join(" and ");
  return (
    <details className="mt-3 rounded-card border border-line bg-white px-4 py-2.5 text-[13px]">
      <summary className="cursor-pointer font-medium">How the groups work</summary>
      <ul className="mt-1.5 list-disc space-y-1 pl-5 text-neutral-700">
        <li><b>Emerging or Mature</b> comes from its commercial availability: {emerging} count as emerging, and Mature as
          mature{neither && `; ${neither} is neither yet`}.</li>
        <li><b>The catalog</b> is Tata&apos;s own list of emerging technologies:{" "}
          {catalog.files.length ? catalog.files.map((f) => `${f.file}, imported ${formatDay(f.at, f.tz)} (${plural(f.technologies, "technology", "technologies")} from it now)`).join("; ")
            : <>nothing imported yet (<Link href="/admin/import" className="text-link hover:underline">Import a catalog file</Link>)</>}
          {(catalog.emptied ?? 0) > 0 && ` (${plural(catalog.emptied!, "earlier import holds", "earlier imports hold")} none now: a later import took their rows)`}
          {byHand && `; ${byHand} by a person`}. <b>New to Tata</b> means emerging and not in the catalog; <b>Blind spots</b>,
          mature and not in it.</li>
        <li><b>Possibly nascent:</b> the model flagged it from one of its pages as new, with a strong early sign; a person
          answers Yes or No.</li>
        <li><b>In catalog, thin evidence:</b> in the catalog, with too few pages to assess. It leaves the group once Find
          evidence finds enough; it can&apos;t be moved by hand.</li>
      </ul>
      <p className="mt-1.5 text-navy">To move technologies between groups, tick them, then choose <b>Move to…</b> in the bar at the bottom.</p>
    </details>
  );
}

/** Every technology the radar knows: groups (views) with how they work,
 *  Tata's commercial availability buckets, filters with counts, and per
 *  technology where it stands (one status with its reason), its
 *  classification, how solid its evidence is, and its switch. Ticked rows act
 *  together: Move to… another group (availability, the catalog, nascent). */
function Technologies() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const here = useHere();
  const label = useTechLabel();
  const hood = useHood();
  const p = usePipeline();
  const view = (VIEW_ORDER as string[]).includes(params.get("view") ?? "") ? params.get("view") as View : null;
  const status = params.get("status") as Status | null;
  const state = (Object.keys(STATE_FILTERS) as string[]).includes(params.get("state") ?? "")
    ? params.get("state") as keyof typeof STATE_FILTERS : null;
  const filters = Object.fromEntries(FILTERS.map((k) => [k, params.get(k) ?? ""])) as Record<(typeof FILTERS)[number], string>;
  const [data, setData] = useState<Payload | null>(null);
  const [rows, setRows] = useState<Tech[]>([]);
  const [cited, setCited] = useState<Record<string, CitedPage>>({});
  const [error, setError] = useState<unknown>(null);
  const q = (params.get("q") ?? "").trim(); // what the list is searched by: in the address, so Back keeps it
  const place = useListPlace(LIST);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<Note | null>(null);
  const [lists, setLists] = useState<{ availability: ListItem[]; domains: ListItem[]; fabrics: { _id: string; name: string }[] }>(
    { availability: [], domains: [], fabrics: [] });
  const [cost, setCost] = useState<{ key: string; calls?: number; error?: string } | null>(null);

  useEffect(() => {
    Promise.all([fetchJson<{ items: ListItem[] }>("/api/lists/availability"), fetchJson<{ items: ListItem[] }>("/api/lists/domains"),
      fetchJson<{ fabrics: { _id: string; name: string }[] }>("/api/scoring/fabrics")])
      .then(([a, d, f]) => setLists({ availability: a.items, domains: d.items, fabrics: f.fabrics })).catch(() => {});
  }, []);

  const key = new URLSearchParams([["q", q], ["view", view ?? ""], ["status", status ?? ""], ["state", state ?? ""],
    ...FILTERS.map((k) => [k, filters[k]])].filter(([, v]) => v)).toString();
  // one page of rows at the list's place (lib/paging): again when a run moves on or after an
  // action (tick), at the same place; a list grown shorter shows its last page and says so
  const [tick, setTick] = useState(0);
  const reload = () => setTick((n) => n + 1);
  const [shorter, setShorter] = useState(false);
  const finished = p ? `${p.assess.status}:${p.pov.job?.status ?? ""}:${p.technologies.resolve_status ?? ""}` : "";
  const { start, go } = place;
  useEffect(() => {
    const ask = new AbortController(); // a newer page or filter replaces this one: its answer is dropped
    fetchJson<Payload>(listUrl(key, { limit: String(PAGE_SIZE), skip: String(start) }), { signal: ask.signal })
      .then((d) => {
        if (d.total > 0 && start >= d.total) {  // fewer rows now than where you were
          setShorter(true);
          go(Math.floor((d.total - 1) / PAGE_SIZE) * PAGE_SIZE);
          return;
        }
        setData(d);
        setRows(d.technologies);
        setCited(d.cited_pages);
        setError(null);
      })
      .catch((e) => { if (!ask.signal.aborted) setError(e); });
    return () => ask.abort();
  }, [key, start, finished, tick, go]);
  useBackToOpened(LIST, rows.length > 0);

  const running = data?.last_resolve?.status === "running";
  useEffect(() => {
    if (!running) return;
    return everyVisible(() => setTick((n) => n + 1), 5000); // only while the tab is visible
  }, [running]);

  // the cost of assessing the ticked rows, before the button asks: one request, however many
  const pickedKey = useMemo(() => [...picked].sort().join(","), [picked]);
  useEffect(() => {
    if (!pickedKey) return;
    let live = true;
    sendJson<{ calls: number }>("/api/scoring/preview", "POST", { technologies: pickedKey.split(",") })
      .then((r) => { if (live) setCost({ key: pickedKey, calls: r.calls }); })
      .catch((e) => { if (live) setCost({ key: pickedKey, error: errorText(e) }); });
    return () => { live = false; };
  }, [pickedKey]);
  const assessCalls = cost?.key === pickedKey ? cost.calls : undefined;
  const costProblem = cost?.key === pickedKey && cost.error ? `The cost couldn't be worked out: ${cost.error}` : null;

  const setParam = (changes: Record<string, string | null>) => {
    const next = withoutPlace(params); // a new filter or search starts at the first row
    setShorter(false);
    for (const [k, v] of Object.entries(changes)) {
      if (v) next.set(k, v);
      else next.delete(k);
    }
    setPicked(new Set());
    router.replace(next.toString() ? `${pathname}?${next}` : pathname, { scroll: false });
  };

  // the row's actions: plain functions; a row isn't drawn again for them (components/TechRow
  // compares only what it shows), and the copy it holds only sets state and reloads
  const act = async (fn: () => Promise<Note>) => {
    setBusy(true);
    setNote(null);
    try {
      setNote(await fn());
      setPicked(new Set());
      reload();
    } catch (e) {
      setNote({ text: `Not done: ${errorText(e)}.`, failed: true });
    } finally {
      setBusy(false);
    }
  };
  const switchTechs = (ids: string[], on: boolean) => act(async () => {
    let done = 0;
    try {
      for (const run of chunks(ids, 500)) {
        await sendSwitch(run, on);
        done += run.length;
      }
    } catch (e) {
      if (!done) throw e;
      return { text: `${plural(done, "technology", "technologies")} switched ${on ? "on" : "off"}; the other ${(ids.length - done).toLocaleString()} not: ${errorText(e)}.`, failed: true };
    }
    return { text: `${plural(ids.length, "technology", "technologies")} switched ${on ? "on" : "off"}.` };
  });
  const switchOne = (t: Tech, on: boolean) => act(async () => {
    await sendSwitch([t._id], on);
    return { text: `${label(t.name)} switched ${on ? "on" : "off"}.`,
      undo: { label: on ? "Switch it off again" : "Switch it back on", run: () => sendSwitch([t._id], !on) } };
  });
  const undone = (t: Tech) => { setNote({ text: `${label(t.name)}: back to what the model judged.` }); reload(); };
  const nascentDone = (name: string, done: string) => { setNote({ text: `${name}: ${done}.` }); reload(); };
  // one choice for every ticked row; the ones refused are counted by their reason
  const decideAll = (ids: string[], choice: Omit<DecisionIn, "tech_id">, done: string) => act(async () => {
    const { done: n, failed } = await eachOf(ids, (tech_id) => decide({ ...choice, tech_id }));
    const why = Object.entries(failed).map(([reason, k]) => `${k.toLocaleString()} not moved: ${reason}`).join("; ");
    return { text: `${plural(n, "technology", "technologies")} ${done}.${why ? ` ${why}.` : ""}`, failed: !!why };
  });
  const MOVES: Record<string, [Omit<DecisionIn, "tech_id">, string]> = {
    "catalog:yes": [{ kind: "catalog", value: "yes" }, "added to the catalog"],
    "catalog:no": [{ kind: "catalog", value: "no" }, "taken out of the catalog"],
    "nascent:yes": [{ kind: "nascent", value: "yes" }, "confirmed as nascent"],
    "nascent:no": [{ kind: "nascent", value: "no" }, "set aside as not nascent"],
  };
  const moveTo = (ids: string[], to: string) => {
    const [kind, value] = to.split(":");
    const named = (kind === "availability" ? lists.availability : lists.domains).find((x) => x._id === value);
    if (kind === "availability" || kind === "domain")
      return named && decideAll(ids, { kind: "move", field: kind, value }, `moved to ${named.name}`);
    if (MOVES[to]) decideAll(ids, ...MOVES[to]);
  };
  const selectAll = () => fetchJson<{ ids: string[] }>(listUrl(key, { ids_only: "true" }))
    .then((d) => setPicked(new Set(d.ids)))
    .catch((e) => setNote({ text: `Not selected: ${errorText(e)}.`, failed: true }));
  // a new search starts at the first row; the search box calls this only when what's typed changed
  const search = (text: string) => {
    const next = withoutPlace(new URLSearchParams(window.location.search));
    if (text) next.set("q", text); else next.delete("q");
    setPicked(new Set());
    router.replace(next.toString() ? `${pathname}?${next}` : pathname, { scroll: false });
  };
  const toggle = (id: string) => setPicked((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });
  const allPicked = rows.length > 0 && rows.every((t) => picked.has(t._id));
  const blocked = blockedReason(p, "assess");

  // the batch action for a state filter (the Briefing's links)
  const assess = p?.for_analyst.find((i) => i.kind === "assess");
  const write = p?.for_analyst.find((i) => i.kind === "write");
  const resume = p?.for_analyst.find((i) => i.kind === "resume");
  let batch: React.ReactNode = null;
  if (state === "new_evidence" && assess)
    batch = <ConfirmAction label={`Assess these ${assess.count}`} cost={calls(runCalls(assess))} disabled={blocked}
      question={assessQuestion(assess, "with new pages")}
      onConfirm={() => assessSet("new_evidence")} />;
  if (state === "no_pov" && write)
    batch = <ConfirmAction label={`Write these ${write.count}`} cost={calls(write.calls)}
      disabled={p?.pov.job?.status === "running" ? "Points of View are being written." : null}
      question={`Write ${plural(write.count, "Point of View", "Points of View")}? About ${plural(write.calls, "model call")}.`}
      onConfirm={() => writePovs(false)} />;
  if (state === "stopped_partway" && resume)
    batch = <ConfirmAction label="Resume the assessment run" cost={calls(resume.calls)} disabled={blocked}
      question={`Resume the assessment run of ${formatDay(resume.started_at)}? About ${plural(resume.calls, "model call")}.`}
      onConfirm={() => resumeAssessment(resume.scoring_run_id)} />;

  // every filter that's on, each one removable (the group shows as its selected button too)
  const nameOf = (xs: { _id: string; name: string }[], id: string) => xs.find((x) => x._id === id)?.name ?? id;
  const chips: { key: string; text: string; clear: Record<string, string | null> }[] = [
    ...(view ? [{ key: "view", text: VIEW_LABELS[view], clear: { view: null } }] : []),
    ...(state ? [{ key: "state", text: STATE_FILTERS[state], clear: { state: null } }] : []),
    ...(status ? [{ key: "status", text: STATUS_LABELS[status], clear: { status: null } }] : []),
    ...(q ? [{ key: "q", text: `Search: ${q}`, clear: { q: null } }] : []),
    ...(filters.availability ? [{ key: "availability", text: nameOf(lists.availability, filters.availability), clear: { availability: null } }] : []),
    ...(filters.domain ? [{ key: "domain", text: nameOf(lists.domains, filters.domain), clear: { domain: null, subdomain: null } }] : []),
    ...(filters.subdomain ? [{ key: "subdomain", text: data?.facets.subdomain?.find((x) => x.id === filters.subdomain)?.name ?? "Sub-domain", clear: { subdomain: null } }] : []),
    ...(filters.trl_min || filters.trl_max ? [{ key: "trl", text: `TRL ${filters.trl_min || 1}–${filters.trl_max || 9}`, clear: { trl_min: null, trl_max: null } }] : []),
    ...(filters.evidence_verdict ? [{ key: "evidence", text: `Evidence: ${filters.evidence_verdict === "none" ? "not judged yet" : VERDICT_WORDS[filters.evidence_verdict as keyof typeof VERDICT_WORDS]?.toLowerCase()}`, clear: { evidence_verdict: null } }] : []),
    ...(filters.fabric ? [{ key: "fabric", text: `Assessed in ${nameOf(lists.fabrics, filters.fabric)}`, clear: { fabric: null } }] : []),
    ...(filters.catalog ? [{ key: "catalog", text: CATALOG[filters.catalog as keyof typeof CATALOG], clear: { catalog: null } }] : []),
  ];
  const counts = data?.view_counts ?? {};
  const fc = data?.facets;
  const n = (facet: Exclude<keyof Facets, "subdomain">, k: string) => (fc?.[facet] as Record<string, number> | undefined)?.[k] ?? 0;
  const lo = Number(filters.trl_min) || 1;
  const hi = Number(filters.trl_max) || 9;
  const trlIn = (from: number, to: number) => LEVELS.filter((l) => l >= from && l <= to).reduce((s, l) => s + n("trl", String(l)), 0);
  const chosenBucket = lists.availability.find((a) => a._id === filters.availability);
  const meaning = view ? VIEW_MEANING[view].replace("{emerging}",
    orList(lists.availability.filter((a) => a.emerging).map((a) => a.name)) || "a value that counts as emerging")
    : "Every technology the radar knows.";

  const pill = (v: View | null, text: string, count: number | undefined) => {
    const on = v === view && !status && !state;
    return (
      <button key={v ?? "all"} type="button" aria-pressed={on} onClick={() => setParam({ view: v, status: null, state: null })}
        className={`rounded-full border px-3 py-1 text-[13px] ${on ? "border-navy bg-navy text-white" : "border-line bg-white hover:bg-ground"}`}>
        {text} <span className={`tabular-nums ${on ? "text-white/75" : "text-muted"}`}>{(count ?? 0).toLocaleString()}</span>
      </button>
    );
  };

  return (
    <div>
      <PageHeader title="Technologies"
        right={<div className="flex flex-col items-end gap-2"><TechnicalDetailsSwitch /><AddTechnology onAdded={reload} />
          <ImportLink /></div>}
        intro="Every technology the radar found on collected pages, or that Tata imported, and where each one stands. Priority runs from P1 (act now) to P6 (just watch)."
        help={<>
          <li>Each row says where it stands, in one status with its reason: Assessed (with its best priority, and the
            fabrics that have it), Assessed, no priority yet (how soon or how big couldn&apos;t be scored), Ready to assess,
            Thin evidence, No evidence yet, or Switched off. Notes under it say what else is going on, such as new pages
            since its assessment.</li>
          <li>Commercial availability is Tata&apos;s own column, in its order (Setup › Classification). The strip under the
            views counts the technologies in each value; click one to see only those, and again to see all.</li>
          <li>To move technologies between groups, tick them and choose Move to… in the bar at the bottom: another
            commercial availability (Emerging or Mature), into or out of the catalog, or Yes or No on possibly nascent.
            Move domain to… is beside it. Each is saved as a person&apos;s choice, which later runs and imports keep;
            Undo, on the row or the technology&apos;s page, returns it.</li>
          <li>Commercial availability, maturity (TRL) and domain come from a person&apos;s choice (or the catalog)
            first, then its assessment, then the radar&apos;s own reading of its pages; the small words under each say
            which. Evidence says how solid its pages are: how many independent sources, and how credible.</li>
          <li>The groups sort the technologies the way Tata thinks about them; How the groups work, under them, says
            how each is decided. The filters narrow any group. Every count is what choosing it would show: it covers
            the search, the group and the other filters.</li>
          <li>Tick rows (or select all in the group) to switch them off or on, move them, or assess them (the cost
            shows before anything starts). Included, the last column, is the same switch for one row: switched off,
            a technology is left out of assessments, and its pages are still collected.</li>
          <li>The Technical details switch adds page and source counts, and how many pages come from H1, H2 and H3
            sources (see Setup › Sources).</li>
        </>} />

      {error != null && <BackendError error={error} />}
      {(data?.updating ?? 0) > 50 && (
        <p className="mt-3 text-[12.5px] text-muted">
          <span className={`mr-1.5 ${LIVE_DOT}`} />Updating the list: {plural(data!.updating!, "technology", "technologies")} still
          being worked out after a change; their status and counts follow within a few minutes.
        </p>
      )}
      {running && <p className="mt-4 flex items-center gap-2 text-sm"><span className={LIVE_DOT} />Merging duplicate technology names…</p>}

      {data && (
        <>
          {hood && data.last_resolve?.status === "completed" && (
            <p className="mt-3 text-xs text-neutral-500">
              Duplicate names last merged {formatDay(data.last_resolve.finished_at)}:{" "}
              {data.last_resolve.new_pages === 0 ? "no new pages since the time before" : <>
                {data.last_resolve.new_pages != null && <>{plural(data.last_resolve.new_pages, "new page")}, </>}
                {plural(data.last_resolve.raw_strings ?? 0, data.last_resolve.new_pages != null ? "new name" : "name")} → {(data.last_resolve.technologies ?? 0).toLocaleString()} technologies
                · {(data.last_resolve.docs_stamped ?? 0).toLocaleString()} pages linked then</>} · <Link href="/admin/operations" className="text-link hover:underline">Run the Organize step again on Operations →</Link>
            </p>
          )}

          <div className="mt-6 flex flex-wrap gap-1.5" role="group" aria-label="Groups">
            {pill(null, "All", counts.all)}
            {VIEW_ORDER.map((v) => pill(v, VIEW_LABELS[v], counts[v]))}
          </div>
          <p className="mt-2 text-[13px] text-neutral-600">{meaning}</p>
          {data.catalog && <HowGroupsWork emerging={andList(lists.availability.filter((a) => a.emerging).map((a) => a.name)) || "the early values"}
            neither={lists.availability.find((a) => a.catch_all)?.name} catalog={data.catalog} />}

          {chosenBucket?.definition && <p className="mt-1.5 text-[12.5px] text-muted">{chosenBucket.name}: {chosenBucket.definition}</p>}

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <SearchBox value={q} onSearch={search} />
            <select aria-label="Status" className={select} value={status ?? ""} onChange={(e) => setParam({ status: e.target.value || null })}>
              <option value="">Any status</option>
              {(Object.keys(STATUS_LABELS) as Status[]).filter((s) => data.status_counts[s] || status === s).map((s) => (
                <option key={s} value={s} title={STATUS_MEANING[s]}>{STATUS_LABELS[s]} · {(data.status_counts[s] ?? 0).toLocaleString()}</option>
              ))}
            </select>
            <select aria-label="Commercial availability" className={select} value={filters.availability}
              onChange={(e) => setParam({ availability: e.target.value || null })}>
              <option value="">Any commercial availability</option>
              {lists.availability.map((a) => (
                <option key={a._id} value={a._id} title={a.definition ?? undefined}>{a.name} · {n("availability", a._id).toLocaleString()}</option>
              ))}
            </select>
            <select aria-label="Domain" className={select} value={filters.domain}
              onChange={(e) => setParam({ domain: e.target.value || null, subdomain: null })}>
              <option value="">Any domain</option>
              {lists.domains.map((d) => <option key={d._id} value={d._id}>{d.name} · {n("domain", d._id).toLocaleString()}</option>)}
            </select>
            {filters.domain && fc?.subdomain && (
              <select aria-label="Sub-domain" className={select} value={filters.subdomain} onChange={(e) => setParam({ subdomain: e.target.value || null })}>
                <option value="">Any sub-domain</option>
                {fc.subdomain.map((s) => <option key={s.id} value={s.id}>{s.name} · {s.n.toLocaleString()}</option>)}
              </select>
            )}
            <select aria-label="TRL from" className={select} value={filters.trl_min} onChange={(e) => setParam({ trl_min: e.target.value || null })}>
              <option value="">TRL from</option>
              {LEVELS.map((l) => <option key={l} value={l}>TRL ≥ {l} · {trlIn(l, hi).toLocaleString()}</option>)}
            </select>
            <select aria-label="TRL to" className={select} value={filters.trl_max} onChange={(e) => setParam({ trl_max: e.target.value || null })}>
              <option value="">TRL to</option>
              {LEVELS.map((l) => <option key={l} value={l}>TRL ≤ {l} · {trlIn(lo, l).toLocaleString()}</option>)}
            </select>
            <select aria-label="Evidence" className={select} value={filters.evidence_verdict}
              onChange={(e) => setParam({ evidence_verdict: e.target.value || null })}>
              <option value="">Any evidence</option>
              {(Object.keys(VERDICT_WORDS) as (keyof typeof VERDICT_WORDS)[]).map((v) => (
                <option key={v} value={v}>{VERDICT_WORDS[v]} · {n("evidence", v).toLocaleString()}</option>
              ))}
              <option value="none">Not judged yet · {n("evidence", "none").toLocaleString()}</option>
            </select>
            <select aria-label="Fabric" className={select} value={filters.fabric} onChange={(e) => setParam({ fabric: e.target.value || null })}>
              <option value="">Any fabric</option>
              {lists.fabrics.map((f) => <option key={f._id} value={f._id}>Assessed in {f.name} · {n("fabric", f._id).toLocaleString()}</option>)}
            </select>
            <select aria-label="Catalog" className={select} value={filters.catalog} onChange={(e) => setParam({ catalog: e.target.value || null })}>
              <option value="">In the catalog or not</option>
              {(Object.keys(CATALOG) as (keyof typeof CATALOG)[]).map((k) => (
                <option key={k} value={k}>{CATALOG[k]} · {n("catalog", k).toLocaleString()}</option>
              ))}
            </select>
          </div>

          {chips.length > 0 && (
            <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-muted">
              Showing
              {chips.map((c) => <FilterPill key={c.key} text={c.text} onRemove={() => setParam(c.clear)} />)}
              <button type="button" onClick={() => setParam(Object.fromEntries(["q", "view", "status", "state", ...FILTERS].map((k) => [k, null])))}
                className="px-1 text-[13px] text-link hover:underline">Clear all</button>
              {batch && <span className="ml-auto">{batch}</span>}
            </div>
          )}

          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-muted">{plural(data.total, "technology", "technologies")}</p>
            <Pager start={start} total={data.total} go={(n) => { setShorter(false); go(n); }} shorter={shorter} what="technologies" />
          </div>
          <div className="mt-1 overflow-x-auto rounded-card border border-line bg-white">
            <table className="w-full min-w-[1080px] text-sm">
              <thead>
                <tr className="border-b border-neutral-100 text-left text-[11px] uppercase tracking-wider text-neutral-500">
                  <th className="w-10 py-2 pl-5">
                    <input type="checkbox" aria-label="Select the rows shown" checked={allPicked}
                      onChange={() => setPicked(allPicked ? new Set() : new Set(rows.map((t) => t._id)))} />
                  </th>
                  <th className="px-3 py-2 font-medium">Technology</th>
                  <th className="px-3 py-2 font-medium">Status</th>
                  <th className="px-3 py-2 font-medium">Commercial availability</th>
                  <th className="px-3 py-2 font-medium">Maturity (TRL 1–9)</th>
                  <th className="px-3 py-2 font-medium">Domain</th>
                  <th className="px-3 py-2 font-medium">Evidence</th>
                  {hood && <th className="px-3 py-2 text-right font-mono font-medium">Pages · Sources · H1·H2·H3</th>}
                  <th className="px-5 py-2 font-medium" title="Switch off to leave it out of assessments; its pages are still collected">Included</th>
                </tr>
              </thead>
              {rows.map((t) => (
                <TechRow key={t._id} t={t} name={label(t.name)} picked={picked.has(t._id)} view={view} hood={hood} here={here}
                  cited={t.classification.nascent.flag ? cited[t.classification.nascent.flag.page] : undefined}
                  onToggle={toggle} onSwitch={switchOne} onUndone={undone} onNascent={nascentDone} />
              ))}
            </table>
            {rows.length === 0 && (
              <p className="px-5 py-6 text-sm text-neutral-500">
                {data.summary.tech_count === 0 ? "No technologies yet. They appear after the first collection."
                  : "Nothing matches this view and these filters. Clear a filter, or choose All."}
              </p>
            )}
          </div>
          <BulkBar count={picked.size} onClear={() => setPicked(new Set())} note={note?.text}>
            {picked.size < data.total && (
              <button type="button" onClick={selectAll} className="underline underline-offset-4 hover:text-white/80">
                Select all {data.total.toLocaleString()} in this view
              </button>
            )}
            {([["Switch off", false], ["Switch on", true]] as const).map(([text, on]) => (
              <button key={text} type="button" onClick={() => switchTechs([...picked], on)} disabled={busy}
                className="rounded-full border border-white/40 px-3.5 py-1 hover:bg-white/10 disabled:opacity-50">{text}</button>
            ))}
            <select aria-label="Move the selected to another group" className={barSelect} disabled={busy}
              value="" onChange={(e) => moveTo([...picked], e.target.value)}>
              <option value="">Move to…</option>
              <optgroup label="Commercial availability (Emerging or Mature)">
                {lists.availability.map((a) => <option key={a._id} value={`availability:${a._id}`}>{a.name}</option>)}
              </optgroup>
              <optgroup label="The catalog">
                <option value="catalog:yes">Add to the catalog</option>
                <option value="catalog:no">Take out of the catalog</option>
              </optgroup>
              <optgroup label="Possibly nascent">
                <option value="nascent:yes">Yes, nascent</option>
                <option value="nascent:no">No, not nascent</option>
              </optgroup>
            </select>
            <select aria-label="Move the selected to another domain" className={barSelect} disabled={busy}
              value="" onChange={(e) => moveTo([...picked], `domain:${e.target.value}`)}>
              <option value="">Move domain to…</option>
              {lists.domains.map((d) => <option key={d._id} value={d._id}>{d.name}</option>)}
            </select>
            <ConfirmAction label={`Assess ${picked.size.toLocaleString()}`} cost={assessCalls !== undefined ? calls(assessCalls) : undefined}
              disabled={blocked ?? costProblem ?? (assessCalls === undefined ? "Working out the cost…" : null)} secondary
              question={`Assess ${plural(picked.size, "technology", "technologies")}? About ${plural(assessCalls ?? 0, "model call")}. Switched-off ones are left out.`}
              onConfirm={() => startAssessment([...picked]).then(() => setPicked(new Set()))} />
            {busy && <span className="text-white/80">Saving…</span>}
          </BulkBar>
          {note && !picked.size && (
            <div role="status" className={`sticky bottom-4 z-20 mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-card border px-4 py-2.5 text-sm shadow-lg ${
              note.failed ? "border-failed/40 bg-white text-failed" : "border-navy bg-navy text-white"}`}>
              <span>{note.text}</span>
              {note.undo && (
                <ActButton label={note.undo.label} run={note.undo.run} className="underline underline-offset-4 hover:opacity-80"
                  onDone={() => { setNote(null); reload(); }} />
              )}
              <button type="button" aria-label="Close this message" onClick={() => setNote(null)} className="ml-auto px-1 opacity-80 hover:opacity-100">×</button>
            </div>
          )}
          <Pager className="mt-3" start={start} total={data.total} go={(n) => { setShorter(false); go(n); }}
            shorter={shorter} onStartOver={place.startOver} what="technologies" />
        </>
      )}
    </div>
  );
}

function FilterPill({ text, onRemove }: { text: string; onRemove: () => void }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-navy py-1 pl-3 pr-1.5 text-[13px] text-white">
      {text}
      <button type="button" onClick={onRemove} aria-label={`Remove ${text}`} className="rounded-full px-1.5 leading-none text-white/80 hover:bg-white/15">×</button>
    </span>
  );
}

export default function TechnologiesPage() {
  return (
    <Suspense fallback={null}>
      <Technologies />
    </Suspense>
  );
}


/** The search box: it keeps what's typed itself, so typing doesn't redraw
 *  the table; the list is searched 300 ms after the typing stops, only when
 *  that differs from the search in the address (`value`). */
function SearchBox({ value, onSearch }: { value: string; onSearch: (q: string) => void }) {
  // what's typed, against the search it was typed over: when the search changes elsewhere
  // (Back, Clear all), the box shows that instead
  const [typed, setTyped] = useState({ over: value, text: value });
  const text = typed.over === value ? typed.text : value;
  const setText = (t: string) => setTyped({ over: value, text: t });
  const latest = useRef(onSearch);
  useEffect(() => { latest.current = onSearch; });
  useEffect(() => {
    if (text.trim() === value) return;
    const t = setTimeout(() => latest.current(text.trim()), 300);
    return () => clearTimeout(t);
  }, [text, value]);
  return (
    <input className="min-w-0 flex-1 basis-56 rounded-full border border-line bg-white px-3.5 py-1.5 text-sm outline-none focus:border-neutral-500"
      placeholder="Search technologies…" value={text} onChange={(e) => setText(e.target.value)} aria-label="Search technologies" />
  );
}
