"use client";

import { useState } from "react";
import { ApiError } from "@/lib/api";

/** A two-step button: the first click asks the question (with the cost of
 *  anything that uses the model), the second does it. `disabled` is the
 *  reason it can't start now, shown under the button. */
export default function ConfirmAction({
  label,
  cost,
  question,
  confirmLabel = "Start",
  onConfirm,
  disabled,
  secondary = false,
}: {
  label: string;
  cost?: string;
  question: string;
  confirmLabel?: string;
  onConfirm: () => Promise<unknown> | void;
  disabled?: string | null;
  secondary?: boolean;
}) {
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const confirm = async () => {
    setBusy(true);
    setError(null);
    try {
      await onConfirm();
      setAsking(false);
    } catch (e) {
      setError(e instanceof ApiError && e.detail ? e.detail : "It couldn't start. Check that tech-atlas is running.");
    } finally {
      setBusy(false);
    }
  };

  if (asking) {
    return (
      <span className="inline-flex flex-col items-start gap-1">
        <span className="inline-flex flex-wrap items-center gap-2 text-sm">
          <span className="text-ink">{question}</span>
          <button type="button" onClick={confirm} disabled={busy}
            className="rounded-full bg-navy px-3.5 py-1 text-sm text-white hover:bg-navy-strong disabled:opacity-50">
            {busy ? "Starting…" : confirmLabel}
          </button>
          <button type="button" onClick={() => { setAsking(false); setError(null); }} disabled={busy}
            className="rounded-full border border-line bg-white px-3.5 py-1 text-sm hover:bg-ground">
            Cancel
          </button>
        </span>
        {error && <span className="text-xs text-failed">{error}</span>}
      </span>
    );
  }
  return (
    <span className="inline-flex flex-col items-start gap-1">
      <button type="button" onClick={() => setAsking(true)} disabled={!!disabled}
        className={`rounded-full px-3.5 py-1.5 text-sm disabled:cursor-not-allowed disabled:opacity-50 ${
          secondary ? "border border-line bg-white text-ink hover:bg-ground"
            : "bg-navy text-white hover:bg-navy-strong"}`}>
        {label}
        {cost && <span className="opacity-75"> · {cost}</span>}
      </button>
      {disabled && <span className="text-xs text-muted">{disabled}</span>}
    </span>
  );
}
