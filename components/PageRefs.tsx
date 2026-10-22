"use client";

import { useContext, useState } from "react";
import { SourceNumbers } from "@/lib/citations";
import type { CitedPage } from "@/lib/classification";
import { formatDate } from "@/lib/format";

/** "[1] arXiv [2] IEEE": the cited pages an answer rests on, numbered, each
 *  opening in a new tab. A page that isn't among `pages` is left out. On a
 *  Point of View, each page has its number in the Point of View's sources.
 *  Two pages from one source carry their dates ("CERT-In, Oct 3"), so they
 *  don't read as the same page twice. */
export default function PageRefs({ ids, pages }: { ids?: string[]; pages?: Record<string, CitedPage> }) {
  const numbers = useContext(SourceNumbers);
  const shown = (ids ?? []).filter((id) => pages?.[id]);
  const twice = (id: string) => shown.filter((x) => pages![x].source === pages![id].source).length > 1;
  return shown.map((id, i) => {
    const n = numbers ? numbers.get(id) ?? numbers.get(pages![id].url) : i + 1;
    return (
      <a key={id} href={pages![id].url} target="_blank" rel="noreferrer" title={pages![id].title ?? pages![id].url}
        className="text-[11.5px] text-link hover:underline">
        {n != null && `[${n}] `}{pages![id].source}{twice(id) && pages![id].date ? `, ${formatDate(pages![id].date!)}` : ""}
      </a>
    );
  });
}

/** "4 sources": the cited pages folded into a count, opening to PageRefs on
 *  click; one page is shown as it is. For long lists that crowd a line. */
export function FoldedRefs({ ids, pages }: { ids?: string[]; pages?: Record<string, CitedPage> }) {
  const [open, setOpen] = useState(false);
  const n = (ids ?? []).filter((id) => pages?.[id]).length;
  if (n < 2) return <PageRefs ids={ids} pages={pages} />;
  return (
    <span className="inline-flex flex-wrap items-baseline gap-x-2">
      <button type="button" aria-expanded={open} onClick={() => setOpen(!open)} className="text-[11.5px] text-link hover:underline">
        {open ? "Hide sources" : `${n} sources`}
      </button>
      {open && <PageRefs ids={ids} pages={pages} />}
    </span>
  );
}
