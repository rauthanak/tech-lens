"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import ConfirmAction from "@/components/ConfirmAction";
import BackLink from "@/components/BackLink";
import { Review } from "@/components/ImportReview";
import PageHeader from "@/components/PageHeader";
import { calls } from "@/lib/actions";
import { ApiError, errorText, fetchJson, sendForm, sendJson } from "@/lib/api";
import { formatAt, formatTokens, plural } from "@/lib/format";
import { useHere } from "@/lib/here";
import { LIVE_DOT } from "@/lib/theme";
import {
  CARD, COLUMNS, confirmedWords, countsLine, editableStatus, type Import, isOrAre, reopenedOf, type Result, SECONDARY,
  sharedTargets, statusWords, type Summary, waitingOf, waitsOrWait,
} from "@/lib/imports";

// Import Tata's catalog: its own list of emerging technologies (tech-atlas services/imports):
// upload an .xlsx, check what was read, match the names against the
// technologies the radar already knows, review the proposals and the values
// our lists don't have, then confirm. A new file saves nothing until it is
// confirmed; a confirmed one can have matches reopened for review.


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
    // a flat progress strip, not pills: the steps show where the import is, they aren't buttons
    <ol className="mt-5 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[13px] sm:gap-x-1" aria-label="Steps">
      {steps.map((s, i) => (
        <li key={s.label} aria-current={s.state === "on" ? "step" : undefined} className="flex items-center gap-1.5">
          {i > 0 && <span aria-hidden className={`mx-1 hidden h-px w-6 sm:block ${s.state === "todo" ? "bg-line" : "bg-navy"}`} />}
          <span aria-hidden className={`flex h-[18px] w-[18px] items-center justify-center rounded-full text-[10px] ${
            s.state === "done" ? "bg-navy text-white" : s.state === "on" ? "border-2 border-navy bg-white text-navy" : "border-2 border-line bg-white text-muted"}`}>
            {s.state === "done" ? "✓" : i + 1}</span>
          <span className={s.state === "on" ? "font-semibold text-ink" : s.state === "done" ? "text-ink" : "text-muted"}>
            {s.label}{s.note && <span className="font-normal text-muted"> · {s.note}</span>}
          </span>
          <span className="sr-only">{s.state === "done" ? ": done" : s.state === "on" ? ": now" : ": not yet"}</span>
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

function ImportView({ imp, here, onChange, onAnother, onDiscarded }: { imp: Import; here: string;
  onChange: (imp: Import) => void; onAnother: () => void; onDiscarded: (imp: Import) => void }) {
  const replaced = imp.replaced_by;
  const editable = editableStatus(imp.status) && !replaced;
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
      {replaced && (
        <div role="status" className="mt-5 rounded-card border border-line bg-neutral-50 px-5 py-3 text-sm text-neutral-700">
          <p>
            <b className="font-semibold">Nothing here needs a decision.</b> A newer import of the same file, uploaded{" "}
            {formatAt(replaced.at, replaced.tz)}, was confirmed{replaced.confirmed_at ? ` ${formatAt(replaced.confirmed_at, replaced.confirmed_tz)}` : ""}{" "}
            and settled every row this one asks about. Upload the file again to change anything.
          </p>
          <Link href={`/admin/import?id=${encodeURIComponent(replaced.id)}`} className="mt-1 inline-block text-link hover:underline">
            Open the newer import →</Link>
          {!reopened && (
            <div className="mt-2">
              <ConfirmAction secondary label="Discard this import" confirmLabel="Discard"
                question="Discard this import? Nothing from it has been saved; it stays in the history as discarded."
                onConfirm={async () => {
                  await sendJson(`/api/imports/${encodeURIComponent(imp._id)}`, "DELETE");
                  onDiscarded({ ...imp, status: "discarded" });
                }} />
            </div>
          )}
        </div>
      )}
      {reopened && !replaced && (
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
          <p className="mt-1 text-xs text-muted">The one waiting for your decision first, then newest first{list.length >= 20 && ", the 20 most recent"}. Choose one to open it.</p>
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
      <BackLink fallback="/admin/technologies" fallbackLabel="Technologies" />
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
