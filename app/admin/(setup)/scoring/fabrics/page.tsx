"use client";

import { useEffect, useState } from "react";
import BackendError from "@/components/BackendError";
import FabricLabel from "@/components/FabricLabel";
import PageHelp from "@/components/PageHelp";
import SavedNote from "@/components/SavedNote";
import { ApiError, configChanged, fetchJson, sendJson } from "@/lib/api";
import { Fabric, OpenQuestionBadge } from "@/lib/scoring";

const field =
  "mt-1 w-full rounded border border-neutral-300 bg-white px-3 py-1.5 text-sm outline-none focus:border-neutral-500";

export default function FabricsPage() {
  const [fabrics, setFabrics] = useState<Fabric[] | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [selected, setSelected] = useState<Fabric | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
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
    setSaved(false);
    try {
      await sendJson(`/api/scoring/fabrics/${selected._id}`, "PUT", {
        name: selected.name,
        definition: selected.definition,
        tcl_today: selected.tcl_today || null,
        enabled: selected.enabled,
        open_question: selected.open_question || null,
      });
      configChanged();
      setSaved(true);
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
      <p className="max-w-4xl text-sm text-neutral-600">
        Tata Communications&apos; business areas, as its Digital Fabric names them. A technology is scored in each
        one judged relevant to it.
      </p>
      <PageHelp>
        <li>A technology is scored separately in each fabric it touches; one model call picks which ones at the
          start of each assessment.</li>
        <li>The definition tells the models what the fabric covers, so editing it changes what counts.</li>
        <li>TCL today is what Tata Communications runs in the fabric (products, network assets, scale, customers and
          partners), taken from its website. The scorer uses it for the measures about TCL&apos;s own position, such as
          right to play, and cites the page it comes from.</li>
        <li>The dot shows whether a fabric is switched on: switched-off fabrics are left out of new assessments,
          and earlier results stay. &ldquo;? open&rdquo; marks a question still waiting on the client.</li>
        <li>Click a fabric to edit it. Saving costs no model calls and applies from the next assessment run.</li>
      </PageHelp>
      <div className="mt-2"><SavedNote show={saved} /></div>

      {error != null && <BackendError error={error} />}

      {fabrics && (
        <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 2xl:grid-cols-3">
          {fabrics.map((f) => (
            <button
              key={f._id}
              onClick={() => {
                setSelected({ ...f });
                setSaveError(null);
              }}
              className={`flex flex-col rounded-card border border-line bg-white px-5 py-4 text-left hover:border-neutral-400 ${
                selected?._id === f._id ? "ring-2 ring-azure" : ""
              }`}
            >
              <div className="flex items-center justify-between gap-3">
                <FabricLabel id={f._id} name={f.name} />
                <span className="flex items-center gap-2">
                  <OpenQuestionBadge question={f.open_question} />
                  <span
                    className={`inline-block h-2 w-2 rounded-full ${f.enabled ? "bg-azure" : "bg-neutral-300"}`}
                  />
                </span>
              </div>
              <p className="mt-1.5 text-sm text-neutral-600">{f.definition}</p>
              {f.tcl_today && (
                <p className="mt-2 line-clamp-2 text-xs text-neutral-500">
                  <span className="font-medium text-neutral-600">TCL today: </span>{f.tcl_today}
                </p>
              )}
            </button>
          ))}
        </div>
      )}

      {selected && (
        <form
          className="mt-7 space-y-4 rounded-card border border-line bg-white px-6 py-5"
          onSubmit={(e) => {
            e.preventDefault();
            save();
          }}
        >
          <div className="flex items-baseline justify-between">
            <h2 className="text-lg font-semibold">Edit {selected.name}</h2>
            <span className="font-mono text-xs text-neutral-500">v{selected.version}</span>
          </div>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div>
              <label className="block text-sm font-medium">Name</label>
              <input className={field} value={selected.name}
                onChange={(e) => setSelected({ ...selected, name: e.target.value })} required />
            </div>
            <div>
              <label className="block text-sm font-medium">Open question</label>
              <input className={field} value={selected.open_question ?? ""}
                placeholder="what still needs the client's answer — blank it once settled"
                onChange={(e) => setSelected({ ...selected, open_question: e.target.value })} />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium">Definition: what the fabric covers</label>
            <textarea className={`${field} min-h-28`} value={selected.definition}
              onChange={(e) => setSelected({ ...selected, definition: e.target.value })} required />
          </div>
          <div>
            <label className="block text-sm font-medium">TCL today: what Tata Communications runs in it, with the pages it comes from</label>
            <textarea className={`${field} min-h-36`} value={selected.tcl_today ?? ""}
              onChange={(e) => setSelected({ ...selected, tcl_today: e.target.value })} />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={selected.enabled}
              onChange={(e) => setSelected({ ...selected, enabled: e.target.checked })} />
            Enabled — technologies are assessed in this fabric
          </label>
          {saveError && <p className="text-sm text-failed">Save failed: {saveError}</p>}
          <div className="flex items-center gap-3">
            <button type="submit" disabled={saving}
              className="rounded-full bg-navy px-4 py-2 text-sm font-medium text-white hover:bg-navy-strong disabled:opacity-50">
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
