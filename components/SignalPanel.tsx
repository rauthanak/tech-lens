"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import BackendError from "@/components/BackendError";
import { fetchJson } from "@/lib/api";
import { formatDate, formatDay } from "@/lib/format";
import { useHere, withFrom } from "@/lib/here";
import {
  chipStyle, type FoundHit, type FoundResponse, headlineOf, hitName, hostOf, makeSignalHref,
} from "@/lib/signals";
import { useTechLabel } from "@/lib/tech-labels";

const mainBtn = "rounded-full bg-navy px-3.5 py-1.5 text-sm text-white hover:bg-navy-strong";
const secondaryBtn = "rounded-full border border-line bg-white px-3.5 py-1.5 text-sm text-ink hover:bg-ground";

/** The side panel for one finding, mounted once per page. It opens when the
 *  address has ?signal=<doc_id>:<n> (SignalItem adds it), so it can be
 *  shared, and closes by removing it. Non-modal: the page stays usable.
 *  `docked`: it sits in a column beside the list (the Briefing on wide
 *  screens, which adds the column once a finding is chosen) and leaves focus
 *  on the list. Uses useSearchParams, so callers wrap it in <Suspense>. */
export default function SignalPanel({ docked = false }: { docked?: boolean }) {
  const signal = useSearchParams().get("signal");
  return signal ? <Panel key={signal} signal={signal} docked={docked} /> : null;
}

function Panel({ signal, docked }: { signal: string; docked: boolean }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const here = useHere();
  const label = useTechLabel();
  const titleId = useId();
  const box = useRef<HTMLDivElement>(null);
  const [item, setItem] = useState<FoundHit | null>(null);
  const [missing, setMissing] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [sourceName, setSourceName] = useState<string | null>(null);
  const [docId, n] = signal.split(":");

  useEffect(() => {
    fetchJson<FoundResponse>(`/api/signals/found?doc_id=${encodeURIComponent(docId)}&limit=100`)
      .then((d) => {
        const hit = d.hits.find((h) => String(h.n) === n);
        if (!hit) {
          setMissing(true);
          return;
        }
        setItem(hit);
        fetchJson<{ name: string }>(`/api/sources/${encodeURIComponent(hit.source_id)}`)
          .then((s) => setSourceName(s.name)).catch(() => {});
      })
      .catch(setError);
  }, [docId, n]);

  /** Remove ?signal= and give focus back to the item that opened the panel. */
  const close = useCallback(() => {
    const query = new URLSearchParams(params.toString());
    query.delete("signal");
    const rest = query.toString();
    router.replace(rest ? `${pathname}?${rest}` : pathname, { scroll: false });
    document.querySelector<HTMLElement>(`[data-signal="${CSS.escape(signal)}"]`)?.focus();
  }, [params, pathname, router, signal]);

  useEffect(() => { if (!docked) box.current?.focus(); }, [docked]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") close(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [close]);

  const techHref = (id: string) => withFrom(`/admin/technologies/${id}`, here);
  // one technology: name it, unless this is its page already
  const only = item && item.technologies.length === 1 && item.technology_ids[0]
    && pathname !== `/admin/technologies/${item.technology_ids[0]}`
    ? { name: item.technologies[0], id: item.technology_ids[0] } : null;

  return (
    <div ref={box} role={docked ? "region" : "dialog"} tabIndex={-1}
      {...(item ? { "aria-labelledby": titleId } : { "aria-label": "Finding" })}
      className={`overflow-y-auto bg-white outline-none print:hidden ${docked
        ? "max-h-[calc(100vh-2rem)] rounded-card border border-line"
        : "fixed inset-y-0 right-0 z-40 w-full border-l border-line shadow-lg sm:w-[460px]"}`}>
      <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-4">
        <span className="text-sm">{item ? <span className={chipStyle(item)}>{hitName(item)}</span> : "Finding"}</span>
        <button type="button" onClick={close} aria-label="Close"
          className="-mr-2 rounded-full px-2 text-xl leading-none text-muted hover:bg-ground hover:text-ink">
          ×
        </button>
      </div>

      <div className="space-y-3 px-5 py-4 text-sm leading-relaxed">
        {error != null && <BackendError error={error} />}
        {missing && (
          <p className="text-muted">
            This finding is no longer on that page. The page may have been checked again since this
            link was made.
          </p>
        )}
        {!item && !missing && error == null && <p className="text-muted">Loading…</p>}
        {item && (
          <>
            <h2 id={titleId} className="text-[16px] font-semibold leading-snug text-ink">{headlineOf(item)}</h2>
            {item.headline && item.what && <p className="text-neutral-700">{item.what}</p>}
            <p className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
              <span>{item.published_date
                ? <>Published <b className="font-semibold text-ink">{formatDate(item.published_date, true)}</b></>
                : "Publication date not given"}</span>
              <span>Collected <b className="font-semibold text-ink">{formatDay(item.scraped_at)}</b></span>
              {item.when && <span>Event <b className="font-semibold text-ink">{item.when}</b></span>}
            </p>
            {item.older && item.published_date && (
              <p className="rounded-md bg-amber-50 px-3 py-2 text-[13px] text-amber-900">
                Older article: published {formatDate(item.published_date, true)}, found in the collection of{" "}
                {formatDay(item.scraped_at)}.
              </p>
            )}
            {item.who && <p className="text-xs text-muted">Who: {item.who}</p>}
            {item.implication && <p className="text-neutral-700">Why it matters: {item.implication}</p>}
            <blockquote className="border-l-2 border-navy/30 pl-3 italic text-neutral-600">“{item.quote}”</blockquote>
            <p className="text-muted">
              Source:{" "}
              <a href={item.url} target="_blank" rel="noreferrer" className="text-link hover:underline">
                {hostOf(item.url)} ↗
              </a>
              {sourceName && ` · via ${sourceName}`}
            </p>
            <p className="text-muted">
              {item.technologies.length === 0 ? "No technology linked yet." : (
                <>
                  {item.technologies.length === 1 ? "Technology" : "Technologies"}:{" "}
                  {item.technologies.map((name, i) => {
                    const id = item.technology_ids[i];
                    return (
                      <span key={name}>
                        {i > 0 && ", "}
                        {id ? <Link href={techHref(id)} className="text-link hover:underline">{label(name)}</Link> : label(name)}
                      </span>
                    );
                  })}
                </>
              )}
            </p>
            <div className="flex flex-wrap gap-2 pt-2">
              {only && <Link href={techHref(only.id)} className={mainBtn}>Open {label(only.name)}</Link>}
              <a href={item.url} target="_blank" rel="noreferrer" className={secondaryBtn}>Open source page ↗</a>
              {item.signal_id === "other" && (
                <Link href={makeSignalHref(item.label, item.what)} className={secondaryBtn}>Add to signal list</Link>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
