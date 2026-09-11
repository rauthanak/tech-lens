"use client";

import { useEffect, useState } from "react";
import BackendError from "@/components/BackendError";
import { ApiError, fetchJson, sendJson } from "@/lib/api";
import { AXIS_LABELS, AXIS_ORDER, Measure, OpenQuestionBadge } from "@/lib/scoring";

const field =
  "mt-1 w-full rounded border border-neutral-300 bg-white px-3 py-1.5 text-sm outline-none focus:border-neutral-500";

export default function MeasuresPage() {
  const [measures, setMeasures] = useState<Measure[] | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [selected, setSelected] = useState<Measure | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = () =>
    fetchJson<{ measures: Measure[] }>("/api/scoring/measures")
      .then((d) => setMeasures(d.measures))
      .catch(setError);

  useEffect(() => {
    load();
  }, []);

  async function save() {
    if (!selected) return;
    setSaving(true);
    setSaveError(null);
    try {
      await sendJson(`/api/scoring/measures/${selected._id}`, "PUT", {
        name: selected.name,
        axis: selected.axis,
        weight: selected.weight,
        definition: selected.definition,
        anchors: selected.anchors,
        required_evidence: selected.required_evidence,
        open_question: selected.open_question || null,
      });
      setSelected(null);
      load();
    } catch (e) {
      setSaveError(e instanceof ApiError ? (e.detail ?? e.message) : "save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <p className="max-w-2xl text-sm text-neutral-600">
        The twelve questions every technology is scored on (0–10, evidence
        required). Nine render the TORA axes; three are scored alongside.
        Click a measure to edit its definition, anchors and weight.
      </p>

      {error != null && <BackendError error={error} />}

      <div
        className={
          selected
            ? "grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,28rem)]"
            : ""
        }
      >
        <div>
          {measures &&
            AXIS_ORDER.map((axis) => {
              const rows = measures
                .filter((m) => m.axis === axis)
                .sort((a, b) => a.code.localeCompare(b.code));
              if (rows.length === 0) return null;
              return (
                <section key={axis} className="mt-6">
                  <h2 className="text-base font-semibold">{AXIS_LABELS[axis]}</h2>
                  <div className="mt-2 divide-y divide-neutral-100 border border-neutral-200 bg-white">
                    {rows.map((m) => (
                      <button
                        key={m._id}
                        onClick={() => {
                          setSelected({ ...m });
                          setSaveError(null);
                        }}
                        className={`flex w-full items-center gap-4 px-4 py-2.5 text-left hover:bg-neutral-50 ${
                          selected?._id === m._id ? "bg-neutral-50" : ""
                        }`}
                      >
                        <span className="w-8 shrink-0 font-mono text-xs text-neutral-500">{m.code}</span>
                        <span className="min-w-0 flex-1 truncate">
                          <span className="font-medium">{m.name}</span>
                          {!selected && (
                            <span className="ml-2 text-sm text-neutral-500">{m.definition}</span>
                          )}
                        </span>
                        <span className="shrink-0 font-mono text-xs tabular-nums text-neutral-600">
                          {m.weight != null ? `× ${m.weight}` : "—"}
                        </span>
                        <OpenQuestionBadge question={m.open_question} />
                      </button>
                    ))}
                  </div>
                </section>
              );
            })}
        </div>

        {selected && (
          <form
            className="space-y-4 border border-neutral-200 bg-white px-6 py-5 lg:sticky lg:top-6 lg:mt-14"
            onSubmit={(e) => {
              e.preventDefault();
              save();
            }}
          >
            <div className="flex items-baseline justify-between">
              <h2 className="text-lg font-semibold">
                Edit {selected.code} — {selected.name}
              </h2>
              <span className="font-mono text-xs text-neutral-500">v{selected.version}</span>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium">Name</label>
                <input className={field} value={selected.name}
                  onChange={(e) => setSelected({ ...selected, name: e.target.value })} required />
              </div>
              <div>
                <label className="block text-sm font-medium">
                  Weight within axis {selected.axis === "extra" && "(extras carry none)"}
                </label>
                <input className={field} type="number" step="0.05" min="0" max="1"
                  value={selected.weight ?? ""}
                  onChange={(e) =>
                    setSelected({ ...selected, weight: e.target.value === "" ? null : Number(e.target.value) })
                  } />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium">Definition</label>
              <textarea className={`${field} min-h-16`} value={selected.definition}
                onChange={(e) => setSelected({ ...selected, definition: e.target.value })} required />
            </div>
            {(["low", "mid", "high"] as const).map((k) => (
              <div key={k}>
                <label className="block text-sm font-medium">Anchor — {k}</label>
                <input className={field} value={selected.anchors[k]}
                  onChange={(e) =>
                    setSelected({ ...selected, anchors: { ...selected.anchors, [k]: e.target.value } })
                  } required />
              </div>
            ))}
            <div>
              <label className="block text-sm font-medium">Required evidence</label>
              <textarea className={`${field} min-h-16`} value={selected.required_evidence}
                onChange={(e) => setSelected({ ...selected, required_evidence: e.target.value })} required />
            </div>
            <div>
              <label className="block text-sm font-medium">Open question</label>
              <input className={field} value={selected.open_question ?? ""}
                placeholder="what still needs the client's answer — blank it once settled"
                onChange={(e) => setSelected({ ...selected, open_question: e.target.value })} />
            </div>
            {saveError && <p className="text-sm text-[#7a3c1e]">Save failed: {saveError}</p>}
            <div className="flex items-center gap-3">
              <button type="submit" disabled={saving}
                className="bg-[#171513] px-4 py-2 text-sm font-medium text-white hover:bg-black disabled:opacity-50">
                {saving ? "Saving…" : "Save"}
              </button>
              <button type="button" onClick={() => setSelected(null)}
                className="px-2 py-2 text-sm text-neutral-600 hover:text-black">
                Cancel
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
