"use client";

import { useEffect, useState } from "react";
import BackendError from "@/components/BackendError";
import { ApiError, fetchJson, sendJson } from "@/lib/api";
import { Fabric, OpenQuestionBadge } from "@/lib/scoring";

const field =
  "mt-1 w-full rounded border border-neutral-300 bg-white px-3 py-1.5 text-sm outline-none focus:border-neutral-500";

export default function FabricsPage() {
  const [fabrics, setFabrics] = useState<Fabric[] | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [selected, setSelected] = useState<Fabric | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = () =>
    fetchJson<{ fabrics: Fabric[] }>("/api/scoring/fabrics")
      .then((d) => setFabrics(d.fabrics))
      .catch(setError);

  useEffect(() => {
    load();
  }, []);

  async function save() {
    if (!selected) return;
    setSaving(true);
    setSaveError(null);
    try {
      await sendJson(`/api/scoring/fabrics/${selected._id}`, "PUT", {
        name: selected.name,
        definition: selected.definition,
        enabled: selected.enabled,
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
        TCL&apos;s fabrics — the lens every assessment looks through. A technology is
        scored separately in each fabric it touches. Click one to edit its definition.
      </p>

      {error != null && <BackendError error={error} />}

      {fabrics && (
        <div className="mt-5 grid max-w-5xl grid-cols-1 gap-3 sm:grid-cols-2">
          {fabrics.map((f) => (
            <button
              key={f._id}
              onClick={() => {
                setSelected({ ...f });
                setSaveError(null);
              }}
              className={`border bg-white px-5 py-4 text-left hover:border-neutral-400 ${
                selected?._id === f._id ? "border-[#8a4b2d]" : "border-neutral-200"
              }`}
            >
              <div className="flex items-center justify-between gap-3">
                <span className="font-semibold">{f.name}</span>
                <span className="flex items-center gap-2">
                  <OpenQuestionBadge question={f.open_question} />
                  <span
                    className={`inline-block h-2 w-2 rounded-full ${f.enabled ? "bg-emerald-600" : "bg-neutral-300"}`}
                  />
                </span>
              </div>
              <p className="mt-1.5 text-sm text-neutral-600">{f.definition}</p>
            </button>
          ))}
        </div>
      )}

      {selected && (
        <form
          className="mt-7 max-w-2xl space-y-4 border border-neutral-200 bg-white px-6 py-5"
          onSubmit={(e) => {
            e.preventDefault();
            save();
          }}
        >
          <div className="flex items-baseline justify-between">
            <h2 className="text-lg font-semibold">Edit {selected.name}</h2>
            <span className="font-mono text-xs text-neutral-500">v{selected.version}</span>
          </div>
          <div>
            <label className="block text-sm font-medium">Name</label>
            <input className={field} value={selected.name}
              onChange={(e) => setSelected({ ...selected, name: e.target.value })} required />
          </div>
          <div>
            <label className="block text-sm font-medium">Definition (TCL context)</label>
            <textarea className={`${field} min-h-28`} value={selected.definition}
              onChange={(e) => setSelected({ ...selected, definition: e.target.value })} required />
          </div>
          <div>
            <label className="block text-sm font-medium">Open question</label>
            <input className={field} value={selected.open_question ?? ""}
              placeholder="what still needs the client's answer — blank it once settled"
              onChange={(e) => setSelected({ ...selected, open_question: e.target.value })} />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={selected.enabled}
              onChange={(e) => setSelected({ ...selected, enabled: e.target.checked })} />
            Enabled — technologies are assessed in this fabric
          </label>
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
  );
}
