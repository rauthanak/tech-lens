"use client";

import { useState } from "react";
import type { CitedPage, Source } from "@/lib/classification";
import { SOURCE_WORDS } from "@/lib/classification";
import { formatAt, formatDay } from "@/lib/format";

/** What the radar itself judged (its assessment, else its pages) under a
 *  value a person or the catalog set (services/classify_effective). */
export type Radar = { name: string | null; same: boolean; source: Source; reason: string | null; pages: string[] };
/** Under a person's value: the file, when an import set it; and the radar's own view. */
export type Provenance = { imported?: string | null; radar?: Radar | null };

/** One model answer, in the radar's one look: the value, where it came from
 *  (its pages, its assessment, a person, the catalog), "Why?" (its reason and
 *  the numbered pages it rests on) and "Change". Under a person's or Tata's
 *  value it also says what the radar judged, and "Why?" opens that. */
export default function AnswerCard({ label, value, sub, source, at, tz, reason, pages, cited, change, tone, imported, radar }: {
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  source: Source;
  at?: string | null;
  tz?: string | null;
  reason?: string | null;
  pages?: string[];
  cited?: Record<string, CitedPage>;
  change?: React.ReactNode;
  tone?: string;
} & Provenance) {
  const [open, setOpen] = useState(false);
  const set = source === "person";
  const from = imported ? `from the catalog (${imported}, ${formatDay(at)})`
    : set ? `set by a person${at ? ` on ${formatAt(at, tz)}` : ""}`
    : `${SOURCE_WORDS[source]}${at && source !== "none" ? `, ${formatDay(at)}` : ""}`;
  const by = radar?.source === "assessment" ? "its assessment" : "its pages";
  const s = radar?.source === "assessment" ? "s" : "";
  const judged = !set ? null : !radar ? "the radar hasn't judged it yet" : radar.name === null ? `${by} can't tell`
    : radar.same ? `${by} agree${s}` : `${by} suggest${s} ${radar.name}`;
  const own = imported ? null : reason; // an import's reason only repeats the file
  const refs = ((set ? radar?.pages : pages) ?? []).map((id) => cited?.[id]).filter((p): p is CitedPage => !!p);
  return (
    <div className={`rounded-card border border-line bg-white px-4 py-3 ${tone ?? ""}`}>
      <div className="font-mono text-[11px] uppercase tracking-wider text-neutral-500">{label}</div>
      <div className="mt-1 text-[17px] font-semibold leading-snug">{value}</div>
      {sub && <div className="text-[12.5px] text-muted">{sub}</div>}
      <div className="mt-1.5 flex flex-wrap items-center gap-x-2 text-[12px] text-muted">
        <span>{from}{judged && <> · {judged}</>}</span>
        {(own || radar?.reason || refs.length > 0) && (
          <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} className="text-link hover:underline">
            Why?
          </button>
        )}
        {change}
      </div>
      {open && (
        <div className="mt-2 border-t border-neutral-100 pt-2 text-[12.5px]">
          {own && <p className="text-neutral-700">{own}</p>}
          {set && radar?.reason && (
            <p className="text-neutral-700"><span className="text-muted">What {by} show{s}: </span>{radar.reason}</p>
          )}
          {refs.length > 0 && (
            <ol className="mt-1 space-y-0.5">
              {refs.map((p, i) => (
                <li key={p.url} className="flex gap-1.5">
                  <span className="text-muted">[{i + 1}]</span>
                  <a href={p.url} target="_blank" rel="noreferrer" className="min-w-0 text-link hover:underline">
                    {p.source} · {p.date} · {p.title || p.url}
                  </a>
                </li>
              ))}
            </ol>
          )}
        </div>
      )}
    </div>
  );
}
