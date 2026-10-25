"use client";

import ActButton from "@/components/ActButton";
import AnswerCard, { type Provenance } from "@/components/AnswerCard";
import MoveDialog from "@/components/MoveDialog";
import NascentFlag from "@/components/NascentFlag";
import { type CitedPage, type Classification, type Status, VERDICT_STYLE, VERDICT_WORDS } from "@/lib/classification";
import { undo } from "@/lib/decisions";
import { formatDay, plural } from "@/lib/format";

const provenance = (a: object) => {
  const p = a as Provenance;
  return { imported: p.imported, radar: p.radar };
};

/** A technology's four answers — commercial availability, readiness (TRL),
 *  domain and evidence — each with where it came from, "Why?" and "Change"
 *  (evidence can't be changed: it's the model's verdict on its pages); and
 *  above them, a possible-nascent flag for a person to confirm. */
export default function TechAnswers({ techId, c, cited, status, onChanged, narrow }: {
  techId: string;
  c: Classification;
  cited: Record<string, CitedPage>;
  status?: Status;
  onChanged: () => void;
  narrow?: boolean; // in a side column at 1280 px and wider: one card under another
}) {
  const undoable = (decisionId: string | null | undefined) => decisionId ? (
    <ActButton label="Undo" title="Go back to what the radar judged" run={() => undo(decisionId)} onDone={onChanged} />
  ) : null;
  return (
    <section className="mt-6">
      {c.nascent.flag && (
        <div className="mb-3">
          <NascentFlag techId={techId} nascent={c.nascent} page={cited[c.nascent.flag.page]}
            tracked={status === "placed" || status === "held"} thin={status === "thin"} onChanged={onChanged} />
        </div>
      )}
      {/* each card as tall as what it says: no blank space at the bottom of the shorter ones */}
      <div className={`grid grid-cols-1 items-start gap-3 sm:grid-cols-2 ${narrow ? "min-[1280px]:grid-cols-1" : "xl:grid-cols-4"}`}>
        <AnswerCard label="Commercial availability" value={c.availability.name} source={c.availability.source}
          at={c.availability.at} tz={c.availability.tz} reason={c.availability.reason} pages={c.availability.pages} cited={cited}
          {...provenance(c.availability)}
          sub={c.availability.emerging ? "Counts as emerging" : undefined}
          change={<>
            <MoveDialog techId={techId} field="availability" current={c.availability.id} onDone={onChanged} />
            {c.availability.source === "person" && undoable(c.availability.decision_id)}
          </>} />
        <AnswerCard label="Readiness (TRL)" value={c.trl.level ? `TRL ${c.trl.level}` : "Not known yet"}
          sub={c.trl.name ?? c.trl.missing ?? undefined} source={c.trl.source} at={c.trl.at} tz={c.trl.tz}
          reason={c.trl.reason} pages={c.trl.pages} cited={cited} {...provenance(c.trl)}
          change={<>
            <MoveDialog techId={techId} field="trl" current={c.trl.level} onDone={onChanged} />
            {c.trl.source === "person" && undoable(c.trl.decision_id)}
          </>} />
        <AnswerCard label="Domain" value={c.domain.name}
          sub={c.domain.subdomain ? <>{c.domain.subdomain}{c.domain.subdomain_new && <span className="ml-1 rounded bg-azure/15 px-1 text-[10.5px] text-navy">new</span>}</> : undefined}
          source={c.domain.source} at={c.domain.at} tz={c.domain.tz} reason={c.domain.reason} pages={c.domain.pages} cited={cited}
          {...provenance(c.domain)}
          change={<>
            <MoveDialog techId={techId} field="domain" current={c.domain.id} onDone={onChanged} />
            <MoveDialog techId={techId} field="subdomain" current={c.domain.subdomain_id} domainId={c.domain.id}
              onDone={onChanged} label="Change sub-domain" />
            {c.domain.source === "person" && undoable(c.domain.decision_id)}
          </>} />
        <AnswerCard label="Evidence"
          value={c.evidence ? <span className={`rounded-full px-2 py-0.5 text-[14px] ${VERDICT_STYLE[c.evidence.verdict]}`}>{VERDICT_WORDS[c.evidence.verdict]}</span> : "Not judged yet"}
          sub={c.evidence ? `${plural(c.evidence.of, "page")} from ${plural(c.evidence.sources, "source")}` : "Classify judges it from the pages"}
          source={c.evidence ? "pages" : "none"} at={c.evidence?.at} reason={c.evidence?.reason} pages={c.evidence?.pages} cited={cited} />
      </div>
      {c.classified_at && (
        <p className="mt-1.5 text-xs text-muted">Classified {formatDay(c.classified_at)} from its pages; an assessment
          judges availability, TRL and domain again from all of its evidence.</p>
      )}
    </section>
  );
}
