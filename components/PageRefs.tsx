import { useContext } from "react";
import { SourceNumbers } from "@/lib/citations";
import type { CitedPage } from "@/lib/classification";

/** "[1] arXiv [2] IEEE": the cited pages an answer rests on, numbered, each
 *  opening in a new tab. A page that isn't among `pages` is left out. On a
 *  Point of View, each page has its number in the Point of View's sources. */
export default function PageRefs({ ids, pages }: { ids?: string[]; pages?: Record<string, CitedPage> }) {
  const numbers = useContext(SourceNumbers);
  return (ids ?? []).filter((id) => pages?.[id]).map((id, i) => {
    const n = numbers ? numbers.get(id) ?? numbers.get(pages![id].url) : i + 1;
    return (
      <a key={id} href={pages![id].url} target="_blank" rel="noreferrer" title={pages![id].title ?? pages![id].url}
        className="text-[11.5px] text-link hover:underline">
        {n != null && `[${n}] `}{pages![id].source}
      </a>
    );
  });
}
