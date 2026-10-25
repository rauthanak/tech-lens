"use client";

import { useEffect, useState } from "react";
import { fetchJson } from "@/lib/api";
import { formatDay, formatTokens, plural } from "@/lib/format";
import { useHood } from "@/lib/hood";
import { beforeRecording, tokenLine, tokensIn, type Tokens, type UsageRow } from "@/lib/usage";

type Usage = { by_skill: UsageRow[]; total: Tokens; recorded_since: string | null;
  failures?: { reason: string; calls: number }[] }; // why calls failed, most first

/** What a run's model calls used: one line with how many calls and, under
 *  Technical details, the tokens and a table by skill or combined call.
 *  `runIds` adds runs together, such as a collection and the organize that
 *  ended it; `kind` keeps one kind of call (an assessment run's own, not
 *  Points of View once written under its id). `table` shows only the table,
 *  always (Operations has its own line). `calls={false}` leaves the count to
 *  the page, which already shows it. A run that started before tokens were
 *  recorded (`startedAt`) says so rather than show a number that's wrong. */
export default function ModelUse({ runIds, kind, startedAt, table, refresh, calls = true }: {
  runIds: string[]; kind?: string; startedAt?: string | null; table?: boolean; refresh?: unknown; calls?: boolean;
}) {
  const hood = useHood();
  const [usage, setUsage] = useState<Usage | null>(null);
  const key = runIds.join(",");

  useEffect(() => {
    if (!key) return;
    fetchJson<Usage>(`/api/usage?run_id=${encodeURIComponent(key)}${kind ? `&kind=${kind}` : ""}`)
      .then(setUsage).catch(() => setUsage(null));
  }, [key, kind, refresh]);

  if (!usage) return null;
  const old = beforeRecording(startedAt, usage.recorded_since);
  if (usage.by_skill.length === 0) {
    if (!old || !(hood || table)) return null;
    return (
      <p className="mt-3 text-sm text-muted">
        Tokens not recorded: this run is older than token recording
        {usage.recorded_since ? `, which began ${formatDay(usage.recorded_since)}` : ""}.
      </p>
    );
  }
  const t = usage.total;
  // the plain line: the calls (unless the page shows them); the tokens only under Technical details
  const why = usage.failures?.[0] ? `: ${usage.failures[0].reason}${usage.failures.length > 1 ? ", and other reasons" : ""}` : "";
  const line = [calls && `${plural(t.calls, "model call")}${t.failed > 0 ? ` (${t.failed.toLocaleString()} failed${why})` : ""}`,
    hood && `${tokenLine(t)}${old ? ". Only part of this run was recorded: it began before tokens were recorded" : ""}`]
    .filter(Boolean).join(" · ");
  if (!table && !line) return null;
  return (
    <div className={table ? "text-sm text-muted" : "mt-3 text-sm text-muted"}>
      {!table && <p>{line}</p>}
      {(hood || table) && (
        <div className={`overflow-x-auto rounded-card border border-line bg-white ${table ? "" : "mt-2"}`}>
          <table className="w-full min-w-[560px] text-xs">
            <thead>
              <tr className="border-b border-neutral-100 text-left uppercase tracking-wider text-neutral-500">
                {["Skill or call", "Calls", "Failed", "Tokens in", "Reused", "Stored for reuse", "Out"].map((h, i) => (
                  <th key={h} className={`px-3 py-1.5 font-medium ${i ? "text-right" : ""}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100 tabular-nums">
              {usage.by_skill.map((r) => (
                <tr key={r.skill}>
                  <td className="px-3 py-1.5">{r.name}
                    {hood && <span className="ml-1.5 font-mono text-neutral-400">{r.skill}</span>}</td>
                  <td className="px-3 py-1.5 text-right">{r.calls.toLocaleString()}</td>
                  <td className="px-3 py-1.5 text-right">{r.failed || "—"}</td>
                  <td className="px-3 py-1.5 text-right">{formatTokens(tokensIn(r))}</td>
                  <td className="px-3 py-1.5 text-right">{formatTokens(r.cache_read_tokens)}</td>
                  <td className="px-3 py-1.5 text-right">{formatTokens(r.cache_write_tokens)}</td>
                  <td className="px-3 py-1.5 text-right">{formatTokens(r.output_tokens)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="border-t border-neutral-100 px-3 py-1.5 text-[11px] text-neutral-500">
            Tokens in counts every token sent. Reused ones were sent before and cost a fraction of the price;
            stored ones are kept for reuse by the next call. A combined call, carrying several skills, is one row.
          </p>
        </div>
      )}
    </div>
  );
}
