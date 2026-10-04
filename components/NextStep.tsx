"use client";

import Link from "next/link";
import { useState } from "react";
import { type Finished, finished } from "@/lib/next-step";
import { type Pipeline, usePipeline } from "@/lib/pipeline";
import { itemHref, itemSentence } from "@/lib/waiting";

/** One banner under the top bar when a job finishes while the portal is
 *  open: what it did, a link to its results, and the next step as a link to
 *  where it's handled (never a button that spends model calls in place).
 *  "Later" dismisses it. */
export default function NextStep() {
  const p = usePipeline();
  const [seen, setSeen] = useState<Pipeline | null>(null);
  const [latest, setLatest] = useState<Finished | null>(null);

  // compare each new poll with the one before (state adjusted during render)
  if (p !== seen) {
    const done = seen && p ? finished(seen, p) : null;
    if (done) setLatest(done);
    setSeen(p);
  }
  if (!latest || !p) return null;

  // the next step as it stands now: gone once it has been done
  const next = latest.next && p.for_analyst.find((item) => item.kind === latest.next!.kind);
  return (
    <div role="status" className="mx-auto mt-4 max-w-[1760px] px-6 text-sm lg:px-10 print:hidden">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-card border border-azure/30 bg-azure/5 px-5 py-3">
        <span className="font-medium text-ink">{latest.message}</span>
        <Link href={latest.results.href} className="text-link hover:underline">{latest.results.label} →</Link>
        {next && (
          <Link href={itemHref(next)} className="text-muted hover:text-ink hover:underline">
            Next: {itemSentence(next)} →
          </Link>
        )}
        <button type="button" onClick={() => setLatest(null)}
          className="ml-auto rounded-full border border-line bg-white px-3 py-1 text-sm hover:bg-ground">
          Later
        </button>
      </div>
    </div>
  );
}
