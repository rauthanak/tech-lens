"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { formatDate, formatDay } from "@/lib/format";
import { useHere, withFrom } from "@/lib/here";
import { type FoundHit, headlineOf, hostOf } from "@/lib/signals";
import { useTechLabel } from "@/lib/tech-labels";

// The row's ::after stretches its button over the whole item, so clicking
// anywhere opens the panel; technology links sit above it (`relative`).
const STRETCH = "cursor-pointer text-left after:absolute after:inset-0";
const SHOWN_TECHS = 3; // the panel lists them all

/** When the finding's page was published ("Published Oct 1"; the year when
 *  it isn't the collection's, and always for an older article), or when it
 *  was collected if the page gives no date. */
export function dateLine(item: FoundHit): string {
  if (!item.published_date) return `Collected ${formatDay(item.scraped_at)}`;
  const year = item.older || item.published_date.slice(0, 4) !== item.scraped_at.slice(0, 4);
  return `Published ${formatDate(item.published_date, year)}`;
}

/** One finding, shown the same way everywhere: the Briefing, a technology's
 *  page and a collection's source pages. Clicking it opens SignalPanel by
 *  adding ?signal=<doc_id>:<n> to the address. Uses useSearchParams, so
 *  callers wrap it in <Suspense>. */
export default function SignalItem({ item, withTechnologies = true }: { item: FoundHit; withTechnologies?: boolean }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const here = useHere();
  const label = useTechLabel();
  const key = `${item.doc_id}:${item.n}`;
  const selected = params.get("signal") === key;

  const open = () => {
    const query = new URLSearchParams(params.toString());
    query.set("signal", key);
    router.replace(`${pathname}?${query}`, { scroll: false });
  };

  return (
    <article className={`relative border-l-[3px] px-5 py-3 ${selected ? "border-azure bg-navy/[0.04]" : "border-transparent hover:bg-ground/70"}`}>
      <button type="button" data-signal={key} onClick={open} aria-current={selected || undefined}
        className={`${STRETCH} block w-full`}>
        <span className="line-clamp-2 text-[14.5px] font-semibold leading-snug text-ink">
          {item.signal_id === "other" && (
            <span className="mr-1.5 inline-block rounded-full border border-dashed border-navy px-2 align-[1px] text-[11px] font-medium text-navy">
              {item.label || "Other"}
            </span>
          )}
          {headlineOf(item)}
        </span>
      </button>
      {item.implication && (
        <p className="mt-0.5 line-clamp-1 text-[13.5px] text-muted">Why it matters: {item.implication}</p>
      )}
      <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
        <span>{hostOf(item.url)}</span>
        <span>{dateLine(item)}</span>
        {!withTechnologies ? null : item.technologies.length === 0 ? <span>No technology linked yet</span> : (
          <span className="inline-flex flex-wrap items-center gap-1.5">
            {item.technologies.slice(0, SHOWN_TECHS).map((name, i) => {
              const id = item.technology_ids[i];
              const chip = "rounded-full bg-navy/5 px-2 py-0.5 text-[11px] text-ink";
              return id ? (
                <Link key={name} href={withFrom(`/admin/technologies/${id}`, here)} className={`relative ${chip} hover:bg-navy/10`}>
                  {label(name)}
                </Link>
              ) : <span key={name} className={chip}>{label(name)}</span>;
            })}
            {item.technologies.length > SHOWN_TECHS && (
              <span className="text-[11px]">+{item.technologies.length - SHOWN_TECHS}</span>
            )}
          </span>
        )}
      </div>
    </article>
  );
}
