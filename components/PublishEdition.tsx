"use client";

import { useEffect, useState } from "react";
import ConfirmAction from "@/components/ConfirmAction";
import { BriefingCard } from "@/components/GateList";
import type { Edition } from "@/components/frontier/items";
import { errorText, fetchJson, sendJson } from "@/lib/api";
import { formatAt, formatDay, plural } from "@/lib/format";
import { isLive, usePipeline } from "@/lib/pipeline";

/** Publish the edition: freezes what leaders see on Frontier, every placement
 *  and Point of View as they stand, with the assumptions in force and the
 *  evidence behind them. Nothing else changes: the radar keeps working, and
 *  leaders see this edition until the next publish. */
export default function PublishEdition() {
  const p = usePipeline();
  const [editions, setEditions] = useState<Edition[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [published, setPublished] = useState(0);
  useEffect(() => {
    fetchJson<{ editions: Edition[] }>("/api/editions")
      .then((d) => { setEditions(d.editions); setError(null); })
      .catch((e) => setError(errorText(e)));
  }, [published]);
  const last = editions?.[0];
  const busy = isLive(p?.assess.status) ? "An assessment run is in progress: publish when it finishes."
    : p?.pov.job?.status === "running" ? "Points of View are being written now: publish when that finishes." : null;

  // closed, the card says what leaders see now, or why it can't
  const summary = error ? `the editions didn't load: ${error}` : !editions ? undefined
    : last ? `last published ${last.name ? `Edition ${last.name}, ` : ""}${formatDay(last.published_at)}` : "nothing published yet";

  return (
    <BriefingCard id="publish" title="Publish the edition" summary={summary}
      intro={<>Leaders see only what&apos;s published. Publishing freezes every placement and Point of View as they stand
        now, with the assumptions in force; it rewrites nothing and costs no model calls. You keep working; leaders keep
        seeing this edition until the next publish.</>}>
      {editions && (
        <p className="mt-2 text-sm">
          {last ? (
            <>Leaders see <b className="font-semibold">{last.name ? `Edition ${last.name}` : "the edition"}</b>, published{" "}
              {formatAt(last.published_at, last.tz)}: {plural(last.counts.placements, "placement")},{" "}
              {plural(last.counts.povs, "Point of View", "Points of View")}
              {last.previous ? `, ${plural(last.counts.moved, "priority", "priorities")} moved since ${last.previous.label}` : ""}.</>
          ) : "Nothing is published yet: the leaders' view stays empty until the first edition."}
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
    </BriefingCard>
  );
}
