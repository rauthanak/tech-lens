"use client";

import { useEffect, useState } from "react";
import BackendError from "@/components/BackendError";
import FabricLabel from "@/components/FabricLabel";
import PageHeader from "@/components/PageHeader";
import SavedNote from "@/components/SavedNote";
import { configChanged, errorText, fetchJson, sendJson } from "@/lib/api";
import { Fabric, OpenQuestionBadge } from "@/lib/scoring";
import { useValueLists } from "@/lib/value";

const field =
  "mt-1 w-full rounded border border-neutral-300 bg-white px-3 py-1.5 text-sm outline-none focus:border-neutral-500";

export default function FabricsPage() {
  const [fabrics, setFabrics] = useState<Fabric[] | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [selected, setSelected] = useState<Fabric | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const { mechanisms } = useValueLists(); // the names in Setup › Mechanisms

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
        levers: selected.levers ?? [],
        key_metrics: selected.key_metrics ?? "",
        bottlenecks: selected.bottlenecks ?? [],
        cautions: selected.cautions ?? "",
        finance_defaults: selected.finance_defaults ?? { margin_low: null, margin_high: null, loss_without: null, loss_with: null },
      });
      configChanged();
      setSaved(true);
      setSelected(null);
      load();
    } catch (e) {
      setSaveError(errorText(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <PageHeader title="Fabrics"
        intro={<>Tata Communications&apos; business areas, as its Digital Fabric names them. A technology is scored in
          each one judged relevant to it.</>}
        help={<>
        <li>A technology is scored separately in each fabric it touches; one model call picks which ones at the
          start of each assessment.</li>
        <li>The definition tells the models what the fabric covers, so editing it changes what counts.</li>
        <li>What Tata has today is what Tata Communications runs in the fabric (products, network assets, scale,
          customers and partners), taken from its website. The scorer uses it for the measures about Tata&apos;s own
          position, such as right to play, and cites the page it comes from.</li>
        <li>The dot shows whether a fabric is switched on: switched-off fabrics are left out of new assessments,
          and earlier results stay. &ldquo;Open question&rdquo; marks a question still waiting on Tata.</li>
        <li>Click a fabric to edit it. Saving costs no model calls and applies from the next assessment run.</li>
        <li>Each fabric&apos;s two levers come from Nick&apos;s value note.</li>
      </>} />
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
                  <span className="font-medium text-neutral-600">What Tata has today: </span>{f.tcl_today}
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
          <h2 className="text-lg font-semibold">Edit {selected.name}</h2>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div>
              <label className="block text-sm font-medium">Name</label>
              <input className={field} value={selected.name}
                onChange={(e) => setSelected({ ...selected, name: e.target.value })} required />
            </div>
            <div>
              <label className="block text-sm font-medium">Open question</label>
              <input className={field} value={selected.open_question ?? ""}
                placeholder="what still needs Tata's answer; clear it once settled"
                onChange={(e) => setSelected({ ...selected, open_question: e.target.value })} />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium">Definition: what the fabric covers</label>
            <textarea className={`${field} min-h-28`} value={selected.definition}
              onChange={(e) => setSelected({ ...selected, definition: e.target.value })} required />
          </div>
          <div>
            <label className="block text-sm font-medium">What Tata has today: what Tata Communications runs in it, with the pages it comes from</label>
            <textarea className={`${field} min-h-36`} value={selected.tcl_today ?? ""}
              onChange={(e) => setSelected({ ...selected, tcl_today: e.target.value })} />
          </div>
          <fieldset className="space-y-3 border-t border-neutral-100 pt-4">
            <legend className="text-sm font-semibold">Where the value lands</legend>
            <p className="text-xs text-neutral-500">The two levers the model writes for every use case: lever 1 about contribution, lever 2
              about delivery cost, each with the mechanism through which value reaches Tata (Setup › Mechanisms). Correct them
              as Tata confirms.</p>
            {(selected.levers ?? []).map((lv, i) => (
              <div key={lv.lever_id} className="grid grid-cols-1 items-center gap-2 lg:grid-cols-[4rem_10rem_14rem_minmax(0,1fr)]">
                <span className="text-xs font-medium text-neutral-600">Lever {i + 1}</span>
                <input className={field} value={lv.name} aria-label="Lever name"
                  onChange={(e) => setSelected({ ...selected, levers: (selected.levers ?? []).map((x, j) => j === i ? { ...x, name: e.target.value } : x) })} />
                <select className={field} value={lv.mechanism_id} aria-label="How value reaches Tata"
                  onChange={(e) => setSelected({ ...selected, levers: (selected.levers ?? []).map((x, j) => j === i ? { ...x, mechanism_id: e.target.value } : x) })}>
                  {Object.entries(mechanisms).map(([id, name]) => <option key={id} value={id}>{name}</option>)}
                  {!mechanisms[lv.mechanism_id] && <option value={lv.mechanism_id}>{lv.mechanism_id}</option>}
                </select>
                <input className={field} value={lv.text} aria-label="What the lever is"
                  onChange={(e) => setSelected({ ...selected, levers: (selected.levers ?? []).map((x, j) => j === i ? { ...x, text: e.target.value } : x) })} />
              </div>
            ))}
            <label className="block text-sm font-medium">Key metrics (sent to the model with the levers; shown beside them)
              <input className={field} value={selected.key_metrics ?? ""} onChange={(e) => setSelected({ ...selected, key_metrics: e.target.value })} />
            </label>
            <label className="block text-sm font-medium">What could stop it scaling (one per line; people pick from them for each technology)
              <textarea className={`${field} min-h-16`} value={(selected.bottlenecks ?? []).join("\n")}
                onChange={(e) => setSelected({ ...selected, bottlenecks: e.target.value.split("\n").map((x) => x.trim()).filter(Boolean) })} />
            </label>
            <label className="block text-sm font-medium">Cautions the model is told
              <input className={field} value={selected.cautions ?? ""} onChange={(e) => setSelected({ ...selected, cautions: e.target.value })} />
            </label>
          </fieldset>
          <fieldset className="space-y-3 border-t border-neutral-100 pt-4">
            <legend className="text-sm font-semibold">Finance defaults</legend>
            <p className="text-xs text-neutral-500">Used on the finance screen of every technology in this fabric unless one sets its own.
              Shares, from 0 to 100%; leave blank until Tata gives them. Loss rates apply where the revenue counts as protected
              (a lever that protects contribution): only the difference between them is counted.</p>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              {([["margin_low", "Margin, from %"], ["margin_high", "Margin, to %"], ["loss_without", "Loss rate without it %"],
                ["loss_with", "Loss rate with it %"]] as const).map(([k, label]) => (
                <label key={k} className="text-xs text-neutral-600">{label}
                  <input className={field} type="number" min={0} max={100}
                    value={selected.finance_defaults?.[k] != null ? Math.round((selected.finance_defaults[k] as number) * 100) : ""}
                    onChange={(e) => setSelected({ ...selected, finance_defaults: {
                      ...(selected.finance_defaults ?? { margin_low: null, margin_high: null, loss_without: null, loss_with: null }),
                      [k]: e.target.value === "" ? null : Number(e.target.value) / 100 } })} />
                </label>
              ))}
            </div>
          </fieldset>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={selected.enabled}
              onChange={(e) => setSelected({ ...selected, enabled: e.target.checked })} />
            Switched on: technologies are assessed in this fabric
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
