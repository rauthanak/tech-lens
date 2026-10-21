"use client";

import ActButton from "@/components/ActButton";
import AddLink from "@/components/AddLink";
import FindEvidence from "@/components/FindEvidence";
import LeverChain from "@/components/LeverChain";
import PageRefs from "@/components/PageRefs";
import { decide, undo } from "@/lib/decisions";
import type { Pages, UseCase, ValueLists } from "@/lib/value";

/** Where the value lands in one fabric: the fabric's key metrics, then the
 *  use cases its pages support, each with its two levers as chains (lever 1,
 *  contribution; lever 2, delivery cost) and the capital it needs; with none,
 *  what evidence would show one, Find use cases, and any suggested ones (not
 *  from the pages) for a person to accept or reject. A mapping that failed
 *  says why. */
export default function UseCases({ cases, suggested, none, failed, decisions, pages, lists, techId, fabricId, onChanged, readOnly }: {
  cases: UseCase[];
  suggested: UseCase[];
  none: { reason: string; evidence_needed: string } | null;
  failed?: string | null;
  decisions: Record<string, { _id: string; value: string }>;
  pages: Pages;
  lists: ValueLists;
  techId: string;
  fabricId: string;
  onChanged?: () => void;
  readOnly?: boolean;
}) {
  const metrics = lists.fabrics[fabricId]?.key_metrics;
  const order = (id: string) => lists.levers[id]?.order ?? 9;
  const findAgain = !readOnly && (
    <div className="mt-2 flex flex-wrap items-center gap-3">
      <FindEvidence gap={{ kind: "use_case", tech_id: techId, fabric_id: fabricId }} label="Find use cases" onDone={onChanged} />
      <AddLink gap={{ tech_id: techId, fabric_id: fabricId, target: "use_case" }} onDone={onChanged} />
    </div>
  );
  return (
    <div className="space-y-3">
      {lists.error && <p className="text-[12px] text-failed">Lever and mechanism names couldn&apos;t load, so ids show instead: {lists.error}</p>}
      {metrics && <p className="text-[12.5px] text-muted"><span className="font-medium text-ink">Key metrics in this fabric:</span> {metrics}.
        Each lever&apos;s metric comes from these where one fits.</p>}
      {failed && !cases.length && (
        <div className="rounded-lg border border-dashed border-amber-300 bg-amber-50/50 p-3 text-[13px]">
          <p><b>Couldn&apos;t map where the value lands.</b> The model&apos;s answer didn&apos;t fit the skill&apos;s rules twice: {failed}.</p>
          {findAgain}
        </div>
      )}
      {!failed && !cases.length && !none && !suggested.length && (
        <p className="text-[13px] text-muted">Not mapped yet: the next assessment maps where the value lands.</p>
      )}
      {cases.map((uc) => (
        <div key={uc.key}>
          <div className="flex flex-wrap items-baseline gap-2">
            <span className="font-semibold">{uc.rank}. {uc.title}</span>
            <PageRefs ids={uc.pages} pages={pages} />
          </div>
          <p className="text-[12.5px] text-muted">
            <span className="font-medium text-ink">Capital needed:</span>{" "}
            {uc.capital?.direction ? <><b className="text-ink">{uc.capital.direction}</b>, {uc.capital.why}</> : "not given (an earlier assessment; the next one gives it)"}
          </p>
          <div className="mt-1.5 space-y-2">
            {[...(uc.levers ?? [])].sort((x, y) => (x.order ?? order(x.lever_id)) - (y.order ?? order(y.lever_id))).map((lv) => (
              <LeverChain key={lv.lever_id} lever={lv} name={lists.levers[lv.lever_id]?.name} order={lists.levers[lv.lever_id]?.order}
                mechanism={lists.mechanisms[lv.mechanism_id]} pages={pages} />
            ))}
            {(uc.levers?.length ?? 0) < 2 && (
              <p className="text-[12px] text-muted">One lever only: this is from an earlier assessment. The next one gives both of the fabric&apos;s levers.</p>
            )}
          </div>
        </div>
      ))}
      {none && (
        <div className="rounded-lg border border-dashed border-amber-300 bg-amber-50/50 p-3 text-[13px]">
          <p><b>No use case in the pages yet.</b> {none.reason}</p>
          {none.evidence_needed && <p className="mt-0.5 text-neutral-700">What would show one: {none.evidence_needed}</p>}
          {findAgain}
        </div>
      )}
      {suggested.length > 0 && (
        <div className="text-[13px]">
          <div className="font-mono text-[11px] uppercase tracking-wider text-neutral-500">Suggested by the model, not from the pages</div>
          <ul className="mt-1 space-y-1.5">
            {suggested.map((s) => {
              const d = decisions[s.key];
              return (
                <li key={s.key} className="flex flex-wrap items-baseline gap-2">
                  <span className="font-medium">{s.title}</span><span className="text-muted">{s.why}</span>
                  {d ? (
                    <span className="text-[12.5px]">{d.value === "accept" ? "Accepted: it reaches the Point of View" : "Rejected"}
                      {!readOnly && <> · <ActButton label="Undo" run={() => undo(d._id)} onDone={onChanged} /></>}</span>
                  ) : !readOnly && (
                    <span className="flex gap-1.5">
                      {(["accept", "reject"] as const).map((v) => (
                        <ActButton key={v} label={v === "accept" ? "Accept" : "Reject"} onDone={onChanged}
                          className="rounded-full border border-line bg-white px-2.5 py-0.5 text-[12.5px] hover:bg-ground"
                          run={() => decide({ kind: "use_case", tech_id: techId, fabric_id: fabricId, key: s.key, value: v })} />
                      ))}
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
