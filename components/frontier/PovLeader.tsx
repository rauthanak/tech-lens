import FabricLabel from "@/components/FabricLabel";
import { type EditionPov, type Leader, leaderName } from "@/components/frontier/items";
import { formatDate } from "@/lib/format";

/** What a leader recorded, as labelled lines; only those recorded. */
const LINES: [string, (l: Leader) => string | null][] = [
  ["Owner", (l) => l.owner],
  ["Next", (l) => l.next_action],
  ["By", (l) => (l.due ? formatDate(l.due, true) : null)],
  ["People", (l) => l.people],
  ["Budget", (l) => l.budget],
  ["Proof of concept", (l) => l.poc],
];

/** On a leaders' Point of View, after its five answers: what Tata had
 *  committed in each fabric when the edition was published, as labelled
 *  lines; the fabrics with no owner yet share one line. */
export default function PovLeader({ fabrics }: { fabrics: NonNullable<EditionPov["fabrics"]> }) {
  const rows = fabrics.filter((f) => f.leader);
  if (rows.length === 0) return null;
  const owned = rows.filter((f) => f.leader!.owner);
  const unowned = rows.filter((f) => !f.leader!.owner);
  return (
    <section aria-label="What Tata has committed" className="mt-6 break-inside-avoid rounded-card border border-line bg-white px-4 py-3 text-[13px]">
      <h2 className="font-mono text-[11px] uppercase tracking-[0.25em] text-neutral-500">What Tata has committed</h2>
      {owned.map((f) => (
        <div key={f.fabric_id} className="mt-2.5">
          <p className="flex flex-wrap items-baseline gap-x-2">
            <FabricLabel id={f.fabric_id} name={f.fabric} />
            <span className={`rounded px-1.5 py-px text-[11px] ${leaderName(f.leader!).chip}`}>{leaderName(f.leader!).name}</span>
          </p>
          <dl className="mt-1 space-y-0.5">
            {LINES.map(([name, of]) => {
              const v = of(f.leader!);
              return v ? (
                <div key={name} className="flex gap-3">
                  <dt className="w-32 shrink-0 text-muted">{name}</dt>
                  <dd className="min-w-0 flex-1 text-neutral-800">{v}</dd>
                </div>
              ) : null;
            })}
          </dl>
        </div>
      ))}
      {unowned.length > 0 && (
        <p className={`${owned.length ? "mt-2.5" : "mt-1"} text-neutral-700`}>
          <b>No owner yet</b>{" "}
          {owned.length === 0 && unowned.length > 1 ? `in any of its ${unowned.length} fabrics` : `in ${unowned.map((f) => f.fabric).join(", ")}`}.
        </p>
      )}
    </section>
  );
}
