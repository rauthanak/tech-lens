import { LIVE_DOT, STATUS } from "@/lib/theme";

/** A status as a chip, the same everywhere: plain words in sentence case ("Done",
 *  "Stopped"), styled by STATUS in lib/theme.ts; `label` says what's done when "Done" isn't enough. */
export default function StatusChip({ status, label }: { status: string; label?: string }) {
  const s = STATUS[status] ?? { style: "bg-neutral-100 text-muted" };
  const word = label ?? s.word ?? status.replaceAll("_", " ").replace(/^./, (c) => c.toUpperCase());
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2 py-0.5 text-[12px] ${s.style}`}>
      {s.live && <span className={LIVE_DOT} />}
      {s.mark && <span aria-hidden>{s.mark}</span>}
      {word}
    </span>
  );
}
