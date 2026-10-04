/** A metric to watch, as the assessment stores it (one list per technology). */
export type WatchMetric = {
  metric: string;
  current_value?: string;
  source?: string;
  inflection_threshold?: string;
  direction?: string;
  implication?: string;
};

const WAY: Record<string, string> = { rising: "should rise ↑", falling: "should fall ↓" };
const term = "italic text-neutral-500";
const URL_AT_END = /\s*(https?:\/\/\S+?)[.,;]?\s*$/;

/** Today's value and its source. Older metrics end their text with the URL;
 *  it's lifted out into the same "source ↗" link. */
function nowAndSource(m: WatchMetric): { text: string; source?: string } {
  const found = m.current_value?.match(URL_AT_END);
  if (m.source || !found) return { text: m.current_value ?? "", source: m.source };
  return { text: m.current_value!.replace(found[0], "").trim(), source: found[1] };
}

/** The metrics to watch, the same on an assessment and a Point of View: what's
 *  measured, today's value and its source, the threshold that would change the
 *  story and what crossing it would mean. Callers say they're suggestions that
 *  nothing tracks automatically. */
export default function WatchMetrics({ metrics }: { metrics: WatchMetric[] }) {
  return (
    // on paper, no outer box: a metric moved to the next page leaves no empty frame
    <div className="divide-y divide-neutral-100 rounded-card border border-line bg-white text-sm print:rounded-none print:border-0">
      {metrics.map((m, i) => {
        const now = nowAndSource(m);
        return (
        <div key={i} className="break-inside-avoid px-5 py-4 print:px-0">
          <div className="flex items-baseline justify-between gap-3">
            <span className="min-w-0 font-medium leading-snug">{m.metric}</span>
            {m.direction && <span className="shrink-0 whitespace-nowrap text-xs text-muted">{WAY[m.direction] ?? m.direction}</span>}
          </div>
          {/* Now and Threshold side by side, If crossed across both: clear space between all three */}
          <div className="mt-2 grid gap-x-10 gap-y-3 text-neutral-600 sm:grid-cols-2">
            {m.current_value && (
              <p>
                <span className={term}>Now: </span>{now.text}
                {now.source && (
                  <> <a href={now.source} target="_blank" rel="noreferrer" className="text-link hover:underline">source ↗</a></>
                )}
              </p>
            )}
            {m.inflection_threshold && <p><span className={term}>Threshold: </span>{m.inflection_threshold}</p>}
            {m.implication && <p className="sm:col-span-2"><span className={term}>If crossed: </span>{m.implication}</p>}
          </div>
        </div>
        );
      })}
    </div>
  );
}
