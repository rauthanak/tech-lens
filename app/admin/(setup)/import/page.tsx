"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { targetValues, type Target } from "@/components/AddTechnology";
import ConfirmAction from "@/components/ConfirmAction";
import PageHeader from "@/components/PageHeader";
import { calls } from "@/lib/actions";
import { ApiError, errorText, fetchJson, sendForm, sendJson } from "@/lib/api";
import type { ListItem } from "@/lib/classification";
import { formatAt, formatDay, formatTokens, plural } from "@/lib/format";
import { useHere, withFrom } from "@/lib/here";
import { useTechLabel } from "@/lib/tech-labels";
import { LIVE_DOT } from "@/lib/theme";

// Import Tata's catalog: its own list of emerging technologies (tech-atlas services/imports):
// upload an .xlsx, check what was read, match the names against the
// technologies the radar already knows, review the proposals and the values
// our lists don't have, then confirm. A new file saves nothing until it is
// confirmed; a confirmed one can have matches reopened for review.

type Field = "availability" | "domain" | "subdomain" | "trl";
type Status = "reviewing" | "ready" | "confirmed" | "discarded";
type Decision = "accept" | "reject" | null;
type Item = {
  row: number;
  name: string;
  values: Partial<Record<Field | "description", string>>;
  group: "matched" | "unmatched" | "proposed" | "new";
  target_tech_id: string | null;
  target_name: string | null;
  decision: Decision;
  repeats?: number[];
  why?: string | null; // a match proposed by code, not the model: why
  kept_apart?: { tech_id: string; name: string }; // the skill folded it in; code kept it apart as narrower
};
type Unknown = { field: Field; value: string; count: number; map_to: string | number | null; keep?: boolean | null;
  domain_id?: string };
type Counts = { matched: number; proposed: number; new: number; unmatched: number; accepted: number; rejected: number;
  values_to_map: number; values_waiting?: number }; // values_waiting: not on imports made before 21 Oct
type Result = { joined: number; added: number; shared?: number };
type Reopened = { at: string; tz: string; rows: number[]; withdrawn: number };
type Summary = { _id: string; file: string; sheet: string; at: string; tz: string | null; status: Status; rows: number;
  counts: Counts; result?: Result;
  confirmed_at?: string | null; reopened?: Reopened[] }; // a confirmed import whose matches came back for review
type Import = Summary & { columns: string[]; items: Item[]; unknown_values: Unknown[]; calls: number;
  targets: Record<string, Target> };

const COLUMNS = ["Technology Name", "Domain", "Sub-domain", "Description", "TRL", "Commercial Availability"];
const FIELD_WORDS: Record<Field, string> = {
  availability: "Commercial availability", domain: "Domain", subdomain: "Sub-domain", trl: "TRL",
};
const CARD = "mt-5 rounded-card border border-line bg-white px-5 py-4";
const SMALL_PRIMARY = "rounded-full bg-navy px-2.5 py-0.5 text-xs text-white hover:bg-navy-strong disabled:opacity-50";
const SMALL_SECONDARY = "rounded-full border border-line bg-white px-2.5 py-0.5 text-xs text-ink hover:bg-ground disabled:opacity-50";
const SECONDARY = "rounded-full border border-line bg-white px-3.5 py-1.5 text-sm text-ink hover:bg-ground disabled:opacity-50";
const TH = "border-b border-neutral-100 text-left text-[11px] uppercase tracking-wider text-neutral-500";
const KEEP = "__keep"; // the select's "Keep as written" choice for a sub-domain
const LEAVE = "__leave"; // its "Leave it out" choice ("" is a sub-domain still waiting for one)

const editableStatus = (s: Status) => s === "reviewing" || s === "ready";
/** Confirmed once, then matches reopened for review: what it last did, and what came back. */
const reopenedOf = (s: Summary) =>
  editableStatus(s.status) && s.confirmed_at && s.result && s.reopened?.length ? s.reopened[s.reopened.length - 1] : null;
/** "Confirmed Oct 20 · 115 joined, 885 added". */
const confirmedWords = (s: Summary) => s.result
  ? `Confirmed ${formatDay(s.confirmed_at)} · ${s.result.joined.toLocaleString()} joined, ${s.result.added.toLocaleString()} added`
  : "Confirmed";
const waitingOf = (c: Counts) => Math.max(0, c.proposed - c.accepted - c.rejected);
const isOrAre = (n: number) => (n === 1 ? "is" : "are");
const waitsOrWait = (n: number) => (n === 1 ? "waits" : "wait");

/** The rows that would join each technology another row also joins: exact
 *  matches and proposed ones not rejected. Confirm sets none of their values. */
function sharedTargets(items: Item[]): Map<string, Item[]> {
  const by = new Map<string, Item[]>();
  for (const it of items)
    if (it.target_tech_id && (it.group === "matched" || (it.group === "proposed" && it.decision !== "reject")))
      by.set(it.target_tech_id, [...(by.get(it.target_tech_id) ?? []), it]);
  return new Map([...by].filter(([, rows]) => rows.length > 1));
}

/** "Early Commercial · Cloud › Edge-Cloud Convergence · TRL 6", from the file's words. */
function fileValues(v: Item["values"]): string {
  const where = [v.domain, v.subdomain].filter(Boolean).join(" › ");
  return [v.availability, where, v.trl && `TRL ${v.trl}`].filter(Boolean).join(" · ") || "No values in the file";
}

function statusWords(s: Summary): { text: string; style: string } {
  if (s.status === "confirmed") return { text: "Confirmed", style: "bg-emerald-50 text-emerald-800" };
  if (reopenedOf(s)) return waitingOf(s.counts) || s.counts.values_waiting
    ? { text: "Reopened for review", style: "bg-amber-50 text-amber-900" }
    : { text: "Reopened, ready to confirm again", style: "bg-azure/15 text-navy" };
  if (s.status === "discarded") return { text: "Discarded", style: "bg-neutral-100 text-muted" };
  if (s.counts.unmatched) return { text: "Waiting to be matched", style: "bg-amber-50 text-amber-900" };
  return waitingOf(s.counts) || s.counts.values_waiting ? { text: "Waiting for your review", style: "bg-amber-50 text-amber-900" }
    : { text: "Ready to confirm", style: "bg-azure/15 text-navy" };
}

function countsLine(s: Summary): string {
  if (s.status === "confirmed" && s.result)
    return `${s.result.joined.toLocaleString()} joined · ${s.result.added.toLocaleString()} added` +
      (s.result.shared ? ` · ${plural(s.result.shared, "row")} sharing a technology` : "");
  const back = reopenedOf(s);
  if (back) return `${confirmedWords(s)} · ${plural(back.rows.length, "match", "matches")} reopened ${formatDay(back.at)} for review`;
  const c = s.counts;
  return [`${c.matched.toLocaleString()} matched exactly`, `${c.proposed.toLocaleString()} proposed`,
    `${c.new.toLocaleString()} new`, ...(c.unmatched ? [`${c.unmatched.toLocaleString()} not matched yet`] : [])].join(" · ");
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="rounded-card border border-line bg-white px-5 py-4 text-sm text-muted">{children}</p>;
}

/** Upload · Check · Match · Review · Confirm, each done, current or to come. */
function Steps({ imp }: { imp: Import | null }) {
  const c = imp?.counts;
  const active = !!imp && editableStatus(imp.status);
  const confirmed = imp?.status === "confirmed";
  const matched = !!c && c.unmatched === 0;
  const waiting = c ? waitingOf(c) + (c.values_waiting ?? 0) : 0;
  const steps: { label: string; state: "done" | "on" | "todo"; note?: string }[] = [
    { label: "Upload", state: imp ? "done" : "on" },
    { label: "Check", state: imp ? "done" : "todo" },
    { label: "Match", state: matched ? "done" : active ? "on" : "todo",
      note: matched && imp ? (imp.calls ? plural(imp.calls, "model call") : "no model calls") : undefined },
    { label: "Review", state: matched && (confirmed || waiting === 0) ? "done" : matched && active ? "on" : "todo" },
    { label: "Confirm", state: confirmed ? "done" : matched && active && waiting === 0 ? "on" : "todo" },
  ];
  return (
    <ol className="mt-5 flex flex-wrap gap-2" aria-label="Steps">
      {steps.map((s, i) => (
        <li key={s.label} aria-current={s.state === "on" ? "step" : undefined}
          className={`rounded-full border px-3 py-1 text-[13px] ${
            s.state === "done" ? "border-emerald-200 bg-emerald-50 text-emerald-800"
              : s.state === "on" ? "border-navy bg-navy text-white" : "border-line bg-white text-muted"}`}>
          {i + 1} {s.label}{s.state === "done" && " ✓"}{s.note && <span className="opacity-80"> · {s.note}</span>}
        </li>
      ))}
    </ol>
  );
}

function UploadCard({ onUploaded }: { onUploaded: (imp: Import) => void }) {
  const [reading, setReading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const upload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // choosing the same file again uploads it again
    if (!file) return;
    setReading(file.name);
    setError(null);
    const form = new FormData();
    form.append("file", file);
    try {
      onUploaded(await sendForm<Import>("/api/imports", form));
    } catch (err) {
      setError(err instanceof ApiError && err.status === 422 ? `This file can't be imported: ${errorText(err)}.`
        : `The file wasn't read: ${errorText(err)}.`);
    } finally {
      setReading(null);
    }
  };

  return (
    <section className={CARD}>
      <h2 className="font-semibold">Upload a file</h2>
      <p className="mt-1 text-[13px] text-neutral-700">
        An Excel file (.xlsx) laid out like Tata&apos;s &ldquo;New Emerging Technologies&rdquo; sheet, with the columns
        {" "}{COLUMNS.join(", ")}; other sheets are ignored.
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-3">
        <input type="file" accept=".xlsx" onChange={upload} disabled={!!reading} aria-label="Choose an Excel file to import"
          className="block max-w-full text-sm text-muted file:mr-3 file:cursor-pointer file:rounded-full file:border-0 file:bg-navy file:px-3.5 file:py-1.5 file:text-sm file:text-white hover:file:bg-navy-strong disabled:opacity-50" />
        <a href="/api/imports/template" download className="text-sm text-link hover:underline">Download the blank template</a>
      </div>
      {reading && (
        <p className="mt-3 flex items-center gap-2 text-sm text-muted [overflow-wrap:anywhere]">
          <span className={LIVE_DOT} />Reading {reading} and checking it against the technologies the radar already knows…
        </p>
      )}
      {error && <p role="alert" className="mt-3 text-sm text-failed">{error}</p>}
    </section>
  );
}

/** What was read: the sheet, rows, columns and merged repeats. */
function CheckCard({ imp, onAnother }: { imp: Import; onAnother: () => void }) {
  const missing = COLUMNS.filter((c) => !imp.columns.includes(c));
  const repeated = imp.items.filter((i) => i.repeats?.length);
  return (
    <section className={CARD}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <p className="min-w-0 flex-1 basis-80 text-sm [overflow-wrap:anywhere]">
          {imp.file} · sheet <b className="font-semibold">{imp.sheet}</b> · {plural(imp.rows, "row")} ·{" "}
          {plural(imp.items.length, "different name")} · columns found: {imp.columns.join(", ")}
        </p>
        <button type="button" onClick={onAnother} className={SECONDARY}>Upload another file</button>
      </div>
      <p className="mt-1.5 text-xs text-muted">
        Uploaded {formatAt(imp.at, imp.tz)}
        {missing.length > 0 && <> · Not in the file: {missing.join(", ")} (left unset)</>}
        {" · "}
        {repeated.length
          ? `${plural(repeated.length, "name")} appeared more than once; each was merged into one row (the first row's values, filled in from the later ones)`
          : "No repeated names"}
      </p>
      {repeated.length > 0 && (
        <details className="mt-1.5 text-xs">
          <summary className="cursor-pointer text-link hover:underline">Show the repeated names</summary>
          <ul className="mt-1.5 grid gap-x-8 gap-y-1 text-neutral-700 sm:grid-cols-2 2xl:grid-cols-3">
            {repeated.map((i) => (
              <li key={i.row} className="min-w-0 [overflow-wrap:anywhere]">
                {i.name} <span className="text-muted">· rows {[i.row, ...(i.repeats ?? [])].join(", ")}</span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}

/** What matching names with the model costs (services/imports.match_cost). */
type MatchCost = { names: number; calls: number; register: number; tokens_about: number };
const costWords = (c: MatchCost) => `${calls(c.calls)}, about ${formatTokens(c.tokens_about)} tokens`;

function MatchCard({ imp, onMatched }: { imp: Import; onMatched: (imp: Import) => void }) {
  const [preview, setPreview] = useState<MatchCost | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [matching, setMatching] = useState(false);

  useEffect(() => {
    let live = true;
    fetchJson<MatchCost>(`/api/imports/${encodeURIComponent(imp._id)}/match/preview`)
      .then((p) => { if (live) { setPreview(p); setPreviewError(null); } })
      .catch((e) => { if (live) setPreviewError(errorText(e)); });
    return () => { live = false; };
  }, [imp._id]);

  const n = preview?.names ?? imp.counts.unmatched;
  const match = async () => {
    setMatching(true);
    try {
      onMatched(await sendJson<Import>(`/api/imports/${encodeURIComponent(imp._id)}/match`, "POST"));
    } finally {
      setMatching(false);
    }
  };

  return (
    <section className={CARD}>
      <h2 className="font-semibold">Match the names</h2>
      <p className="mt-1 text-[13px] text-neutral-700">
        {plural(imp.counts.matched, "name")} matched a technology the radar already knows exactly, by name or alias, at
        no cost.
        {imp.counts.proposed > 0 && ` ${plural(imp.counts.proposed, "name")} ${imp.counts.proposed === 1 ? "is" : "are"} proposed at no cost, from the name in or outside ${imp.counts.proposed === 1 ? "its" : "their"} brackets.`}
        {" "}{plural(imp.counts.unmatched, "name")} {imp.counts.unmatched === 1 ? "has" : "have"} no exact match: the
        model reads them against the technologies the radar already knows and proposes matches for you to accept or
        reject. A name it can&apos;t place comes in as new, and so does one code finds narrower than the technology
        proposed (a word in front, or &ldquo;for&rdquo;, &ldquo;in&rdquo;, &ldquo;at&rdquo;, &ldquo;on&rdquo; something).
      </p>
      <div className="mt-3">
        <ConfirmAction label={`Match ${plural(n, "name")}`} cost={preview ? costWords(preview) : undefined}
          confirmLabel="Match"
          disabled={previewError ? `The cost couldn't be worked out: ${previewError}.` : preview ? null : "Working out the cost…"}
          question={`Match ${plural(n, "name")} against the ${plural(preview?.register ?? 0, "technology", "technologies")} the radar already knows? ${preview ? `${costWords(preview)[0].toUpperCase()}${costWords(preview).slice(1)}` : ""}. Exact names and aliases cost nothing and are already matched.`}
          onConfirm={match} />
      </div>
      {matching && (
        <p className="mt-2 flex items-center gap-2 text-sm text-muted">
          <span className={LIVE_DOT} />Matching against the technologies the radar already knows: a long list can take a few minutes.
        </p>
      )}
    </section>
  );
}

function DecisionChip({ decision }: { decision: Decision }) {
  const [text, style] = decision === "accept" ? ["Accepted: joins it", "bg-emerald-50 text-emerald-800"]
    : decision === "reject" ? ["Rejected: comes in as new", "bg-neutral-100 text-muted"]
      : ["Waiting for your decision", "bg-amber-50 text-amber-900"];
  return <span className={`whitespace-nowrap rounded-full px-2 py-0.5 text-[11.5px] ${style}`}>{text}</span>;
}

function TechLink({ item, here }: { item: Item; here: string }) {
  const label = useTechLabel();
  const name = label(item.target_name ?? "");
  return item.target_tech_id
    ? <Link href={withFrom(`/admin/technologies/${encodeURIComponent(item.target_tech_id)}`, here)}
      className="text-link hover:underline">{name}</Link>
    : <>{name}</>;
}

/** The row's description, two lines until opened. */
function Description({ text }: { text?: string }) {
  const [open, setOpen] = useState(false);
  if (!text) return null;
  return (
    <span className="mt-1 block text-[12px] text-neutral-600">
      <span className={open ? "" : "line-clamp-2"}>{text}</span>
      {text.length > 140 && (
        <button type="button" onClick={() => setOpen(!open)} className="text-link hover:underline">
          {open ? "Less" : "More"}
        </button>
      )}
    </span>
  );
}

/** Several rows would join one technology: usually a narrower one folded into
 *  a broader one, and none of their values is set on it if confirmed so. */
function SharedNotice({ groups, imp, here }: { groups: [string, Item[]][]; imp: Import; here: string }) {
  if (!groups.length) return null;
  return (
    <div role="note" className="mt-3 rounded-card border border-amber-200 bg-amber-50/70 px-5 py-3 text-[13px] text-amber-950">
      <p>
        <b className="font-semibold">Several rows would join one technology.</b> That usually means a narrower technology
        was read as a broader one: reject the rows that are a different technology, and each comes in as its own. Rows
        that still share a technology when you confirm keep their values on this import&apos;s record; none is set on
        the technology.
      </p>
      <ul className="mt-2 space-y-1">
        {groups.map(([id, rows]) => (
          <li key={id} className="[overflow-wrap:anywhere]">
            <b className="font-semibold">{plural(rows.length, "row")} would join{" "}
              <TechLink item={{ ...rows[0], target_name: imp.targets[id]?.name ?? rows[0].target_name }} here={here} />
            </b>
            {imp.targets[id] && <span className="text-amber-900/80"> ({plural(imp.targets[id].page_count, "page")})</span>}:{" "}
            {rows.map((r) => r.name + (r.group === "matched" ? " (exact)" : "")).join(", ")}
          </li>
        ))}
      </ul>
    </div>
  );
}

function Proposed({ imp, editable, here, onChange }: { imp: Import; editable: boolean; here: string;
  onChange: (imp: Import) => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const shared = sharedTargets(imp.items);
  // the rows a technology shares come first, together, so they're judged side by side
  const rows = imp.items.filter((i) => i.group === "proposed").sort((a, b) =>
    (shared.get(b.target_tech_id ?? "")?.length ?? 1) - (shared.get(a.target_tech_id ?? "")?.length ?? 1)
    || (a.target_name ?? "").localeCompare(b.target_name ?? "") || a.row - b.row);
  const waiting = rows.filter((i) => !i.decision);

  const decide = async (which: number[], decision: "accept" | "reject") => {
    setBusy(true);
    setError(null);
    try {
      onChange(await sendJson<Import>(`/api/imports/${encodeURIComponent(imp._id)}/items`, "PUT", { rows: which, decision }));
    } catch (e) {
      setError(`Not saved: ${errorText(e)}.`);
    } finally {
      setBusy(false);
    }
  };

  if (!rows.length)
    return <Empty>The model proposed no matches: every name without an exact match comes in as new.</Empty>;
  // the bulk buttons decide the rows still waiting; once none wait, every row
  const bulk = waiting.length ? waiting : rows;
  const bulkWords = waiting.length && waiting.length < rows.length ? `the ${waiting.length.toLocaleString()} waiting`
    : `all ${rows.length.toLocaleString()}`;
  const groups = [...shared].filter(([, its]) => its.some((i) => i.group === "proposed"));

  return (
    <div>
      <p className="text-[13px] text-neutral-700">
        Each name below reads as a technology the radar already knows, in other words. Compare your row with what it
        would join: accept to join it (the name in your file becomes an alias, and its pages are filed under it);
        reject to keep it separate, as a new technology. Accept only when they are the same technology, not a narrower
        or related one.
        {" "}{waiting.length ? `${waiting.length.toLocaleString()} still ${waitsOrWait(waiting.length)} for a decision.`
          : "Every proposed match has a decision."}
      </p>
      <SharedNotice groups={groups} imp={imp} here={here} />
      {editable && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button type="button" disabled={busy} onClick={() => decide(bulk.map((r) => r.row), "accept")}
            className="rounded-full bg-navy px-3.5 py-1.5 text-sm text-white hover:bg-navy-strong disabled:opacity-50">
            Accept {bulkWords}
          </button>
          <button type="button" disabled={busy} onClick={() => decide(bulk.map((r) => r.row), "reject")} className={SECONDARY}>
            Reject {bulkWords}
          </button>
          {busy && <span className="text-xs text-muted">Saving…</span>}
        </div>
      )}
      {error && <p role="alert" className="mt-2 text-sm text-failed">{error}</p>}
      {/* relative: keeps the hidden column label inside the scroller, so the page never scrolls sideways */}
      <div className="relative mt-3 overflow-x-auto rounded-card border border-line bg-white">
        <table className="w-full min-w-[760px] text-sm">
          <thead>
            <tr className={TH}>
              <th className="w-[38%] px-5 py-2 font-medium">In your file</th>
              <th className="w-[34%] px-3 py-2 font-medium">Would join, as it is now</th>
              <th className="px-3 py-2 font-medium">Decision</th>
              {editable && <th className="px-5 py-2"><span className="sr-only">Accept or reject</span></th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {rows.map((it) => {
              const t = it.target_tech_id ? imp.targets[it.target_tech_id] : undefined;
              const tv = t && targetValues(t);
              const sharing = shared.get(it.target_tech_id ?? "")?.length ?? 0;
              return (
                <tr key={it.row} className="hover:bg-neutral-50">
                  <td className="px-5 py-2.5 align-top">
                    <span className="font-medium">{it.name}</span>
                    <span className="text-[11px] text-muted"> · Row {it.row}</span>
                    <span className="mt-0.5 block text-[12.5px] text-neutral-700">{fileValues(it.values)}</span>
                    <Description text={it.values.description} />
                  </td>
                  <td className="px-3 py-2.5 align-top">
                    <TechLink item={{ ...it, target_name: t?.name ?? it.target_name }} here={here} />
                    {t && <span className="text-[11px] text-muted"> · {plural(t.page_count, "page")}</span>}
                    {tv && <span className="mt-0.5 block text-[12.5px] text-neutral-700">{tv.line}</span>}
                    {tv?.from && <span className="block text-[11px] text-muted">{tv.from}</span>}
                    {sharing > 1 && it.decision !== "reject" && (
                      <span className="mt-1 inline-block rounded-full bg-amber-50 px-2 py-0.5 text-[11px] text-amber-900">
                        1 of {sharing} rows that would join it
                      </span>
                    )}
                    <span className="mt-1 block text-[11px] text-muted">
                      {it.why ? `Proposed at no cost: ${it.why}.` : "Proposed by the model."}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 align-top"><DecisionChip decision={it.decision} /></td>
                  {editable && (
                    <td className="whitespace-nowrap px-5 py-2.5 text-right align-top">
                      <span className="inline-flex gap-1.5">
                        {it.decision !== "accept" && (
                          <button type="button" disabled={busy} onClick={() => decide([it.row], "accept")} className={SMALL_PRIMARY}>
                            {it.decision ? "Accept instead" : "Accept"}
                          </button>
                        )}
                        {it.decision !== "reject" && (
                          <button type="button" disabled={busy} onClick={() => decide([it.row], "reject")} className={SMALL_SECONDARY}>
                            {it.decision ? "Reject instead" : "Reject: keep separate"}
                          </button>
                        )}
                      </span>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const LIST_LIMIT = 60;

/** A compact list of names; for matched ones, the technology each joins; for
 *  new ones, the technology code kept it apart from. */
function NameList({ items, joins, here }: { items: Item[]; joins: boolean; here: string }) {
  const [all, setAll] = useState(false);
  const shown = all ? items : items.slice(0, LIST_LIMIT);
  return (
    <div className="rounded-card border border-line bg-white px-5 py-3">
      <ul className="grid gap-x-8 gap-y-1.5 text-sm sm:grid-cols-2 2xl:grid-cols-3">
        {shown.map((it) => (
          <li key={it.row} className="min-w-0 [overflow-wrap:anywhere]">
            {joins ? (
              it.target_name && it.target_name.toLowerCase() !== it.name.toLowerCase()
                ? <>{it.name} <span className="text-muted">→</span> <TechLink item={it} here={here} /></>
                : <TechLink item={{ ...it, target_name: it.name }} here={here} />
            ) : <>
              {it.name}
              {it.kept_apart && <span className="text-[12px] text-muted"> · narrower than {it.kept_apart.name}, kept apart</span>}
            </>}
          </li>
        ))}
      </ul>
      {items.length > LIST_LIMIT && (
        <button type="button" onClick={() => setAll(!all)} className="mt-3 text-sm text-link hover:underline">
          {all ? "Show fewer" : `Show all ${items.length.toLocaleString()}`}
        </button>
      )}
    </div>
  );
}

type Lists = { availability: ListItem[]; domains: ListItem[]; subdomains: ListItem[] };

/** Values the file uses that our lists don't have: each mapped to one of ours,
 *  left out, or (a sub-domain) kept as written. A sub-domain waits for a
 *  person's choice; the others are left out until mapped. */
function ValuesTable({ imp, editable, onChange }: { imp: Import; editable: boolean; onChange: (imp: Import) => void }) {
  const [lists, setLists] = useState<Lists | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    Promise.all(["availability", "domains", "subdomains"].map((l) => fetchJson<{ items: ListItem[] }>(`/api/lists/${l}`)))
      .then(([a, d, s]) => { if (live) setLists({ availability: a.items, domains: d.items, subdomains: s.items }); })
      .catch((e) => { if (live) setListError(errorText(e)); });
    return () => { live = false; };
  }, []);

  const values = imp.unknown_values;
  if (!values.length) return <Empty>Every value is in our lists.</Empty>;

  const options = (u: Unknown): { value: string; name: string }[] => {
    if (u.field === "trl") return [1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => ({ value: String(n), name: `TRL ${n}` }));
    if (!lists) return [];
    const items = u.field === "availability" ? lists.availability : u.field === "domain" ? lists.domains
      : lists.subdomains.filter((s) => s.domain_id === u.domain_id);
    return items.map((i) => ({ value: i._id, name: i.name }));
  };
  const chosen = (u: Unknown) => u.map_to != null && u.map_to !== "" ? String(u.map_to)
    : u.field !== "subdomain" ? LEAVE : u.keep ? KEEP : u.keep === false ? LEAVE : "";
  const keyOf = (u: Unknown) => `${u.field}:${u.value}:${u.domain_id ?? ""}`;
  const save = async (u: Unknown, choice: string) => {
    setSaving(keyOf(u));
    setError(null);
    const keep = choice === KEEP;
    const map_to = keep || choice === LEAVE ? null : u.field === "trl" ? Number(choice) : choice;
    try {
      onChange(await sendJson<Import>(`/api/imports/${encodeURIComponent(imp._id)}/values`, "PUT",
        [{ field: u.field, value: u.value, domain_id: u.domain_id ?? null, map_to, keep }]));
    } catch (e) {
      setError(`Not saved: ${errorText(e)}.`);
    } finally {
      setSaving(null);
    }
  };
  const domainName = (id?: string) => lists?.domains.find((d) => d._id === id)?.name;
  const c = imp.counts;

  return (
    <div>
      <p className="text-[13px] text-neutral-700">
        Your file uses these values, which our lists don&apos;t have. Choose one of ours for each; a value left out is
        not set on its technologies. A sub-domain waits for your choice: one of ours, kept as written (a new
        sub-domain), or left out.
        {(c.values_waiting ?? 0) > 0 && ` ${plural(c.values_waiting ?? 0, "sub-domain")} still ${waitsOrWait(c.values_waiting ?? 0)}.`}
        {c.values_to_map > 0 && ` ${plural(c.values_to_map, "value")} ${isOrAre(c.values_to_map)} left out so far.`}
      </p>
      {listError && <p role="alert" className="mt-2 text-sm text-failed">Our lists couldn&apos;t be loaded: {listError}.</p>}
      {error && <p role="alert" className="mt-2 text-sm text-failed">{error}</p>}
      <div className="mt-3 overflow-x-auto rounded-card border border-line bg-white">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className={TH}>
              <th className="px-5 py-2 font-medium">Where</th>
              <th className="px-3 py-2 font-medium">In your file</th>
              <th className="px-5 py-2 font-medium">Use instead</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {values.map((u) => {
              const key = keyOf(u);
              const value = chosen(u);
              const under = u.field === "subdomain" ? domainName(u.domain_id) : undefined;
              return (
                <tr key={key} className="hover:bg-neutral-50">
                  <td className="px-5 py-2.5 align-top">
                    {FIELD_WORDS[u.field]}
                    {under && <span className="block text-[11.5px] text-muted">under {under}</span>}
                  </td>
                  <td className="px-3 py-2.5 align-top">
                    &ldquo;{u.value}&rdquo;
                    <span className="block text-[11px] text-muted">{plural(u.count, "row")}</span>
                  </td>
                  <td className="px-5 py-2.5 align-top">
                    <select aria-label={`Use instead of ${u.value}`} value={value}
                      disabled={!editable || saving === key || (u.field !== "trl" && !lists)}
                      onChange={(e) => save(u, e.target.value)}
                      className="max-w-full rounded-full border border-line bg-white px-3 py-1.5 text-[13px] text-ink disabled:opacity-60">
                      {value === "" && <option value="" disabled>Choose…</option>}
                      <option value={LEAVE}>Leave it out</option>
                      {u.field === "subdomain" && <option value={KEEP}>Keep as written</option>}
                      {options(u).map((o) => <option key={o.value} value={o.value}>{o.name}</option>)}
                    </select>
                    {saving === key ? <span className="block text-[11px] text-muted">Saving…</span>
                      : value === "" ? <span className="block text-[11px] text-amber-800">Waiting for your choice</span>
                        : value === LEAVE ? <span className="block text-[11px] text-amber-800">Not set on its technologies</span>
                          : value === KEEP ? <span className="block text-[11px] text-muted">Added as a new sub-domain</span> : null}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

type Tab = "matched" | "proposed" | "new" | "values";

function Review({ imp, editable, here, onChange }: { imp: Import; editable: boolean; here: string;
  onChange: (imp: Import) => void }) {
  const c = imp.counts;
  // opens where there is something to do; stays put while you work through it
  const [on, setTab] = useState<Tab>(() => waitingOf(c) ? "proposed" : c.values_waiting || c.values_to_map ? "values"
    : c.proposed ? "proposed" : imp.unknown_values.length ? "values" : c.new ? "new" : "matched");
  const tabs: [Tab, string, number][] = [["matched", "Matched exactly", c.matched], ["proposed", "Proposed matches", c.proposed],
    ["new", "New", c.new], ["values", "Values not in our lists", imp.unknown_values.length]];
  const exactShared = [...sharedTargets(imp.items)].filter(([, its]) => its.some((i) => i.group === "matched"));
  const keptApart = imp.items.filter((i) => i.group === "new" && i.kept_apart).length;

  return (
    <section className="mt-7">
      <h2 className="text-lg font-semibold">Review</h2>
      <div className="mt-2 flex flex-wrap gap-1.5" role="group" aria-label="What to review">
        {tabs.map(([t, text, n]) => (
          <button key={t} type="button" aria-pressed={on === t} onClick={() => setTab(t)}
            className={`rounded-full border px-3 py-1 text-[13px] ${on === t ? "border-navy bg-navy text-white" : "border-line bg-white hover:bg-ground"}`}>
            {text} <span className={`tabular-nums ${on === t ? "text-white/75" : "text-muted"}`}>{n.toLocaleString()}</span>
          </button>
        ))}
      </div>
      <div className="mt-3">
        {on === "proposed" && <Proposed imp={imp} editable={editable} here={here} onChange={onChange} />}
        {on === "matched" && (c.matched ? <>
          <p className="mb-3 text-[13px] text-neutral-700">
            Already known to the radar, by name or alias: each joins the technology shown, and its row&apos;s values are
            set on it, unless another row joins it too. No model call was needed.
          </p>
          <SharedNotice groups={exactShared} imp={imp} here={here} />
          <div className="mt-3"><NameList items={imp.items.filter((i) => i.group === "matched")} joins here={here} /></div>
        </> : <Empty>No name in the file matched a technology the radar already knows exactly.</Empty>)}
        {on === "new" && (c.new ? <>
          <p className="mb-3 text-[13px] text-neutral-700">
            New to the radar: each comes in as a new technology with no pages yet
            {c.rejected > 0 && `, as ${c.rejected === 1 ? "does the" : `do the ${c.rejected.toLocaleString()}`} rejected proposed ${c.rejected === 1 ? "match" : "matches"}`}.
            {keptApart > 0 && ` For ${plural(keptApart, "name")}, the model proposed a broader technology; code kept ${keptApart === 1 ? "it" : "them"} apart, because the name adds a word in front or says what it is for, in, at or on.`}
          </p>
          <NameList items={imp.items.filter((i) => i.group === "new")} joins={false} here={here} />
        </> : <Empty>
          No new names{c.rejected > 0 && `, besides the ${plural(c.rejected, "rejected proposed match", "rejected proposed matches")}, which come in as new`}.
        </Empty>)}
        {on === "values" && <ValuesTable imp={imp} editable={editable} onChange={onChange} />}
      </div>
    </section>
  );
}

/** One import, open: what was read, then the step it is at. */
function ImportView({ imp, here, onChange, onAnother, onDiscarded }: { imp: Import; here: string;
  onChange: (imp: Import) => void; onAnother: () => void; onDiscarded: (imp: Import) => void }) {
  const editable = editableStatus(imp.status);
  const c = imp.counts;
  const waiting = waitingOf(c);
  const valuesWaiting = c.values_waiting ?? 0;
  const joins = c.matched + c.accepted;
  const added = c.new + c.rejected;
  const sharing = [...sharedTargets(imp.items).values()].filter((its) => its.every((i) => i.decision !== null || i.group === "matched"))
    .reduce((n, its) => n + its.length, 0);
  const reopened = reopenedOf(imp);
  // for a reopened import, confirming again settles only the rows that came back
  const back = reopened ? imp.items.filter((i) => reopened.rows.includes(i.row)) : [];
  const backJoin = back.filter((i) => i.group === "matched" || i.decision === "accept").length;
  const base = `/api/imports/${encodeURIComponent(imp._id)}`;

  return (
    <>
      <CheckCard imp={imp} onAnother={onAnother} />
      {reopened && (
        <p role="status" className="mt-3 text-sm text-neutral-700">
          <b className="font-semibold">{confirmedWords(imp)}.</b> Reopened {formatAt(reopened.at)}:{" "}
          {plural(reopened.rows.length, "match", "matches")} came back for review, and the{" "}
          {plural(reopened.withdrawn, "value")} they had set on the technologies they joined{" "}
          {reopened.withdrawn === 1 ? "was" : "were"} withdrawn. Confirming again settles only these; the other rows
          stay as they are.
        </p>
      )}
      {imp.status === "discarded" && (
        <p className="mt-5 rounded-card border border-line bg-neutral-50 px-5 py-3 text-sm text-muted">
          This import was discarded: nothing from it was saved. Upload the file again to start over.
        </p>
      )}
      {editable && c.unmatched > 0 && <MatchCard key={imp._id} imp={imp} onMatched={onChange} />}
      {c.unmatched === 0 && <Review key={imp._id} imp={imp} editable={editable} here={here} onChange={onChange} />}

      {editable && (
        <section className="mt-7">
          <div className="flex flex-wrap items-start gap-3">
            <ConfirmAction label={reopened ? `Confirm the ${plural(back.length, "reopened match", "reopened matches")} again`
              : `Confirm import: ${c.matched.toLocaleString()} matched, ${c.accepted.toLocaleString()} accepted, ${added.toLocaleString()} new`}
              confirmLabel={reopened ? "Confirm again" : "Confirm import"}
              disabled={c.unmatched ? `Match the names first: ${plural(c.unmatched, "name")} ${isOrAre(c.unmatched)} not matched yet.`
                : waiting ? `Accept or reject every proposed match first: ${waiting.toLocaleString()} still ${waitsOrWait(waiting)}.`
                  : valuesWaiting ? `Choose what to do with every sub-domain not in our lists first: ${valuesWaiting.toLocaleString()} still ${waitsOrWait(valuesWaiting)}.`
                    : null}
              question={reopened
                ? `Confirm the ${plural(back.length, "reopened match", "reopened matches")} again? ${plural(backJoin, "row")} ${backJoin === 1 ? "joins its" : "join their"} technology and ${plural(back.length - backJoin, "row")} ${back.length - backJoin === 1 ? "comes" : "come"} in as new. The other rows stay as they are.`
                : `Confirm this import? ${plural(joins, "name")} join existing technologies and ${plural(added, "technology", "technologies")} ${isOrAre(added)} added with no pages yet. Each row's values become a person's choices${
                sharing ? `, except for the ${plural(sharing, "row")} that share a technology with another row: their values stay on this import's record` : ""}.${
                c.values_to_map ? ` ${plural(c.values_to_map, "value")} not in our lists ${isOrAre(c.values_to_map)} left out.` : ""}`}
              onConfirm={async () => {
                const result = await sendJson<Result>(`${base}/confirm`, "POST");
                onChange({ ...imp, status: "confirmed", result });
              }} />
            {/* a reopened import was confirmed once: what it saved stays, so it can't be discarded */}
            {!reopened && (
              <ConfirmAction secondary label="Discard this import" confirmLabel="Discard"
                question="Discard this import? Nothing from it has been saved; it stays in the history as discarded."
                onConfirm={async () => {
                  await sendJson(base, "DELETE");
                  onDiscarded({ ...imp, status: "discarded" });
                }} />
            )}
          </div>
          {c.unmatched === 0 && c.values_to_map > 0 && (
            <p className="mt-2 text-xs text-muted">
              {plural(c.values_to_map, "value")} not in our lists {isOrAre(c.values_to_map)} left out unless you map
              {c.values_to_map === 1 ? " it" : " them"} under Values not in our lists.
            </p>
          )}
        </section>
      )}

      {imp.status === "confirmed" && imp.result && (
        <section className="mt-6 rounded-card border border-emerald-200 bg-emerald-50/60 px-5 py-4 text-sm">
          <p className="font-semibold text-emerald-900">Imported</p>
          <p className="mt-1 text-neutral-800">
            {imp.result.joined.toLocaleString()} joined existing technologies (their names in your file became aliases),
            {" "}{imp.result.added.toLocaleString()} added with no pages yet. Each row&apos;s values are now set as a
            person&apos;s choices
            {imp.result.shared ? <>, except for the {plural(imp.result.shared, "row")} that share a technology with another
              row: their values are kept on this import&apos;s record, not set on the technology</> : null}.
          </p>
          <Link href="/admin/technologies?view=imported_thin" className="mt-2 inline-block text-link hover:underline">
            See them on Technologies →
          </Link>
        </section>
      )}
    </>
  );
}

function History({ tick, openId, onOpen }: { tick: number; openId: string | null; onOpen: (id: string) => void }) {
  const [list, setList] = useState<Summary[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    fetchJson<{ imports: Summary[] }>("/api/imports")
      .then((d) => { if (live) { setList(d.imports); setError(null); } })
      .catch((e) => { if (live) setError(errorText(e)); });
    return () => { live = false; };
  }, [tick]);

  return (
    <section className="mt-10">
      <h2 className="text-lg font-semibold">Past imports</h2>
      {error && <p role="alert" className="mt-2 text-sm text-failed">The past imports couldn&apos;t be loaded: {error}.</p>}
      {list && list.length === 0 && <p className="mt-2 text-sm text-muted">No imports yet.</p>}
      {list && list.length > 0 && (
        <>
          <p className="mt-1 text-xs text-muted">Newest first{list.length >= 20 && ", the 20 most recent"}. Choose one to open it.</p>
          <ul className="mt-2 divide-y divide-neutral-100 rounded-card border border-line bg-white">
            {list.map((s) => {
              const st = statusWords(s);
              const open = s._id === openId;
              return (
                <li key={s._id}>
                  <button type="button" onClick={() => onOpen(s._id)} aria-current={open ? "true" : undefined}
                    className={`flex w-full flex-wrap items-baseline gap-x-5 gap-y-1 px-5 py-3 text-left text-sm ${
                      open ? "bg-azure/5" : "hover:bg-neutral-50"}`}>
                    <span className="w-full text-xs text-muted sm:w-52 sm:shrink-0">{formatAt(s.at, s.tz)}</span>
                    <span className="min-w-0 flex-1 basis-56 [overflow-wrap:anywhere]">
                      <span className="font-medium">{s.file}</span>
                      <span className="block text-xs text-muted">sheet {s.sheet} · {plural(s.rows, "row")}</span>
                    </span>
                    <span className={`whitespace-nowrap rounded-full px-2 py-0.5 text-[11.5px] ${st.style}`}>{st.text}</span>
                    <span className="text-[13px] text-neutral-700">{countsLine(s)}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </section>
  );
}

function ImportTechnologies() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const here = useHere();
  const id = params.get("id");
  // the open import (?id=), fetched again when the address changes; a failure
  // keeps its id, so it isn't shown over the next import while that loads
  const [imp, setImp] = useState<Import | null>(null);
  const [openError, setOpenError] = useState<{ id: string; why: string } | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [historyTick, setHistoryTick] = useState(0);
  const shown = imp && imp._id === id ? imp : null;

  useEffect(() => {
    if (!id) return;
    let live = true;
    fetchJson<Import>(`/api/imports/${encodeURIComponent(id)}`)
      .then((d) => { if (live) setImp(d); })
      .catch((e) => { if (live) setOpenError({ id, why: errorText(e) }); });
    return () => { live = false; };
  }, [id]);

  const reloadHistory = () => setHistoryTick((n) => n + 1);
  const open = (next: string | null, scroll = false) => {
    setNote(null);
    router.replace(next ? `${pathname}?id=${encodeURIComponent(next)}` : pathname, { scroll });
  };
  const failed = !!id && !shown && openError?.id === id;

  return (
    <div>
      <PageHeader title="Import technologies"
        intro="Bring in the catalog, Tata's own list of emerging technologies: matched against the technologies the radar already knows, reviewed by you, then confirmed. A new file saves nothing until you confirm it."
        help={<>
          <li>An import says &ldquo;these are emerging technologies Tata cares about&rdquo;. Each row&apos;s commercial
            availability is kept as a person&apos;s choice, as are its domain, sub-domain and TRL, and a person&apos;s
            choice wins over what the model judges.</li>
          <li>A name that matches a technology the radar already knows exactly, by its name or an alias, joins it at no cost.
            A name whose words outside or inside its brackets are a technology&apos;s (&ldquo;DNS Security Extensions
            (DNSSEC)&rdquo;) is proposed at no cost.</li>
          <li>The other names go to the model, which proposes matches under other words. It never folds a
            narrower technology into a broader one, and code keeps apart a name that adds a word in front or says what
            it is for, in, at or on. A person accepts or rejects each proposal; a rejected match comes in as a new
            technology.</li>
          <li>When several rows would join one technology, none of their values is set on it: which is right is a
            person&apos;s call, so they stay on this import&apos;s record.</li>
          <li>Values your file uses that our lists don&apos;t have are mapped to one of ours, or left out. A sub-domain
            waits for your choice, and can also be kept as written.</li>
          <li>Importing the same list again updates what is there and never makes duplicates.</li>
          <li>When matches of a confirmed import are reopened for review, the page says when it was confirmed, what
            it saved, and which matches came back. Confirming again settles only those.</li>
          <li>Imported technologies with no pages yet can be looked up with Find evidence on their page.</li>
        </>} />

      <Steps imp={shown} />
      {note && <p role="status" className="mt-3 text-sm text-muted [overflow-wrap:anywhere]">{note}</p>}
      {id && !shown && (failed
        ? <p role="alert" className="mt-5 rounded-card border border-failed/40 bg-failed/5 px-5 py-3 text-sm text-failed">
          This import couldn&apos;t be opened: {openError?.why}.</p>
        : <p className="mt-5 flex items-center gap-2 text-sm text-muted"><span className={LIVE_DOT} />Opening the import…</p>)}
      {(!id || failed) && (
        <UploadCard onUploaded={(d) => { setImp(d); reloadHistory(); open(d._id); }} />
      )}
      {shown && (
        <ImportView imp={shown} here={here}
          onChange={(d) => { setImp(d); reloadHistory(); }}
          onAnother={() => open(null)}
          onDiscarded={(d) => {
            setImp(d);
            reloadHistory();
            open(null);
            setNote(`Discarded ${d.file}: nothing from it was saved.`);
          }} />
      )}

      <History tick={historyTick} openId={id} onOpen={(next) => open(next, true)} />
    </div>
  );
}

export default function ImportPage() {
  return (
    <Suspense fallback={null}>
      <ImportTechnologies />
    </Suspense>
  );
}
