import FabricLabel from "@/components/FabricLabel";
import { type EditionPov, leaderName, leaderText } from "@/components/frontier/items";

/** On a leaders' Point of View: what Tata had committed in each fabric when
 *  the edition was published, and the state it reached. One line when
 *  nothing is recorded anywhere. */
export default function PovLeader({ fabrics }: { fabrics: NonNullable<EditionPov["fabrics"]> }) {
  const rows = fabrics.filter((f) => f.leader);
  if (rows.length === 0) return null;
  const none = rows.every((f) => f.leader!.state === "undefined");
  return (
    <section aria-label="What Tata has committed" className="mt-4 break-inside-avoid rounded-card border border-line bg-white px-4 py-3 text-[13px]">
      <h2 className="font-mono text-[11px] uppercase tracking-[0.25em] text-neutral-500">What Tata has committed</h2>
      {none ? (
        <p className="mt-1 text-neutral-700">
          Nothing recorded yet: <b>Undefined</b> (no owner) in {rows.length === 1 ? rows[0].fabric : `all ${rows.length} fabrics`}.
        </p>
      ) : (
        <ul className="mt-1.5 space-y-1">
          {rows.map((f) => (
            <li key={f.fabric_id} className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
              <FabricLabel id={f.fabric_id} name={f.fabric} />
              <span className={`rounded px-1.5 py-px text-[11px] ${leaderName(f.leader!).chip}`}>{leaderName(f.leader!).name}</span>
              <span className="text-neutral-700">{leaderText(f.leader!)}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
