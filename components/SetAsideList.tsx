"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import BackendError from "@/components/BackendError";
import { fetchJson } from "@/lib/api";
import { formatDay, plural } from "@/lib/format";
import type { SetAsidePage } from "@/lib/signals";
import Pager from "@/components/Pager";
import { useStoredStart } from "@/lib/paging";

const DAYS = 30;

/** Setup → Signal list: pages a Can ignore rule set aside in the last 30
 *  days, with the rule that did it. Kept, but not used for technologies or
 *  assessments. */
export default function SetAsideList() {
  const [pages, setPages] = useState<SetAsidePage[] | null>(null);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState<unknown>(null);

  const fetchPages = (skip: number) => {
    const since = new Date(Date.now() - DAYS * 86_400_000).toISOString().slice(0, 10);
    return fetchJson<{ pages: SetAsidePage[]; total: number }>(`/api/signals/set-aside?since=${since}&limit=20&skip=${skip}`);
  };

  const [start, setStart] = useStoredStart("set-aside"); // 20 at a time, kept when you come back
  useEffect(() => {
    let current = true;
    fetchPages(start)
      .then((d) => { if (current) { setPages(d.pages); setTotal(d.total); } })
      .catch((e) => { if (current) setError(e); });
    return () => { current = false; };
  }, [start]);

  return (
    <section id="set-aside" className="mt-10 scroll-mt-20">
      <h2 className="text-lg font-semibold">Set aside recently{pages ? ` · ${plural(total, "page")}` : ""}</h2>
      <p className="text-xs text-neutral-500">
        Pages a Can ignore rule set aside in the last {DAYS} days: kept, but not used for technologies or assessments.
      </p>
      {error != null && <BackendError error={error} />}
      {pages && pages.length === 0 && <p className="mt-3 text-sm text-muted">No pages were set aside in the last {DAYS} days.</p>}
      <div className="mt-3 space-y-2.5">
        {pages?.map((page) => (
          <div key={page.doc_id} className="rounded-card border border-line bg-white px-5 py-3.5">
            <p className="text-xs text-muted">Set aside by <span className="font-medium text-ink">“{page.rule_name}”</span></p>
            <a href={page.url} target="_blank" rel="noreferrer" className="mt-1 block font-medium leading-snug hover:underline">
              {page.title || page.url} ↗
            </a>
            {page.summary_text && <p className="mt-1 line-clamp-2 text-sm leading-relaxed text-neutral-600">{page.summary_text}</p>}
            <p className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted">
              <span>collected {formatDay(page.scraped_at)}</span>
              <Link href={`/admin/runs/${page.run_id}`} className="text-link hover:underline">Open collection →</Link>
            </p>
          </div>
        ))}
      </div>
      {pages && <Pager className="mt-3" start={start} total={total} size={20} go={setStart} what="pages" />}
    </section>
  );
}
