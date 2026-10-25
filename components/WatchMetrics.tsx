"use client";

import { useState } from "react";
import ActButton from "@/components/ActButton";
import { errorText } from "@/lib/api";
import { decide, undo } from "@/lib/decisions";
import { formatDay } from "@/lib/format";

/** A person's choice on a sign (services/watch), with its id for Undo. */
type ByPerson = { decision_id: string; at: string; tz?: string | null; reason?: string | null };

/** A sign to watch, as the API serves it (one list per technology, people's choices applied). */
export type WatchMetric = {
  metric: string;
  key?: string;                 // the sign's id, from its wording (services/watch)
  current_value?: string;
  source?: string;
  inflection_threshold?: string;
  direction?: string;
  implication?: string;
  crossed?: boolean | null;     // checked at the next assessment: true, false, or null (no newer value)
  previous_value?: string | null;
  crossed_note?: string | null; // why a claimed crossing doesn't count
  threshold_by?: ByPerson;      // a person set the threshold
  model_threshold?: string;     // what the model had proposed
  crossed_by?: ByPerson;        // a person said it hasn't crossed
  model_crossed?: boolean | null;
};

/** What a sign and its threshold are, in one sentence: said wherever signs show. */
export const SIGNS_EXPLAINED = "Each assessed technology has 2 to 4 signs to watch. At its first assessment the radar proposes " +
  "each sign and its threshold, the point at which the answer changes; every assessment checks them again. A person " +
  "can change a threshold, or say a sign hasn't crossed, on the technology's Assessment tab.";

const WAY: Record<string, string> = { rising: "should rise ↑", falling: "should fall ↓" };
const URL_AT_END = /\s*(https?:\/\/\S+?)[.,;]?\s*$/;
const label = "w-24 shrink-0 text-[12.5px] text-muted";

/** Today's value and its source. Older signs end their text with the URL;
 *  it's lifted out into the same "source ↗" link. */
function nowAndSource(m: WatchMetric): { text: string; source?: string } {
  const found = m.current_value?.match(URL_AT_END);
  if (m.source || !found) return { text: m.current_value ?? "", source: m.source };
  return { text: m.current_value!.replace(found[0], "").trim(), source: found[1] };
}

function Line({ name, children }: { name: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3">
      <dt className={label}>{name}</dt>
      <dd className="min-w-0 flex-1 text-neutral-700">{children}</dd>
    </div>
  );
}

/** One sign as labelled lines, threshold first. `owned`: on the technology's
 *  Assessment tab, where a person can change its threshold or say it hasn't crossed. */
export function Sign({ m, owned }: { m: WatchMetric; owned?: { techId: string; onChanged: () => void } }) {
  const now = nowAndSource(m);
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(m.inflection_threshold ?? "");
  const [error, setError] = useState<string | null>(null);
  const save = async () => {
    setError(null);
    try {
      await decide({ kind: "watch_threshold", tech_id: owned!.techId, key: m.key, value: text });
      setEditing(false);
      owned!.onChanged();
    } catch (e) { setError(errorText(e)); }
  };
  return (
    <div className="break-inside-avoid px-5 py-4 text-sm print:px-0">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <span className="min-w-0 font-medium leading-snug">
          {m.metric}
          {m.crossed && <span className="ml-2 whitespace-nowrap rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-900">Crossed its threshold</span>}
          {m.crossed_by && <span className="ml-2 whitespace-nowrap rounded-full bg-ground px-2 py-0.5 text-xs text-ink">Not crossed (set by a person)</span>}
        </span>
        {m.direction && <span className="shrink-0 whitespace-nowrap text-xs text-muted">{WAY[m.direction] ?? m.direction}</span>}
      </div>
      <dl className="mt-2 space-y-1.5">
        {(m.inflection_threshold || editing) && (
          <Line name="Threshold">
            {editing ? (
              <span className="block space-y-1.5">
                <textarea value={text} onChange={(e) => setText(e.target.value)} rows={2} aria-label="Threshold"
                  className="block w-full rounded border border-neutral-300 px-2 py-1.5 text-[13px]" />
                <span className="flex items-center gap-3">
                  <button type="button" onClick={save} disabled={!text.trim()}
                    className="rounded-full bg-navy px-3.5 py-1 text-[13px] text-white disabled:opacity-40">Save</button>
                  <button type="button" onClick={() => setEditing(false)} className="text-[13px] text-muted">Cancel</button>
                  <span className="text-xs text-muted">Kept at every assessment; the radar judges the sign against it.</span>
                </span>
                {error && <span className="block text-failed">{error}</span>}
              </span>
            ) : (
              <>
                {m.inflection_threshold}
                {m.threshold_by && <span className="text-muted"> (set by a person on {formatDay(m.threshold_by.at, m.threshold_by.tz)})</span>}
              </>
            )}
          </Line>
        )}
        {m.previous_value && <Line name="Was">{m.previous_value}</Line>}
        {m.current_value && (
          <Line name="Now">
            {now.text}
            {now.source && <> <a href={now.source} target="_blank" rel="noreferrer" className="text-link hover:underline">source ↗</a></>}
          </Line>
        )}
        {m.implication && <Line name="Means">{m.implication}</Line>}
        {m.crossed_note && <Line name="Note">{m.crossed_note}</Line>}
      </dl>
      {owned && m.key && !editing && (
        <p className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] print:hidden">
          <button type="button" onClick={() => { setText(m.inflection_threshold ?? ""); setEditing(true); }}
            className="text-link hover:underline">Edit threshold</button>
          {m.threshold_by && (
            <ActButton label="Undo the threshold" title={`Back to the radar's: ${m.model_threshold ?? ""}`}
              run={() => undo(m.threshold_by!.decision_id)} onDone={owned.onChanged} />
          )}
          {m.crossed && !m.crossed_by && (
            <ActButton label="Not crossed" title="Take it off the Briefing's crossed signs; the next assessment checks it again"
              run={() => decide({ kind: "watch_crossed", tech_id: owned.techId, key: m.key, value: "no" })} onDone={owned.onChanged} />
          )}
          {m.crossed_by && (
            <ActButton label="Undo Not crossed" run={() => undo(m.crossed_by!.decision_id)} onDone={owned.onChanged} />
          )}
        </p>
      )}
    </div>
  );
}

/** The signs to watch, the same on an assessment and a Point of View. */
export default function WatchMetrics({ metrics, owned }: { metrics: WatchMetric[]; owned?: { techId: string; onChanged: () => void } }) {
  return (
    // on paper, no outer box: a sign moved to the next page leaves no empty frame
    <div className="divide-y divide-neutral-100 rounded-card border border-line bg-white print:rounded-none print:border-0">
      {metrics.map((m, i) => <Sign key={m.key ?? i} m={m} owned={owned} />)}
    </div>
  );
}
