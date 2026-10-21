"use client";

import ActButton from "@/components/ActButton";
import DecisionNote from "@/components/DecisionNote";
import type { CitedPage, Classification } from "@/lib/classification";
import { decide } from "@/lib/decisions";

/** The commercial availability a Yes on nascent would replace (a person's or
 *  Tata's value other than Research or Pilot), from the API. */
export type YesReplaces = { name: string; imported: string | null } | null | undefined;

/** "Yes, nascent" and "No" for a flagged technology. Yes moves it to Research
 *  or Pilot, so it says first what that replaces. */
export function NascentAnswer({ techId, replaces, onDone, compact = false }: {
  techId: string;
  replaces: YesReplaces;
  onDone: (answer: "yes" | "no") => void;
  compact?: boolean;
}) {
  const pill = compact ? "text-link hover:underline" : "rounded-full px-3 py-0.5 text-[12.5px]";
  return (
    <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-1">
      <ActButton label="Yes, nascent" className={compact ? pill : `${pill} bg-navy text-white hover:bg-navy-strong`}
        run={() => decide({ kind: "nascent", tech_id: techId, value: "yes" })} onDone={() => onDone("yes")} />
      <ActButton label="No" className={compact ? pill : `${pill} border border-line bg-white hover:bg-ground`}
        run={() => decide({ kind: "nascent", tech_id: techId, value: "no" })} onDone={() => onDone("no")} />
      {replaces && (
        <span className="text-xs text-amber-900">
          Yes replaces {replaces.imported ? "Tata's" : "a person's"} &ldquo;{replaces.name}&rdquo; with Research or Pilot.
        </span>
      )}
    </span>
  );
}

/** A possible-nascent flag, to settle in place: why it was flagged, the
 *  quote and the page it's from, then Yes / No (or the choice made, with
 *  Undo). A tracked technology says so: Yes then only moves its
 *  commercial availability; a thin one says Yes lets it be assessed. */
export default function NascentFlag({ techId, nascent, page, tracked, thin = false, replaces, onChanged }: {
  techId: string;
  nascent: Classification["nascent"] & { yes_replaces?: YesReplaces };
  page?: CitedPage;
  tracked: boolean;
  thin?: boolean;
  replaces?: YesReplaces;
  onChanged: (done: string) => void; // what was done, in words
}) {
  const flag = nascent.flag;
  if (!flag) return null;
  return (
    <div className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-[13px]">
      <p><span className="font-semibold text-amber-900">Possibly nascent:</span> {flag.reason}</p>
      {tracked && <p className="text-xs text-navy">Already tracked, so Yes only moves its commercial availability.</p>}
      {thin && <p className="text-xs text-navy">Yes lets it be assessed despite thin evidence.</p>}
      <blockquote className="mt-1 border-l-2 border-amber-300 pl-2 italic text-neutral-700">
        &ldquo;{flag.quote}&rdquo;
        {page ? (
          <a href={page.url} target="_blank" rel="noreferrer" className="ml-1.5 not-italic text-link hover:underline">
            {page.source} · {page.date}{page.title ? ` · ${page.title}` : ""}
          </a>
        ) : <span className="ml-1.5 not-italic text-muted">(its page is no longer stored)</span>}
      </blockquote>
      <div className="mt-1.5 flex flex-wrap items-center gap-2">
        {nascent.decision && nascent.decision_id ? (
          <DecisionNote what={nascent.decision === "yes" ? "Confirmed as possibly nascent" : "Dismissed as nascent"}
            decision={{ _id: nascent.decision_id, at: nascent.at ?? "", tz: nascent.tz, reason: null }} onUndone={() => onChanged("back to undecided")} />
        ) : (
          <NascentAnswer techId={techId} replaces={replaces ?? nascent.yes_replaces}
            onDone={(a) => onChanged(a === "yes" ? "confirmed as possibly nascent" : "dismissed as nascent, until a new page flags it")} />
        )}
      </div>
    </div>
  );
}
