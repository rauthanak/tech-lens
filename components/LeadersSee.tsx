"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { Edition } from "@/components/frontier/items";
import { openTodo } from "@/components/GateList";
import { editionName } from "@/components/PublishEdition";
import { fetchJson } from "@/lib/api";
import { formatAt, plural } from "@/lib/format";

/** The Briefing's To do, its Publish column open. */
export function PublishLink({ children }: { children: React.ReactNode }) {
  return <Link href="/admin" onClick={() => openTodo("publish")} className="text-link hover:underline">{children}</Link>;
}

type Seen = { edition: Edition | null; composed_at: string | null; composed_tz: string | null;
  views?: { opened: number; printed: number; last_opened: string | null } | null };

/** On a Point of View's page: which version leaders see, the one on screen or
 *  an earlier one in the latest edition, and where to publish this one. */
export default function LeadersSee({ tech, composedAt }: { tech: string; composedAt: string }) {
  const [seen, setSeen] = useState<Seen | null>(null);
  useEffect(() => {
    fetchJson<Seen>(`/api/editions/pov/${encodeURIComponent(tech)}`)
      .then(setSeen).catch(() => setSeen(null));
  }, [tech, composedAt]);
  if (!seen) return null;
  const e = seen.edition;
  const current = seen.composed_at === composedAt;
  return (
    <p className={`mt-2 rounded px-3 py-1.5 text-[13px] print:hidden ${current ? "bg-ground text-neutral-700"
      : "border border-amber-200 bg-amber-50 text-amber-900"}`}>
      {!e ? <>Nothing is published yet: leaders see no Point of View until the first edition.{" "}
        <PublishLink>Publish on the Briefing →</PublishLink></>
        : current ? <>Leaders see this version, in {editionName(e)}.</>
        : <>Leaders see {seen.composed_at ? `the version written ${formatAt(seen.composed_at, seen.composed_tz)}` : "no Point of View of it"},
          in {editionName(e)}: this one was written after it.{" "}
          <PublishLink>Publish on the Briefing to send it →</PublishLink></>}
      {e && (
        <span className="block text-neutral-600">
          {seen.views?.opened
            ? `Leaders opened it ${plural(seen.views.opened, "time")}, last ${formatAt(seen.views.last_opened!, null)}`
              + (seen.views.printed ? `; printed or saved as PDF ${plural(seen.views.printed, "time")}` : "") + "."
            : "Leaders haven't opened it yet."}{" "}
          Counted on the leaders&apos; address; who isn&apos;t known until there&apos;s sign-in.
        </span>
      )}
    </p>
  );
}
