"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import BackendError from "@/components/BackendError";
import { fetchJson } from "@/lib/api";
import { formatDay, plural } from "@/lib/format";
import { chipStyle, hostOf, makeSignalHref, type OtherGroup } from "@/lib/signals";
import Pager from "@/components/Pager";
import { useStoredStart } from "@/lib/paging";

const lightBtn = "rounded-full border border-line bg-white px-3 py-1.5 text-sm hover:bg-ground";
const DAYS = 30;

/** Setup → Signal list: Other findings from the last 30 days, grouped by the
 *  label the model gave them. One that keeps coming back can join the list. */
export default function SignalSuggestions() {
  const [groups, setGroups] = useState<OtherGroup[] | null>(null);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState<unknown>(null);

  const fetchGroups = (skip: number) => {
    const since = new Date(Date.now() - DAYS * 86_400_000).toISOString().slice(0, 10);
    return fetchJson<{ groups: OtherGroup[]; total: number }>(`/api/signals/other?since=${since}&limit=20&skip=${skip}`);
  };

  const [start, setStart] = useStoredStart("suggestions"); // 20 at a time, kept when you come back
  useEffect(() => {
    let current = true;
    fetchGroups(start)
      .then((d) => { if (current) { setGroups(d.groups); setTotal(d.total); } })
      .catch((e) => { if (current) setError(e); });
    return () => { current = false; };
  }, [start]);

  return (
    <section id="suggestions" className="mt-10 scroll-mt-20">
      <h2 className="text-lg font-semibold">Suggestions from recent findings</h2>
      <p className="text-xs text-neutral-500">
        Other findings from the last {DAYS} days, grouped by the label the model gave them. If one keeps
        coming back, add it to the signal list.
      </p>
      {error != null && <BackendError error={error} />}
      {groups && groups.length === 0 && <p className="mt-3 text-sm text-muted">No Other findings in the last {DAYS} days.</p>}
      <div className="mt-3 space-y-2.5">
        {groups?.map((g) => (
          <div key={g.label} className="rounded-card border border-line bg-white px-5 py-3.5">
            <div className="flex flex-wrap items-center gap-3">
              <span className={chipStyle({ signal_id: "other" })}>{g.label}</span>
              <span className="text-xs text-muted">{plural(g.count, "time")}</span>
              <Link href={makeSignalHref(g.label, g.examples[0]?.what ?? null)} className={`${lightBtn} ml-auto`}>
                Add to signal list
              </Link>
            </div>
            <ul className="mt-2 space-y-1 text-sm text-neutral-700">
              {g.examples.map((e, i) => (
                <li key={i}>
                  {e.what}{" "}
                  <a href={e.url} target="_blank" rel="noreferrer" className="whitespace-nowrap text-xs text-link hover:underline">
                    {hostOf(e.url)} · {formatDay(e.scraped_at)} ↗
                  </a>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      {groups && <Pager className="mt-3" start={start} total={total} size={20} go={setStart} what="suggestions" />}
    </section>
  );
}
