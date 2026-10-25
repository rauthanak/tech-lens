"use client";

import { PAGE_SIZE } from "@/lib/paging";

/** "‹ Prev · 101–150 of 10,512 · Next ›" for a list in pages, at its top
 *  and bottom. `shorter`: the list shrank while you were away, so the last
 *  full page is shown, and it says so. `onStartOver`: back to the first rows
 *  with no filters. Nothing shows for a list that fits on one page. */
export default function Pager({ start, total, size = PAGE_SIZE, go, shorter, onStartOver, what = "", className = "" }: {
  start: number; total: number; size?: number; go: (start: number) => void; shorter?: boolean;
  onStartOver?: () => void; what?: string; className?: string;
}) {
  if (total <= size && !shorter && start === 0) return null;
  const last = Math.max(0, Math.floor((total - 1) / size) * size);
  const end = Math.min(total, start + size);
  const button = "rounded-full border border-line bg-white px-3 py-1 hover:bg-ground disabled:cursor-not-allowed disabled:opacity-40";
  return (
    <nav aria-label={`Pages${what ? ` of ${what}` : ""}`} className={`flex flex-wrap items-center gap-2 text-[13px] ${className}`}>
      <button type="button" className={button} disabled={start === 0} onClick={() => go(0)} aria-label="First page">«</button>
      <button type="button" className={button} disabled={start === 0} onClick={() => go(Math.max(0, start - size))}>‹ Prev</button>
      <span className="px-1 tabular-nums text-ink">
        {total ? `${(start + 1).toLocaleString()}–${end.toLocaleString()}` : "0"} of {total.toLocaleString()}{what && ` ${what}`}
      </span>
      <button type="button" className={button} disabled={end >= total} onClick={() => go(start + size)}>Next ›</button>
      <button type="button" className={button} disabled={start >= last} onClick={() => go(last)} aria-label="Last page">»</button>
      {shorter && <span className="text-muted">The list is shorter now: showing its last page.</span>}
      {onStartOver && (start > 0 || shorter) && (
        <button type="button" onClick={onStartOver} className="text-link hover:underline">Start over</button>
      )}
    </nav>
  );
}
