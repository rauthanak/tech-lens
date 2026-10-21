"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import ActButton from "@/components/ActButton";
import ConfirmAction from "@/components/ConfirmAction";
import { NascentAnswer, type YesReplaces } from "@/components/NascentFlag";
import { calls, resumeAssessment, startAssessment, startCheck, startClassify, writePovs } from "@/lib/actions";
import { errorText, fetchJson, sendJson } from "@/lib/api";
import { plural } from "@/lib/format";
import { type GateItem, gateRow, type GateRow } from "@/lib/gates";
import { type AnalystItem, blockedReason, isLive, usePipeline } from "@/lib/pipeline";
import { itemHref, itemSentence } from "@/lib/waiting";

const SHOWN = 5;

/** A row of either list: its sentence, its one action (cost first), and for
 *  each technology behind it, its own one-click answer where there is one. */
type Entry = { row: GateRow; action?: React.ReactNode; perTech?: (i: number) => React.ReactNode };

function Row({ row, action, perTech }: Entry) {
  const [all, setAll] = useState(false);
  const list = row.list ?? [];
  return (
    <li className="py-3">
      <div className="flex items-baseline gap-3">
        <span className="w-10 shrink-0 text-right text-xl font-semibold tabular-nums">{row.count.toLocaleString()}</span>
        <div className="min-w-0 flex-1">
          <p className="text-[14px]">
            {row.href ? <Link href={row.href} className="hover:underline">{row.sentence} →</Link> : row.sentence}
          </p>
          {row.sub && <p className="mt-0.5 text-[12.5px] text-muted">{row.sub}</p>}
          {action && <div className="mt-1.5">{action}</div>}
          {list.length > 0 && (
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
        </div>
      </div>
    </li>
  );
}

/** A Briefing card that folds: its title and what waits, always; open, its
 *  intro and the rest. Closed until opened; open or closed is
 *  remembered in this browser, per card. */
export function BriefingCard({ id, title, summary, intro, children }: {
  id: string;
  title: string;
  summary?: React.ReactNode;
  intro: React.ReactNode;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDetailsElement>(null);
  const key = `tech-lens:briefing-open:${id}`;
  useEffect(() => {
    try {
      if (ref.current && window.localStorage.getItem(key) === "open") ref.current.open = true;
    } catch {
      // storage unavailable: it stays closed
    }
  }, [key]);
  const remember = (open: boolean) => {
    try {
      window.localStorage.setItem(key, open ? "open" : "closed");
    } catch {
      // storage unavailable: nothing to remember
    }
  };
  return (
    <details ref={ref} onToggle={(e) => remember(e.currentTarget.open)} aria-label={title}
      className="group rounded-card border border-line bg-white px-5 py-4">
      <summary className="flex cursor-pointer list-none flex-wrap items-baseline gap-x-2.5 gap-y-0.5 [&::-webkit-details-marker]:hidden">
        <span aria-hidden className="inline-block w-3 text-[11px] text-muted transition-transform group-open:rotate-90">▶</span>
        <h2 className="text-[17px] font-semibold">{title}</h2>
        {/* beside the title, or under it on narrow screens */}
        {summary && <span className="basis-full pl-5 text-[13.5px] text-muted sm:basis-auto sm:pl-0">
          <span className="hidden sm:inline">· </span>{summary}</span>}
      </summary>
      <p className="mt-1 pl-5 text-[13px] text-muted">{intro}</p>
      <div className="pl-5">{children}</div>
    </details>
  );
}

/** One of the two lists, as a folding card: closed, how many things wait and
 *  how many items they hold in all (a technology counts once per row). */
function Card({ id, title, intro, rows, empty, loaded }: {
  id: string; title: string; intro: string; rows: Entry[]; empty: string; loaded: boolean;
}) {
  const items = rows.reduce((n, r) => n + r.row.count, 0);
  const summary = !loaded ? undefined : rows.length === 0 ? "Nothing waits"
    : `${plural(rows.length, "thing")} to settle · ${plural(items, "item")}`;
  return (
    <BriefingCard id={id} title={title} summary={summary} intro={intro}>
      {rows.length === 0 ? loaded && <p className="mt-3 text-sm text-muted">{empty}</p> : (
        <ul className="mt-1 divide-y divide-neutral-100">{rows.map((r) => <Row key={r.row.key} {...r} />)}</ul>
      )}
    </BriefingCard>
  );
}

const them = (n: number) => (n === 1 ? "it" : "them");

/** The two to-do lists: what to settle before technologies are scored, and
 *  before a Point of View goes to leaders. Counted by
 *  technology, what blocks a placement first. A row that is one decision is
 *  done in place: a run with its cost shown first, or Yes / No per
 *  technology; the rest open the place where it's done. */
export default function GateList() {
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
  return (
    <>
      {error && <p className="mt-5 text-sm text-failed">The to-do lists didn&apos;t load: {error}</p>}
      <div className="mt-5 space-y-3">
        <Card id="before-scoring" title="Before scoring" rows={gate1} loaded={!!gates}
          intro="What to settle before technologies are assessed."
          empty="Nothing waits before scoring. The next collection may bring some." />
        <Card id="before-publishing" title="Before publishing" rows={gate2} loaded={!!gates}
          intro="What to settle before a Point of View goes to leaders."
          empty="Nothing waits before publishing." />
      </div>
    </>
  );
}
