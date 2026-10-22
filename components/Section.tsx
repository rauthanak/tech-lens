"use client";

import { useState } from "react";

/** How a part stands, said beside its title in Waiting on you's words: "todo"
 *  (amber: something to settle), "open" (grey: not recorded yet), "done". */
export type PartState = { tone: "todo" | "open" | "done"; label: string };
const TONE = { todo: "bg-amber-50 text-amber-900 ring-amber-200", open: "bg-ground text-muted ring-line",
  done: "bg-emerald-50 text-emerald-900 ring-emerald-200" };

/** One part of a technology's fabric tab: a plain title with how it stands
 *  (`state`) and a short summary beside it (so it still says something when
 *  folded), one line on what it is, and "More" for what you do here and where
 *  it shows up; then the part. Click the title to fold it. It starts open
 *  unless `closed` (a part that's done); a later change of `closed` doesn't
 *  fold it under the reader. `id` is the anchor Waiting on you links to. */
export default function Section({ id, title, state, summary, what, todo, shows, closed, children }: {
  id?: string;
  title: React.ReactNode;
  state?: PartState;
  summary?: React.ReactNode;
  what: React.ReactNode;
  todo?: React.ReactNode;
  shows?: React.ReactNode;
  closed?: boolean;
  children: React.ReactNode;
}) {
  const [more, setMore] = useState(false);
  const [startOpen] = useState(!closed);
  return (
    <details id={id} open={startOpen} className="group mt-3 scroll-mt-20 rounded-card border border-line bg-white px-5 py-3">
      <summary className="flex cursor-pointer list-none flex-wrap items-baseline gap-x-2.5 gap-y-0.5 [&::-webkit-details-marker]:hidden">
        <span aria-hidden className="inline-block w-3 text-[11px] text-muted transition-transform group-open:rotate-90">▶</span>
        <h3 className="font-semibold">{title}</h3>
        {state && <span className={`rounded-full px-2 py-0.5 text-[12px] ring-1 ${TONE[state.tone]}`}>{state.label}</span>}
        {summary && <span className="text-[13px] text-muted">{summary}</span>}
      </summary>
      <p className="mb-3 mt-1 pl-5 text-[12.5px] text-neutral-700">
        {what}
        {(todo || shows) && (
          <>
            {" "}
            <button type="button" aria-expanded={more} onClick={() => setMore(!more)} className="text-link hover:underline">
              {more ? "Less" : "More"}
            </button>
          </>
        )}
      </p>
      {more && (
        <dl className="-mt-2 mb-3 grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-0.5 pl-5 text-[12.5px] text-neutral-700">
          {todo && <><dt className="text-muted">What you do</dt><dd>{todo}</dd></>}
          {shows && <><dt className="text-muted">Where it shows</dt><dd>{shows}</dd></>}
        </dl>
      )}
      {children}
    </details>
  );
}
