"use client";

import { plural } from "@/lib/format";

/** The bar that appears when rows are ticked: how many, the actions that
 *  apply to all of them (its children), and Clear. It stays in view at the
 *  bottom of the screen while the list scrolls. */
export default function BulkBar({ count, onClear, note, children }: {
  count: number;
  onClear: () => void;
  note?: string | null;
  children: React.ReactNode;
}) {
  if (count === 0) return null;
  return (
    <div role="region" aria-label="Selected technologies"
      className="sticky bottom-4 z-20 mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-card border border-navy bg-navy px-5 py-3 text-sm text-white shadow-lg">
      <span className="font-semibold">{plural(count, "technology", "technologies")} selected</span>
      {children}
      {note && <span className="text-white/80">{note}</span>}
      <button type="button" onClick={onClear} className="ml-auto text-white/80 underline-offset-4 hover:underline">
        Clear
      </button>
    </div>
  );
}
