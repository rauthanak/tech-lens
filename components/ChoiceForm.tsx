"use client";

import { useState } from "react";
import { errorText } from "@/lib/api";

/** A small inline form for a person's choice: a value (a score 0–10, or one
 *  of `options`) and a reason, required when the choice needs one. Says why
 *  it was refused. */
export default function ChoiceForm({ label, options, value: initial, reasonRequired, placeholder, onSubmit, onCancel }: {
  label: string;
  options?: { value: string; label: string }[];
  value?: string; // the choice it opens on; else the first option, or "Choose…" when this is ""
  reasonRequired: boolean;
  placeholder?: string;
  onSubmit: (value: number | string, reason: string) => Promise<unknown>;
  onCancel: () => void;
}) {
  const [value, setValue] = useState<string>(initial ?? options?.[0]?.value ?? "");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ready = value !== "" && (!reasonRequired || reason.trim() !== "");
  return (
    <form className="mt-2 flex flex-wrap items-end gap-2 rounded-lg border border-line bg-ground/60 p-3 text-sm"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError(null);
        try {
          await onSubmit(options ? value : Number(value), reason.trim());
        } catch (err) {
          setError(errorText(err));
          setBusy(false);
        }
      }}>
      <label className="flex flex-col text-xs text-muted">
        {label}
        {options ? (
          <select value={value} onChange={(e) => setValue(e.target.value)}
            className="mt-1 max-w-full rounded border border-neutral-300 bg-white px-2 py-1 text-sm text-ink">
            {initial === "" && <option value="" disabled>Choose…</option>}
            {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        ) : (
          <input type="number" min={0} max={10} step={0.5} required value={value} onChange={(e) => setValue(e.target.value)}
            className="mt-1 w-20 rounded border border-neutral-300 bg-white px-2 py-1 text-sm text-ink" />
        )}
      </label>
      <label className="flex min-w-0 flex-1 basis-60 flex-col text-xs text-muted">
        Why{reasonRequired ? " (required)" : " (optional)"}
        <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder={placeholder}
          className="mt-1 rounded border border-neutral-300 bg-white px-2 py-1 text-sm text-ink" />
      </label>
      <button type="submit" disabled={!ready || busy}
        className="rounded-full bg-navy px-3.5 py-1.5 text-white hover:bg-navy-strong disabled:opacity-50">
        {busy ? "Saving…" : "Save"}
      </button>
      <button type="button" onClick={onCancel} className="px-1 py-1.5 text-muted hover:text-ink">Cancel</button>
      {error && <p className="basis-full text-xs text-failed">Not saved: {error}</p>}
    </form>
  );
}
