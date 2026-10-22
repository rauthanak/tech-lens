"use client";

import Link from "next/link";
import { useEffect, useState, useSyncExternalStore } from "react";
import ActButton from "@/components/ActButton";
import ConfirmAction from "@/components/ConfirmAction";
import { NascentAnswer, type YesReplaces } from "@/components/NascentFlag";
import { usePublish } from "@/components/PublishEdition";
import { calls, resumeAssessment, startAssessment, startCheck, startClassify, writePovs } from "@/lib/actions";
import { errorText, fetchJson, sendJson } from "@/lib/api";
import { plural } from "@/lib/format";
import { type GateItem, gateRow, type GateRow } from "@/lib/gates";
import { type AnalystItem, blockedReason, isLive, usePipeline } from "@/lib/pipeline";
import { itemHref, itemSentence } from "@/lib/waiting";

const SHOWN = 5;

/** A card of either list: its sentence, its one action (cost first), and
 *  folded behind "Which ones", the technologies behind it, each with its own
 *  one-click answer where there is one. */
type Entry = { row: GateRow; action?: React.ReactNode; perTech?: (i: number) => React.ReactNode };

function Card({ row, action, perTech }: Entry) {
  const [which, setWhich] = useState(false);
  const [all, setAll] = useState(false);
  const list = row.list ?? [];
  return (
    <li className="rounded-card border border-line px-4 py-3">
      <p className="text-[14px] font-medium">
        {row.href ? <Link href={row.href} className="hover:underline">{row.sentence} →</Link> : row.sentence}
      </p>
      {row.sub && <p className="mt-0.5 text-[12.5px] text-muted">{row.sub}</p>}
      {action && <div className="mt-2">{action}</div>}
      {list.length > 0 && (
        <button type="button" aria-expanded={which} onClick={() => setWhich(!which)}
          className="mt-1.5 text-[13px] text-link hover:underline">
          {which ? "Hide ▴" : perTech ? "Which ones, to answer each ▾" : "Which ones ▾"}
        </button>
      )}
      {which && (
        <ul className="mt-1.5 space-y-1 text-[13px]">
          {(all ? list : list.slice(0, SHOWN)).map((t, i) => (
            <li key={`${i}:${t.href}`} className="flex flex-wrap items-baseline gap-x-2">
              <Link href={t.href} className="text-link hover:underline">{t.label}</Link>
              {perTech?.(i)}
              {t.note && <span className="basis-full text-muted">{t.note}</span>}
            </li>
          ))}
          {list.length > SHOWN && (
            <li>
              <button type="button" onClick={() => setAll(!all)} className="text-link hover:underline">
                {all ? "Show fewer" : `Show all ${list.length}`}
              </button>
            </li>
          )}
        </ul>
      )}
    </li>
  );
}

const PEEK = 3; // the rows a column shows before "and n more"

// which column's full list is open, remembered in this browser (as lib/hood does)
const OPEN_KEY = "tech-lens:briefing-todo";
const OPEN_EVENT = "tech-lens:briefing-todo";
function readOpen(): string | null {
  try { return window.localStorage.getItem(OPEN_KEY); } catch { return null; }
}
function subscribe(onChange: () => void): () => void {
  window.addEventListener(OPEN_EVENT, onChange);
  return () => window.removeEventListener(OPEN_EVENT, onChange);
}
/** Open one of the strip's columns, for a link from elsewhere ("publish" from a Point of View). */
export function openTodo(id: string | null): void {
  try {
    if (id) window.localStorage.setItem(OPEN_KEY, id);
    else window.localStorage.removeItem(OPEN_KEY);
  } catch { /* storage unavailable: nothing to remember */ }
  window.dispatchEvent(new Event(OPEN_EVENT));
}

/** One column of the To do strip: its title, the first rows in a few words
 *  (each opening where it's done), and Open, which shows the full list
 *  below the strip. */
function Column({ id, title, lines, more, open, onToggle }: {
  id: string; title: string; lines: { key: string; text: string; href?: string }[] | null; more: number;
  open: boolean; onToggle: () => void;
}) {
  return (
    <div className={`px-5 py-4 ${open ? "bg-navy/[0.04]" : ""}`}>
      <h3 className="flex items-baseline justify-between gap-3">
        <button type="button" aria-expanded={open} aria-controls={`todo-${id}`} onClick={onToggle}
          className="text-left text-[15px] font-semibold hover:underline">{title}</button>
        <button type="button" aria-expanded={open} aria-controls={`todo-${id}`} onClick={onToggle}
          className="shrink-0 text-[12.5px] text-link hover:underline">{open ? "Close ▴" : "Open ▾"}</button>
      </h3>
      {lines && (
        <ul className="mt-1.5 space-y-1 text-[13px]">
          {lines.length === 0 && <li className="text-muted">Nothing waits</li>}
          {lines.map((l) => (
            <li key={l.key}>{l.href ? <Link href={l.href} className="hover:underline">{l.text}</Link> : l.text}</li>
          ))}
          {more > 0 && <li><button type="button" onClick={onToggle} className="text-muted hover:underline">and {plural(more, "more thing")}</button></li>}
        </ul>
      )}
    </div>
  );
}

const them = (n: number) => (n === 1 ? "it" : "them");

/** The Briefing's To do, one strip of three columns: what to settle before
 *  technologies are scored, before a Point of View goes to leaders, and
 *  publishing the edition. Each column shows its first rows; Open shows its
 *  full list below the strip as cards (remembered in this browser), where one
 *  that is one decision is done in place: a run with its cost shown first, or Yes
 *  / No per technology; the rest open the place where it's done. Counted by
 *  technology, what blocks a placement first. */
export default function TodoStrip() {
  const p = usePipeline();
  const [gates, setGates] = useState<{ gate1: GateItem[]; gate2: GateItem[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [answered, setAnswered] = useState(0); // a one-click answer reads the lists again
  const progress = p ? `${p.assess.status}:${p.pov.composed}:${p.collect.status}:${p.classify?.status}` : "";
  useEffect(() => {
    fetchJson<{ gate1: GateItem[]; gate2: GateItem[] }>("/api/gates")
      .then((g) => { setGates(g); setError(null); })
      .catch((e) => setError(errorText(e)));
  }, [progress, answered]);
  const again = () => setAnswered((n) => n + 1);
  const blocked = blockedReason(p, "assess");
  const publish = usePublish();
  const open = useSyncExternalStore(subscribe, readOpen, () => null);
  const toggle = (id: string) => openTodo(open === id ? null : id);

  const pipelineAction = (i: AnalystItem): React.ReactNode => {
    switch (i.kind) {
      case "check": return (
        <ConfirmAction secondary label={`Check ${them(i.count)}`} cost={calls(i.calls)} disabled={blockedReason(p, "recheck")}
          question={`Check ${plural(i.count, "older page")} against the signal list? About ${plural(i.calls, "model call")}.`}
          onConfirm={startCheck} />
      );
      case "resume": return (
        <ConfirmAction secondary label="Resume" cost={calls(i.calls)} disabled={blocked}
          question={`Resume the assessment run? About ${plural(i.calls, "model call")} for the ${plural(i.count, "technology", "technologies")} left.`}
          onConfirm={() => resumeAssessment(i.scoring_run_id)} />
      );
      case "assess": return (
        <ConfirmAction secondary label={`Assess ${them(i.count)} again`} cost={calls(i.calls)} disabled={blocked}
          question={`Assess ${plural(i.count, "technology", "technologies")} with new pages? About ${plural(i.calls, "model call")} (up to ${i.calls_max}).`}
          onConfirm={() => startAssessment(i.tech_ids)} />
      );
      case "write": return (
        <ConfirmAction secondary label={`Write ${them(i.count)}`} cost={calls(i.calls)} confirmLabel="Write" doneLabel="Started"
          question={`Write ${plural(i.count, "Point of View", "Points of View")}? About ${plural(i.calls, "model call")}.`}
          onConfirm={() => writePovs(false)} />
      );
    }
  };
  const fromPipeline = (kinds: AnalystItem["kind"][]): Entry[] => (p?.for_analyst ?? [])
    .filter((i) => kinds.includes(i.kind))
    .map((i) => ({ row: { key: i.kind, count: i.count, sentence: itemSentence(i), href: itemHref(i) }, action: pipelineAction(i) }));

  const entry = (item: GateItem): Entry => {
    const row = gateRow(item);
    const techs = (item.technologies ?? []) as (NonNullable<GateItem["technologies"]>[number] & { replaces?: YesReplaces })[];
    switch (item.kind) {
      case "classify": return { row, action: (
        <ConfirmAction secondary label={`Classify ${them(item.count)}`} cost={calls(item.calls ?? item.count)}
          disabled={isLive(p?.classify?.status) ? "Technologies are being classified now." : null}
          question={`Classify ${plural(item.count, "technology", "technologies")} with new pages? One model call each, within the run's token budget (Setup › Settings).`}
          onConfirm={() => startClassify(null)} />
      ) };
      case "ready_to_assess": return { row, action: (
        <ConfirmAction secondary label={`Assess ${them(item.count)}`} cost={calls(item.calls ?? 0)} disabled={blocked}
          question={`Assess ${plural(item.count, "technology", "technologies")} ready to assess? About ${plural(item.calls ?? 0, "model call")}.`}
          onConfirm={() => startAssessment((item as GateItem & { tech_ids?: string[] }).tech_ids ?? [])} />
      ) };
      case "nascent": return { row, perTech: (i) => (
        <NascentAnswer compact techId={techs[i].tech_id} replaces={techs[i].replaces} onDone={again} />
      ) };
      case "switched_off_with_pages": return { row, perTech: (i) => (
        <ActButton label="Switch back on" onDone={again}
          run={() => sendJson("/api/technologies/bulk", "POST", { ids: [techs[i].tech_id], action: "switch_on" })} />
      ) };
      default: return { row };
    }
  };
  const gate1 = [...fromPipeline(["check", "resume", "assess"]), ...(gates?.gate1 ?? []).map(entry)];
  const gate2 = [...fromPipeline(["write"]), ...(gates?.gate2 ?? []).map(entry)];
  const lists = [
    { id: "before-scoring", title: "Before scoring", rows: gate1, intro: "What to settle before technologies are assessed.",
      empty: "Nothing waits before scoring. The next collection may bring some." },
    { id: "before-publishing", title: "Before publishing", rows: gate2,
      intro: "What to settle before a Point of View goes to leaders. Advice, not a gate: whatever is unsettled goes out as it stands, with its reason.", empty: "Nothing waits before publishing." },
  ];
  const shown = lists.find((l) => l.id === open);
  return (
    <>
      {error && <p className="mt-3 text-sm text-failed">The to-do lists didn&apos;t load: {error}</p>}
      <section aria-label="To do" className="mt-3 overflow-hidden rounded-card border border-line bg-white">
        <div className="grid grid-cols-1 divide-y divide-neutral-100 md:grid-cols-3 md:divide-x md:divide-y-0">
          {lists.map((l) => (
            <Column key={l.id} id={l.id} title={l.title} open={open === l.id} onToggle={() => toggle(l.id)}
              lines={gates ? l.rows.slice(0, PEEK).map((r) => ({ key: r.row.key, text: r.row.sentence, href: r.row.href })) : null}
              more={Math.max(0, l.rows.length - PEEK)} />
          ))}
          <Column id="publish" title="Publish to leaders" open={open === "publish"} onToggle={() => toggle("publish")}
            lines={publish.lines && publish.lines.map((t, i) => ({ key: String(i), text: t }))} more={0} />
        </div>
        {open && (
          <div id={`todo-${open}`} className="border-t border-line px-5 py-4">
            <p className="text-[13px] text-muted">{shown ? shown.intro : publish.intro}</p>
            {shown ? (shown.rows.length === 0 ? <p className="mt-3 text-sm text-muted">{shown.empty}</p> : (
              <ul className="mt-3 grid grid-cols-1 items-start gap-3 md:grid-cols-2 xl:grid-cols-3">
                {shown.rows.map((r) => <Card key={r.row.key} {...r} />)}
              </ul>
            )) : publish.panel}
          </div>
        )}
      </section>
    </>
  );
}
