"use client";

import { useEffect, useState } from "react";
import BackendError from "@/components/BackendError";
import ConfirmAction from "@/components/ConfirmAction";
import SavedNote from "@/components/SavedNote";
import { startClassify } from "@/lib/actions";
import { configChanged, errorText, fetchJson, sendJson } from "@/lib/api";
import type { ListItem } from "@/lib/classification";
import { formatDate, plural } from "@/lib/format";

const field = "mt-1 block w-full rounded border border-neutral-300 bg-white px-3 py-1.5 text-sm outline-none focus:border-neutral-500";

// what saving does on the classification lists (Classify reads them)
const CLASSIFY_NOTE = "A new name shows at once; a changed definition marks the technologies filed under it to be " +
  "classified again; an addition applies from the next classification.";

/** One seeded list (commercial availability, TRL levels, path-to-scale
 *  steps…): its items, each with its words, and how many technologies each
 *  holds. The item you click opens into its edit form in place; "+ Add" opens
 *  one at the bottom. A changed definition marks the technologies filed under
 *  the old wording, and offers to classify them again, with the cost first. */
export default function ListItems({ list, noun, fields, canAdd = true, canRemove = true, technologies = true,
  removeNote = "Technologies filed under it move to the catch-all, or to what the radar judged from their pages, "
    + "marked to be classified again. A choice a person or an import made for it is withdrawn; History keeps it.", note = CLASSIFY_NOTE }: {
  list: string;
  noun: string;
  fields: { key: keyof ListItem | "evidence_needed" | "decision"; label: string; kind?: "text" | "long" | "number" | "check" | "date"; note?: string }[];
  canAdd?: boolean;
  canRemove?: boolean;
  technologies?: boolean;
  removeNote?: string; // what removing an item does, asked before it's removed
  note?: string; // what saving does on this page, under the form and after saving: the classification lists' rule by default
}) {
  const [items, setItems] = useState<ListItem[] | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [edit, setEdit] = useState<Record<string, unknown> | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [marked, setMarked] = useState(0);
  const [cost, setCost] = useState<{ technologies: number; tokens_about: number } | null>(null);
  const load = () => fetchJson<{ items: ListItem[] }>(`/api/lists/${list}`).then((d) => setItems(d.items)).catch(setError);
  useEffect(() => { load(); }, [list]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (marked) fetchJson<{ technologies: number; tokens_about: number }>("/api/classify/preview?pending=true").then(setCost).catch(() => {});
  }, [marked]);

  async function save() {
    if (!edit) return;
    setSaveError(null);
    setSaved(false);
    try {
      const isNew = !edit._id;
      const r = await sendJson<{ marked_for_review?: number }>(isNew ? `/api/lists/${list}` : `/api/lists/${list}/${edit._id}`,
        isNew ? "POST" : "PUT", edit);
      setMarked(r.marked_for_review ?? 0);
      setSaved(true);
      setEdit(null);
      configChanged();
      load();
    } catch (e) {
      setSaveError(errorText(e));
    }
  }

  // each item's own words (its long fields but the name), shown under it, labelled when there are several
  const words = fields.filter((f) => f.kind === "long" && f.key !== "name");
  // the edit form, in place of the item it edits (or at the bottom, for a new one)
  const form = edit && (
    <form className="space-y-4 bg-neutral-50 px-4 py-4" onSubmit={(e) => { e.preventDefault(); save(); }}>
      <h2 className="font-semibold">{edit._id ? `Edit ${String(edit.name)}` : `Add ${noun}`}</h2>
      {fields.map((f) => (
        <label key={String(f.key)} className="block text-sm font-medium">
          {f.kind === "check" ? (
            <span className="flex items-center gap-2">
              <input type="checkbox" checked={Boolean(edit[f.key])} onChange={(e) => setEdit({ ...edit, [f.key]: e.target.checked })} />
              {f.label}
            </span>
          ) : (
            <>
              {f.label}
              {f.kind === "long" ? (
                <textarea className={field} value={String(edit[f.key] ?? "")}
                  rows={Math.max(5, Math.ceil(String(edit[f.key] ?? "").length / 80) + 1)}
                  onChange={(e) => setEdit({ ...edit, [f.key]: e.target.value })} />
              ) : (
                <input className={field} type={f.kind === "number" ? "number" : f.kind === "date" ? "date" : "text"} value={String(edit[f.key] ?? "")}
                  onChange={(e) => setEdit({ ...edit, [f.key]: f.kind === "number" ? Number(e.target.value) : e.target.value })} />
              )}
            </>
          )}
          {f.note && <span className="mt-1 block text-xs font-normal text-neutral-500">{f.note}</span>}
        </label>
      ))}
      {saveError && <p className="text-sm text-failed">Not saved: {saveError}</p>}
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" className="rounded-full bg-navy px-4 py-2 text-sm font-medium text-white hover:bg-navy-strong">Save</button>
        <button type="button" onClick={() => setEdit(null)} className="px-2 py-2 text-sm text-neutral-600 hover:text-black">Cancel</button>
        {canRemove && Boolean(edit._id) && !edit.catch_all && (
          <ConfirmAction label="Remove" secondary confirmLabel="Remove"
            question={`Remove ${String(edit.name)}? ${removeNote}`}
            onConfirm={async () => { await sendJson(`/api/lists/${list}/${edit._id}`, "DELETE"); setEdit(null); configChanged(); load(); }} />
        )}
      </div>
      <p className="text-xs text-neutral-500">Saving costs no model calls. {note}</p>
    </form>
  );

  return (
    <div>
      {error != null && <BackendError error={error} />}
      {marked > 0 && (
        <div className="mb-4 flex flex-wrap items-center gap-3 rounded-card border border-amber-300 bg-amber-50 px-4 py-3 text-sm">
          {plural(marked, "technology was", "technologies were")} classified under the old wording, and {marked === 1 ? "is" : "are"} marked to be classified again.
          <ConfirmAction label={`Re-classify ${cost?.technologies ?? marked}`} secondary
            cost={cost ? `about ${cost.tokens_about.toLocaleString()} tokens` : undefined}
            question={`Classify ${plural(cost?.technologies ?? marked, "technology", "technologies")} again (every one marked or with new pages)? One model call each.`}
            onConfirm={() => startClassify(null).then(() => setMarked(0))} />
        </div>
      )}
      <SavedNote show={saved} what={note} />
      <div className="divide-y divide-neutral-100 overflow-hidden rounded-card border border-line bg-white">
        {items?.map((i) => edit?._id === i._id ? <div key={i._id}>{form}</div> : (
          <button key={i._id} type="button" onClick={() => { setEdit({ ...i }); setSaveError(null); setSaved(false); }}
            className="flex w-full items-baseline gap-4 px-4 py-2.5 text-left hover:bg-neutral-50">
            {i.level != null && <span className="w-6 shrink-0 font-mono text-sm">{i.level}</span>}
            {i.date && <span className="w-24 shrink-0 text-xs text-muted">{formatDate(i.date, true)}</span>}
            <span className="min-w-0 flex-1">
              <span className="font-medium">{i.name}</span>
              {i.catch_all && <span className="ml-2 rounded bg-neutral-100 px-1.5 text-[11px] text-muted">catch-all</span>}
              {i.emerging && <span className="ml-2 rounded bg-azure/15 px-1.5 text-[11px] text-navy">counts as emerging</span>}
              {words.map((f) => {
                const text = (i as Record<string, unknown>)[f.key];
                return text ? (
                  <span key={f.key} className="mt-0.5 block text-sm text-neutral-600">
                    {words.length > 1 && <span className="text-muted">{f.label}: </span>}{String(text)}
                  </span>
                ) : null;
              })}
            </span>
            {technologies && <span className="shrink-0 text-xs tabular-nums text-muted">{plural(i.technologies ?? 0, "technology", "technologies")}</span>}
            <span className="shrink-0 text-sm text-link">Edit</span>
          </button>
        ))}
        {edit && !edit._id ? form : canAdd && (
          <button type="button" onClick={() => { setEdit({ name: "", definition: "" }); setSaveError(null); setSaved(false); }}
            className="w-full px-4 py-2.5 text-left text-sm text-link hover:bg-neutral-50">
            + Add {noun}
          </button>
        )}
      </div>
    </div>
  );
}
