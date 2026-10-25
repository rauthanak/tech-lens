"use client";

import { useState } from "react";
import { errorText, sendJson } from "@/lib/api";
import { plural } from "@/lib/format";

/** The names a technology is looked for by on pages (agent/tagger), with Edit;
 *  pages that name it only in passing (counted apart, never evidence); and,
 *  for a catalog entry, the note when it reads as a use case or a category. */
export default function LookFor({ techId, names, by, mentions, notATechnology, onSaved }: {
  techId: string; names: string[]; by: string | null; mentions: number; notATechnology: string | null;
  onSaved: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const save = async () => {
    setError(null);
    try {
      await sendJson(`/api/technologies/${techId}/look-for`, "PUT", { names: text.split("\n").map((n) => n.trim()).filter(Boolean) });
      setEditing(false);
      onSaved();
    } catch (err) {
      setError(errorText(err));
    }
  };
  return (
    <div className="mt-2 max-w-4xl space-y-1 text-sm text-neutral-700">
      {notATechnology && (
        <p className="text-amber-900">Reads as an industry application rather than a technology: {notATechnology.replace(/\.$/, "")}.
          Pages rarely name it this way; worth asking Tata which technology it stands for.</p>
      )}
      {editing ? (
        <div className="space-y-1.5">
          <label className="block">
            <span className="text-muted">Names to look for on pages, one per line (at most 12)</span>
            <textarea value={text} onChange={(e) => setText(e.target.value)} rows={4}
              className="mt-1 block w-full max-w-xl rounded border border-neutral-300 px-2 py-1.5 text-[13px]" />
          </label>
          <div className="flex items-center gap-3">
            <button type="button" onClick={save} className="rounded-full bg-navy px-3.5 py-1 text-[13px] text-white">Save</button>
            <button type="button" onClick={() => setEditing(false)} className="text-[13px] text-muted">Cancel</button>
            <span className="text-xs text-muted">The next collection, or Link known names on Operations, looks for them.</span>
          </div>
          {error && <p className="text-failed">{error}</p>}
        </div>
      ) : (
        <p className="text-muted">
          {names.length ? <>Looked for on pages as {names.map((n, i) => (
            <span key={n}>{i > 0 && ", "}<span className="text-ink">{n}</span></span>
          ))}{by === "person" ? " (set by a person)" : ""}. </> : "Not looked for on pages by name yet. "}
          <button type="button" onClick={() => { setText(names.join("\n")); setEditing(true); }}
            className="text-link hover:underline">{names.length ? "Edit names" : "Add names"}</button>
        </p>
      )}
      {mentions > 0 && (
        <p className="text-muted">Named in passing on {plural(mentions, "more page")}: counted apart, not as evidence.</p>
      )}
    </div>
  );
}
