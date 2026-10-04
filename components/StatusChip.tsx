import { LIVE_DOT, STATUS } from "@/lib/theme";

/** A run's status as a chip, styled by STATUS in lib/theme.ts. */
export default function StatusChip({ status }: { status: string }) {
  const s = STATUS[status] ?? { style: "bg-neutral-100 text-muted" };
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 font-mono text-[11px] uppercase ${s.style}`}>
      {s.live && <span className={LIVE_DOT} />}
      {s.mark && <span>{s.mark}</span>}
      {status}
    </span>
  );
}
