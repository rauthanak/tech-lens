"use client";

import { useEffect, useState } from "react";
import ConfirmAction from "@/components/ConfirmAction";
import type { Edition } from "@/components/frontier/items";
import { errorText, fetchJson, sendJson } from "@/lib/api";
import { formatAt, formatDay, plural } from "@/lib/format";
import { isLive, usePipeline } from "@/lib/pipeline";

type Since = { edition: string; moved: number; placed_new: number; placed_gone: number; povs_written: number;
  now: { placements: number; held: number; povs: number } };

/** An edition as a reader names it: "Edition FY27 Q3", else "the Oct 21 edition". */
export const editionName = (e: Pick<Edition, "name" | "published_at" | "tz">) =>
  e.name ? `Edition ${e.name}` : `the ${formatDay(e.published_at, e.tz)} edition`;

/** Publish to leaders: freezes what leaders see in the leaders' view, every
 *  placement and Point of View as they stand, with the assumptions in force
 *  and the evidence behind them. Nothing else changes: the radar keeps
 *  working, and leaders see this edition until the next publish. For the
 *  Briefing's To do strip: `lines` for its column (when it was last published
 *  and what changed since) and `panel` (the edition, and Publish). */
export function usePublish(): { lines: string[] | null; intro: React.ReactNode; panel: React.ReactNode } {
  const p = usePipeline();
  const [editions, setEditions] = useState<Edition[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [published, setPublished] = useState(0);
  const [since, setSince] = useState<Since | null>(null);
  useEffect(() => {
    fetchJson<{ editions: Edition[] }>("/api/editions")
      .then((d) => { setEditions(d.editions); setError(null); })
      .catch((e) => setError(errorText(e)));
    fetchJson<{ since: Since | null }>("/api/editions/since").then((d) => setSince(d.since)).catch(() => setSince(null));
  }, [published]);
  // what leaders would see differently if it were published now
  const changes = since ? [
    since.povs_written && plural(since.povs_written, "Point of View rewritten", "Points of View rewritten"),
    since.moved && plural(since.moved, "priority moved", "priorities moved"),
    since.placed_new && plural(since.placed_new, "new placement"),
    since.placed_gone && plural(since.placed_gone, "placement gone", "placements gone"),
  ].filter(Boolean).join(", ") : "";
  const last = editions?.[0];
  const busy = isLive(p?.assess.status) ? "An assessment run is in progress: publish when it finishes."
    : p?.pov.job?.status === "running" ? "Points of View are being written now: publish when that finishes." : null;

  // in the strip's column: what leaders see now, and what they'd see differently
  const lines = error ? [`The editions didn't load: ${error}`] : !editions ? null
    : last ? [`Leaders see ${editionName(last)}`, changes ? `Since then: ${changes}` : "Nothing has changed since"]
    : ["Nothing published yet: the leaders' view is empty"];

  const intro = <>Leaders see only what&apos;s published, never your work in progress. Publishing takes a copy of every
    Point of View and placement as they stand now, with the assumptions in force; it rewrites nothing, costs no model
    calls and keeps the editions before it. You keep working; leaders keep seeing that copy until the next publish.</>;
  const panel = (
    <>
      {editions && (
        <p className="mt-2 text-sm">
          {last ? (
            <>Leaders see <b className="font-semibold">{editionName(last)}</b>, published{" "}
              {formatAt(last.published_at, last.tz)}{last.by ? ` by ${last.by.name}` : ""}: {plural(last.counts.placements, "placement")},{" "}
              {plural(last.counts.povs, "Point of View", "Points of View")}
              {last.previous ? `, ${plural(last.counts.moved, "priority", "priorities")} moved since ${last.previous.label}` : ""}.</>
          ) : "Nothing is published yet: the leaders' view stays empty until the first edition."}
        </p>
      )}
      {since && (
        <p className="mt-1 text-sm">
          Publishing now sends {plural(since.now.povs, "Point of View", "Points of View")} and{" "}
          {plural(since.now.placements, "placement")} as they stand
          {since.now.held ? `, plus ${since.now.held.toLocaleString()} not placed yet, each with the reason why` : ""}
          {changes && last ? `. Since ${editionName(last)}: ${changes}` : ""}.
        </p>
      )}
      <div className="mt-3 flex flex-wrap items-end gap-3">
        <label className="flex flex-col text-xs text-muted">
          Name (optional)
          <input value={name} onChange={(e) => setName(e.target.value)} maxLength={60} placeholder="e.g. FY27 Q3"
            className="mt-1 w-44 rounded border border-neutral-300 bg-white px-2 py-1 text-sm text-ink" />
        </label>
        <ConfirmAction label="Publish" confirmLabel="Publish" doneLabel="Published" disabled={busy}
          question={`Publish${name.trim() ? ` "${name.trim()}"` : ""} now? Leaders will see everything as it stands, until the next publish.`}
          onConfirm={async () => {
            await sendJson("/api/editions", "POST", { name: name.trim() || null });
            setName("");
            setPublished((n) => n + 1);
          }} />
      </div>
    </>
  );
  return { lines, intro, panel };
}
