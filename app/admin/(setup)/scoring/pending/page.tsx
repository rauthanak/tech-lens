"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import BackendError from "@/components/BackendError";
import ConfirmAction from "@/components/ConfirmAction";
import PageHeader from "@/components/PageHeader";
import SavedNote from "@/components/SavedNote";
import { configChanged, errorText, fetchJson, sendJson } from "@/lib/api";
import { CONFIG_LABELS, Fabric, KIND_LABELS, Measure } from "@/lib/scoring";

type Pending = { kind: string; id: string; label: string; open_question: string | null };
type ConfigDoc = { _id: string; open_question: string | null; [key: string]: unknown };

const KIND_LINK: Record<string, string> = {
  fabric: "/admin/scoring/fabrics",
  measure: "/admin/scoring/measures",
  config: "/admin/scoring/config",
};

const field =
  "mt-1 w-full rounded border border-neutral-300 bg-white px-3 py-1.5 text-sm outline-none focus:border-neutral-500";

/** Set or clear (null) the open question on a fabric, measure or setting. */
async function saveQuestion(kind: string, id: string, question: string | null, fabrics: Fabric[], measures: Measure[]) {
  if (kind === "fabric") {
    const f = fabrics.find((x) => x._id === id)!;
    await sendJson(`/api/scoring/fabrics/${id}`, "PUT", {
      name: f.name, definition: f.definition, tcl_today: f.tcl_today, enabled: f.enabled, open_question: question });
  } else if (kind === "measure") {
    const m = measures.find((x) => x._id === id)!;
    await sendJson(`/api/scoring/measures/${id}`, "PUT", {
      name: m.name, axis: m.axis, weight: m.weight, definition: m.definition,
      anchors: m.anchors, required_evidence: m.required_evidence, open_question: question });
  } else {
    await sendJson(`/api/scoring/config/${id}`, "PUT", { open_question: question });
  }
  configChanged();
}

export default function PendingPage() {
  const [data, setData] = useState<{ pending: Pending[]; total_items: number } | null>(null);
  const [fabrics, setFabrics] = useState<Fabric[]>([]);
  const [measures, setMeasures] = useState<Measure[]>([]);
  const [config, setConfig] = useState<ConfigDoc[]>([]);
  const [error, setError] = useState<unknown>(null);

  const load = () =>
    Promise.all([
      fetchJson<{ pending: Pending[]; total_items: number }>("/api/scoring/overview"),
      fetchJson<{ fabrics: Fabric[] }>("/api/scoring/fabrics"),
      fetchJson<{ measures: Measure[] }>("/api/scoring/measures"),
      fetchJson<{ config: ConfigDoc[] }>("/api/scoring/config"),
    ])
      .then(([o, f, m, c]) => {
        setData(o);
        setFabrics(f.fabrics);
        setMeasures(m.measures);
        setConfig(c.config);
      })
      .catch(setError);

  useEffect(() => {
    load();
  }, []);

  return (
    <div>
      <PageHeader title="Open questions"
        intro="Setup decisions still waiting on Tata's answer."
        help={<>
        <li>Each row is a fabric, measure or setting with an open question; its name opens its tab. Mark settled
          when Tata has answered: it leaves the list, and the item keeps its values.</li>
        <li>Open questions don&apos;t change scoring: the next assessment run uses whatever is saved.</li>
        <li>Raise a question puts an item back on this list.</li>
      </>} />

      {error != null && <BackendError error={error} />}

      {data && (
        <>
          <p className="mt-4 text-sm text-neutral-600">
            {data.pending.length.toLocaleString()} of the {data.total_items.toLocaleString()} setup items still wait on
            Tata&apos;s answer.
          </p>
          <div className="mt-3 divide-y divide-neutral-100 overflow-hidden rounded-card border border-line bg-white">
            {data.pending.map((p) => (
              <div key={`${p.kind}-${p.id}`} className="flex flex-col gap-2 px-5 py-3 sm:flex-row sm:items-start">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-3">
                    <span className="bg-neutral-100 px-2 py-0.5 text-xs">{KIND_LABELS[p.kind] ?? p.kind}</span>
                    <Link href={KIND_LINK[p.kind] ?? "/admin/scoring"} className="font-medium hover:underline">
                      {p.kind === "config" ? CONFIG_LABELS[p.id] ?? p.label : p.label} →
                    </Link>
                  </div>
                  <p className="mt-1 text-sm text-neutral-600">{p.open_question}</p>
                </div>
                <ConfirmAction label="Mark settled" secondary confirmLabel="Settled"
                  question="Tata has answered this? It leaves the list; the item keeps the values it has now (change them on its tab if the answer needs it)."
                  onConfirm={async () => { await saveQuestion(p.kind, p.id, null, fabrics, measures); await load(); }} />
              </div>
            ))}
            {data.pending.length === 0 && (
              <p className="px-5 py-6 text-sm text-neutral-500">
                No open questions — every decision is settled.
              </p>
            )}
          </div>

          <RaiseQuestion
            fabrics={fabrics}
            measures={measures}
            config={config}
            onAdded={load}
          />
        </>
      )}
    </div>
  );
}

function RaiseQuestion({
  fabrics,
  measures,
  config,
  onAdded,
}: {
  fabrics: Fabric[];
  measures: Measure[];
  config: ConfigDoc[];
  onAdded: () => void;
}) {
  const [target, setTarget] = useState("");
  const [question, setQuestion] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  // Only items not already on the list — an existing question is edited on its
  // own tab, not overwritten from here.
  const open = (q: string | null | undefined) => Boolean(q?.trim());
  const options = [
    ...fabrics.filter((f) => !open(f.open_question)).map((f) => ({
      value: `fabric:${f._id}`, group: "Fabrics", label: f.name,
    })),
    ...measures.filter((m) => !open(m.open_question)).map((m) => ({
      value: `measure:${m._id}`, group: "Measures", label: m.name,
    })),
    ...config.filter((c) => !open(c.open_question)).map((c) => ({
      value: `config:${c._id}`, group: "Weights & grid", label: CONFIG_LABELS[c._id] ?? c._id.replace(/_/g, " "),
    })),
  ];
  const groups = ["Fabrics", "Measures", "Weights & grid"];

  async function submit() {
    const [kind, id] = target.split(":");
    if (!kind || !id || !question.trim()) return;
    setSaving(true);
    setSaveError(null);
    setSaved(false);
    try {
      await saveQuestion(kind, id, question.trim(), fabrics, measures);
      setSaved(true);
      setTarget("");
      setQuestion("");
      onAdded();
    } catch (e) {
      setSaveError(errorText(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form
      className="mt-6 rounded-card border border-line bg-white px-5 py-4"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <h2 className="font-semibold">Raise a question</h2>
      <p className="mt-1 text-sm text-neutral-600">
        Add a question for Tata about a fabric, measure or setting. It stays here until someone clears it on that
        item&apos;s tab.
      </p>
      <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label className="text-sm font-medium">
          About
          <select className={field} value={target} onChange={(e) => setTarget(e.target.value)} required>
            <option value="" disabled>choose an item…</option>
            {groups.map((g) => (
              <optgroup key={g} label={g}>
                {options.filter((o) => o.group === g).map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </optgroup>
            ))}
          </select>
        </label>
        <label className="text-sm font-medium sm:col-span-2">
          Question for Tata
          <textarea className={`${field} min-h-16`} value={question}
            placeholder="what needs their answer before this item counts as settled"
            onChange={(e) => setQuestion(e.target.value)} required />
        </label>
      </div>
      {saveError && <p className="mt-2 text-sm text-failed">Save failed: {saveError}</p>}
      <div className="mt-2"><SavedNote show={saved} what="It's on the list above; scoring doesn't change." /></div>
      <button type="submit" disabled={saving || !target || !question.trim()}
        className="mt-3 rounded-full bg-navy px-4 py-2 text-sm font-medium text-white hover:bg-navy-strong disabled:opacity-50">
        {saving ? "Adding…" : "Add the question"}
      </button>
    </form>
  );
}
