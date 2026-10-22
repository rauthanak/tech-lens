import Link from "next/link";
import FabricLabel from "@/components/FabricLabel";
import { beforePublishing, type FabricOpen, notRecorded, type OpenItem } from "@/lib/open";

/** A technology's to-do list, fabric by fabric: first what needs a person
 *  before its Point of View goes to leaders, then what the owner's record
 *  hasn't got yet. Each item opens its fabric's tab at the part it's done in
 *  (`href`). */
export default function WaitingOnYou({ open, href }: {
  open: FabricOpen[];
  href: (fabricId: string, anchor: string) => string;
}) {
  const group = (title: string, note: string, pick: (o: FabricOpen) => OpenItem[], tone: string) => {
    const rows = open.map((o) => ({ o, items: pick(o) })).filter((r) => r.items.length > 0);
    return rows.length > 0 && (
      <div className="mt-3">
        <h3 className="text-[13px] font-semibold">{title} <span className="font-normal text-muted">· {note}</span></h3>
        <ul className="mt-1 space-y-1.5">
          {rows.map(({ o, items }) => (
            <li key={o.fabric_id} className="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-[13px]">
              <span className="w-28 shrink-0"><FabricLabel id={o.fabric_id} name={o.fabric} /></span>
              {items.map((i) => (
                <Link key={i.label} href={href(o.fabric_id, i.anchor)} className={`rounded-full border px-2.5 py-0.5 hover:underline ${tone}`}>
                  {i.label} →
                </Link>
              ))}
            </li>
          ))}
        </ul>
      </div>
    );
  };
  const nothing = open.every((o) => !beforePublishing(o).length && !notRecorded(o).length);
  return (
    <section className="mt-4 rounded-card border border-line bg-white px-5 py-4">
      <h2 className="font-semibold">Waiting on you</h2>
      {nothing ? <p className="mt-1 text-sm text-muted">Nothing: every fabric is settled and recorded.</p> : <>
        {group("Before publishing", "settle these before the next edition goes to leaders", beforePublishing,
          "border-amber-200 bg-amber-50 text-amber-900")}
        {group("Not recorded yet", "Tata's plan: who owns it, how far Tata has got, what could stop it scaling", notRecorded,
          "border-line bg-ground text-ink")}
      </>}
    </section>
  );
}
