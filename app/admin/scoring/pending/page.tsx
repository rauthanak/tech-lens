"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import BackendError from "@/components/BackendError";
import { ApiError, fetchJson, sendJson } from "@/lib/api";
import { Fabric, Measure } from "@/lib/scoring";

type Pending = { kind: string; id: string; label: string; open_question: string | null };
type ConfigDoc = { _id: string; open_question: string | null; [key: string]: unknown };

const KIND_LINK: Record<string, string> = {
  fabric: "/admin/scoring/fabrics",
  measure: "/admin/scoring/measures",
  config: "/admin/scoring/config",
};

const field =
  "mt-1 w-full rounded border border-neutral-300 bg-white px-3 py-1.5 text-sm outline-none focus:border-neutral-500";

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
    <div className="max-w-3xl">
      <p className="text-sm text-neutral-600">
        Every open question still awaiting the client&apos;s answer. When a
        decision arrives, edit the item and blank its question — the next
        scoring run uses whatever is saved, no code change.
      </p>

      {error != null && <BackendError error={error} />}

      {data && (
        <>
          <p className="mt-4 font-mono text-xs text-neutral-500">
            {data.pending.length} open across {data.total_items} items
          </p>
          <div className="mt-3 divide-y divide-neutral-100 border border-neutral-200 bg-white">
            {data.pending.map((p) => (
              <Link
                key={`${p.kind}-${p.id}`}
                href={KIND_LINK[p.kind] ?? "/admin/scoring"}
                className="block px-5 py-3 hover:bg-neutral-50"
              >
                <div className="flex items-center gap-3">
                  <span className="bg-amber-100 px-2 py-0.5 font-mono text-[11px] uppercase text-amber-900">
                    {p.kind}
                  </span>
                  <span className="font-medium">{p.label}</span>
                </div>
                <p className="mt-1 text-sm text-neutral-600">{p.open_question}</p>
              </Link>
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

  // Only items not already on the list — an existing question is edited on its
  // own tab, not overwritten from here.
  const open = (q: string | null | undefined) => Boolean(q?.trim());
  const options = [
    ...fabrics.filter((f) => !open(f.open_question)).map((f) => ({
      value: `fabric:${f._id}`, group: "Fabrics", label: f.name,
    })),
    ...measures.filter((m) => !open(m.open_question)).map((m) => ({
      value: `measure:${m._id}`, group: "Measures", label: `${m.code} — ${m.name}`,
    })),
    ...config.filter((c) => !open(c.open_question)).map((c) => ({
      value: `config:${c._id}`, group: "Weights & grid", label: c._id.replace(/_/g, " "),
    })),
  ];
  const groups = ["Fabrics", "Measures", "Weights & grid"];

  async function submit() {
    const [kind, id] = target.split(":");
    if (!kind || !id || !question.trim()) return;
    setSaving(true);
    setSaveError(null);
    try {
      if (kind === "fabric") {
        const f = fabrics.find((x) => x._id === id)!;
        await sendJson(`/api/scoring/fabrics/${id}`, "PUT", {
          name: f.name, definition: f.definition, enabled: f.enabled,
          open_question: question.trim(),
        });
      } else if (kind === "measure") {
        const m = measures.find((x) => x._id === id)!;
        await sendJson(`/api/scoring/measures/${id}`, "PUT", {
          name: m.name, axis: m.axis, weight: m.weight, definition: m.definition,
          anchors: m.anchors, required_evidence: m.required_evidence,
          open_question: question.trim(),
        });
      } else {
        await sendJson(`/api/scoring/config/${id}`, "PUT", { open_question: question.trim() });
      }
      setTarget("");
      setQuestion("");
      onAdded();
    } catch (e) {
      setSaveError(e instanceof ApiError ? (e.detail ?? e.message) : "save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form
      className="mt-6 border border-neutral-200 bg-white px-5 py-4"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <h2 className="font-semibold">Raise a question</h2>
      <p className="mt-1 text-sm text-neutral-600">
        Put an item back on this list — pick what the question is about and it
        stays pending until the question is blanked.
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
          Question for the client
          <textarea className={`${field} min-h-16`} value={question}
            placeholder="what needs their answer before this item counts as settled"
            onChange={(e) => setQuestion(e.target.value)} required />
        </label>
      </div>
      {saveError && <p className="mt-2 text-sm text-[#7a3c1e]">Save failed: {saveError}</p>}
      <button type="submit" disabled={saving || !target || !question.trim()}
        className="mt-3 bg-[#171513] px-4 py-2 text-sm font-medium text-white hover:bg-black disabled:opacity-50">
        {saving ? "Adding…" : "Add to pending"}
      </button>
    </form>
  );
}
