"use client";

import { useState } from "react";
import { errorText } from "@/lib/api";

/** A one-click choice (Accept, Undo, a path step): busy while it saves, then
 *  `onDone`; when it's refused, it says why. */
export default function ActButton({ label, run, onDone, className = "text-link hover:underline", title }: {
  label: string;
  run: () => Promise<unknown>;
  onDone?: () => void;
  className?: string;
  title?: string;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <>
      <button type="button" disabled={busy} title={title} className={`${className} disabled:opacity-50`}
        onClick={async () => {
          setBusy(true);
          setError(null);
          try {
            await run();
            onDone?.();
          } catch (e) {
            setError(errorText(e));
          } finally {
            setBusy(false);
          }
        }}>{label}</button>
      {error && <span className="ml-2 text-xs text-failed">Not saved: {error}</span>}
    </>
  );
}
