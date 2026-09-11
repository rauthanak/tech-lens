"use client";

import { useEffect, useState } from "react";
import BackendError from "@/components/BackendError";
import { ApiError, fetchJson, sendJson } from "@/lib/api";
import { AXIS_LABELS, Measure, OpenQuestionBadge } from "@/lib/scoring";

type ConfigDoc = {
  _id: string;
  open_question: string | null;
  version: number;
  [key: string]: unknown;
};

const field =
  "mt-1 rounded border border-neutral-300 bg-white px-3 py-1.5 text-sm outline-none focus:border-neutral-500";

const TORA_AXES = ["market_potential", "strategic_fit", "adoption_readiness"] as const;

// Sequential single-hue ramp: dark = urgent. Text flips to white on the dark end.
const PRIORITY_STYLE: Record<string, { bg: string; ink: string }> = {
  P1: { bg: "#8a4b2d", ink: "#ffffff" },
  P2: { bg: "#a97253", ink: "#ffffff" },
  P3: { bg: "#c49579", ink: "#171513" },
  P4: { bg: "#dcb9a2", ink: "#171513" },
  P5: { bg: "#eed8c8", ink: "#171513" },
  P6: { bg: "#f8efe7", ink: "#171513" },
};

const TIMELINE_COLS = ["near", "mid", "far"] as const;
const POTENTIAL_ROWS = ["high", "mid", "low"] as const;

export default function ConfigPage() {
  const [docs, setDocs] = useState<ConfigDoc[] | null>(null);
  const [measures, setMeasures] = useState<Measure[] | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = () =>
    Promise.all([
      fetchJson<{ config: ConfigDoc[] }>("/api/scoring/config"),
      fetchJson<{ measures: Measure[] }>("/api/scoring/measures"),
    ])
      .then(([c, m]) => {
        setDocs(c.config);
        setMeasures(m.measures);
      })
      .catch(setError);

  useEffect(() => {
    load();
  }, []);

  async function patch(name: string, changes: Record<string, unknown>) {
    setNotice(null);
    try {
      await sendJson(`/api/scoring/config/${name}`, "PUT", changes);
      setNotice(`${name} saved`);
      load();
    } catch (e) {
      setNotice(`save failed: ${e instanceof ApiError ? (e.detail ?? e.message) : e}`);
    }
  }

  const grid = docs?.find((d) => d._id === "priority_grid");
  const evidence = docs?.find((d) => d._id === "evidence");
  const tora = docs?.find((d) => d._id === "tora");
  const byId = new Map((measures ?? []).map((m) => [m._id, m]));
  const measureName = (slug: string) => byId.get(slug)?.name ?? slug;

  return (
    <div className="space-y-7">
      <p className="text-sm text-neutral-600">
        The deterministic math on top of the twelve scores. Changing anything here
        only requires a <em>recompute</em> of existing scores — no re-scoring, no
        LLM calls. Per-measure weights are edited on the Measures tab.
      </p>

      {error != null && <BackendError error={error} />}
      {notice && <p className="font-mono text-xs text-[#7a3c1e]">{notice}</p>}

      <FlowStrip />

      {tora && measures && (
        <section className="border border-neutral-200 bg-white px-5 py-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">TORA roll-up</h2>
            <OpenQuestionBadge question={tora.open_question} />
          </div>
          <p className="mt-1.5 text-sm text-neutral-600">
            Nine measures roll into the three TORA numbers as weighted
            averages; three are scored alongside and never averaged in.
          </p>
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {TORA_AXES.map((axis) => (
              <AxisColumn
                key={axis}
                label={AXIS_LABELS[axis]}
                rows={measures.filter((m) => m.axis === axis).sort((a, b) => a.code.localeCompare(b.code))}
              />
            ))}
            <ExtraColumn
              rows={measures.filter((m) => m.axis === "extra").sort((a, b) => a.code.localeCompare(b.code))}
            />
          </div>
          <p className="mt-4 border-t border-neutral-100 pt-3 text-sm text-neutral-600">
            {String(tora.unscorable_policy ?? "")}
          </p>
          <OpenQuestionRow doc={tora} onClear={() => patch("tora", { open_question: null })} />
        </section>
      )}

      <div className="grid items-start gap-7 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
      {grid && (
        <section className="border border-neutral-200 bg-white px-5 py-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Priority grid (P1–P6)</h2>
            <OpenQuestionBadge question={grid.open_question} />
          </div>
          <p className="mt-1.5 text-sm text-neutral-600">
            <em>How soon</em> (from {(grid.timeline_from as string[])?.map(measureName).join(" + ")})
            crossed with <em>how big</em> (from{" "}
            {(grid.potential_from as string[])?.map(measureName).join(", ")}). The
            cut-points slice each 0–10 score into three bands; the cell is the
            recommended posture. Both grid views — Impact Potential and
            Disruptiveness — are always produced.
          </p>
          <PriorityGridTable grid={grid} />
          <OpenQuestionRow doc={grid} onClear={() => patch("priority_grid", { open_question: null })} />
          <GridCutpoints grid={grid} onSave={(changes) => patch("priority_grid", changes)} />
        </section>
      )}

      {evidence && (
        <section className="border border-neutral-200 bg-white px-5 py-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Evidence dossier ceiling</h2>
            <OpenQuestionBadge question={evidence.open_question} />
          </div>
          <p className="mt-1.5 text-sm text-neutral-600">{String(evidence.note ?? "")}</p>
          <OpenQuestionRow doc={evidence} onClear={() => patch("evidence", { open_question: null })} />
          <TokenCeiling value={Number(evidence.max_dossier_tokens)} onSave={(v) => patch("evidence", { max_dossier_tokens: v })} />
        </section>
      )}
      </div>
    </div>
  );
}

function FlowBox({ title, body, accent = false }: { title: string; body: string; accent?: boolean }) {
  return (
    <div
      className={`flex-1 border px-4 py-3 ${
        accent ? "border-[#d9b8a3] bg-[#faf5f0]" : "border-neutral-200 bg-white"
      }`}
    >
      <div className="font-mono text-[11px] uppercase tracking-wider text-neutral-500">{title}</div>
      <p className="mt-1 text-sm text-neutral-700">{body}</p>
    </div>
  );
}

function FlowArrow() {
  return (
    <div className="self-center font-mono text-neutral-400">
      <span className="hidden lg:inline">→</span>
      <span className="lg:hidden">↓</span>
    </div>
  );
}

function FlowStrip() {
  return (
    <section className="border border-neutral-200 bg-white px-5 py-4">
      <h2 className="font-semibold">How it fits together</h2>
      <div className="mt-3 flex flex-col gap-2 lg:flex-row lg:items-stretch">
        <FlowBox
          title="1 · Twelve scores"
          body="Every technology × fabric is scored 0–10 on the twelve measures, each score backed by the collected evidence."
        />
        <FlowArrow />
        <div className="flex flex-1 flex-col gap-2">
          <FlowBox
            accent
            title="2a · TORA — the assessment"
            body="M, S and A scores are weighted-averaged into the three headline numbers: how big, how well it fits, how ready."
          />
          <FlowBox
            accent
            title="2b · Priority grid — the recommendation"
            body="A1 + A2 say how soon it arrives; M1, M2, X1, X2 say how big the prize is; the cell they land in says what to do (P1–P6)."
          />
        </div>
        <FlowArrow />
        <FlowBox
          title="3 · Point of View"
          body="The PoV shows both: the three TORA numbers as the verdict, the priority as the action, plus X3 (capability gap) as the caveat."
        />
      </div>
      <p className="mt-3 text-[13px] text-neutral-500">
        The same twelve scores feed both branches — the grid never reads the TORA
        numbers, it goes back to the individual measures. So editing a weight below
        changes TORA; editing a cut-point changes only the priority.
      </p>
    </section>
  );
}

function AxisColumn({ label, rows }: { label: string; rows: Measure[] }) {
  const total = rows.reduce((s, m) => s + (m.weight ?? 0), 0);
  return (
    <div className="border border-neutral-200 px-4 py-3.5">
      <div className="font-mono text-[11px] uppercase tracking-wider text-neutral-500">{label}</div>
      <div className="mt-2.5 space-y-2.5">
        {rows.map((m) => (
          <div key={m._id}>
            <div className="flex items-baseline justify-between gap-2 text-sm">
              <span className="min-w-0 truncate">
                <span className="font-mono text-xs text-neutral-500">{m.code}</span> {m.name}
              </span>
              <span className="shrink-0 font-mono text-xs tabular-nums text-neutral-600">
                × {m.weight ?? 0}
              </span>
            </div>
            <div className="mt-1 h-1 bg-neutral-100">
              <div className="h-1 bg-[#8a4b2d]" style={{ width: `${(m.weight ?? 0) * 100}%` }} />
            </div>
          </div>
        ))}
      </div>
      <p className="mt-3 border-t border-neutral-100 pt-2 font-mono text-[11px] text-neutral-500">
        = {rows.map((m) => `${m.weight ?? 0}·${m.code}`).join(" + ")}
      </p>
      {Math.abs(total - 1) > 1e-9 && (
        <p className="mt-1 font-mono text-[11px] text-amber-700">weights sum to {total.toFixed(2)} — should be 1.0</p>
      )}
    </div>
  );
}

function ExtraColumn({ rows }: { rows: Measure[] }) {
  return (
    <div className="border border-dashed border-neutral-300 bg-neutral-50 px-4 py-3.5">
      <div className="font-mono text-[11px] uppercase tracking-wider text-neutral-500">Outside TORA</div>
      <div className="mt-2.5 space-y-2 text-sm">
        {rows.map((m) => (
          <div key={m._id} className="text-neutral-600">
            <span className="font-mono text-xs text-neutral-500">{m.code}</span> {m.name}
          </div>
        ))}
      </div>
      <p className="mt-3 border-t border-neutral-200 pt-2 text-[11px] leading-snug text-neutral-500">
        Not rolled up — feed the priority grid and the PoV directly.
      </p>
    </div>
  );
}

function PriorityGridTable({ grid }: { grid: ConfigDoc }) {
  const [tLo, tHi] = (grid.timeline_cutpoints as number[]) ?? [4, 7];
  const [pLo, pHi] = (grid.potential_cutpoints as number[]) ?? [4, 7];
  const cells = grid.grid as Record<string, string>;
  const colLabel: Record<string, string> = {
    near: `Near · > ${tHi}`,
    mid: `Mid · ${tLo}–${tHi}`,
    far: `Far · < ${tLo}`,
  };
  const rowLabel: Record<string, string> = {
    high: `High · > ${pHi}`,
    mid: `Mid · ${pLo}–${pHi}`,
    low: `Low · < ${pLo}`,
  };
  return (
    <div className="mt-4 overflow-x-auto">
      <table className="border-separate" style={{ borderSpacing: 2 }}>
        <thead>
          <tr>
            <th className="pr-2 text-right align-bottom font-mono text-[11px] font-normal uppercase tracking-wider text-neutral-500">
              how big ↓
            </th>
            {TIMELINE_COLS.map((c) => (
              <th key={c} className="pb-1 font-mono text-[11px] font-normal uppercase tracking-wider text-neutral-500">
                {colLabel[c]}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {POTENTIAL_ROWS.map((r) => (
            <tr key={r}>
              <td className="pr-2 text-right font-mono text-[11px] uppercase tracking-wider text-neutral-500">
                {rowLabel[r]}
              </td>
              {TIMELINE_COLS.map((c) => {
                const p = cells[`${c}_${r}`];
                const style = PRIORITY_STYLE[p] ?? { bg: "#f5f5f4", ink: "#171513" };
                return (
                  <td
                    key={c}
                    className="h-14 w-28 text-center font-semibold"
                    style={{ background: style.bg, color: style.ink }}
                  >
                    {p}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-2 font-mono text-[11px] text-neutral-500">
        P1 act now · P6 just watch — darker is more urgent
      </p>
    </div>
  );
}

function OpenQuestionRow({ doc, onClear }: { doc: ConfigDoc; onClear: () => void }) {
  if (!doc.open_question?.trim()) return null;
  return (
    <p className="mt-3 text-sm text-neutral-500">
      Open: {doc.open_question}{" "}
      <button
        onClick={onClear}
        className="ml-1 border border-neutral-300 px-2 py-0.5 text-xs hover:bg-neutral-100"
        title="Clear the open question — the current values stand as the decision"
      >
        mark settled
      </button>
    </p>
  );
}

function GridCutpoints({ grid, onSave }: { grid: ConfigDoc; onSave: (c: Record<string, unknown>) => void }) {
  const [timeline, setTimeline] = useState((grid.timeline_cutpoints as number[]).join(", "));
  const [potential, setPotential] = useState((grid.potential_cutpoints as number[]).join(", "));
  const [tLo, tHi] = (grid.timeline_cutpoints as number[]) ?? [4, 7];
  return (
    <div className="mt-4 border-t border-neutral-100 pt-4">
      <p className="text-sm text-neutral-600">
        The cut-points are the band edges on those two 0–10 scores — where one
        band ends and the next begins. &ldquo;{tLo}, {tHi}&rdquo; reads: below {tLo} is
        Far (or Low), {tLo}–{tHi} is Mid, above {tHi} is Near (or High). Raise the
        second number and the top band shrinks — fewer technologies qualify as
        imminent or big, so fewer reach P1. Lower the first and fewer sink to P6.
      </p>
      <div className="mt-3 flex flex-wrap items-end gap-4">
        <label className="text-sm">
          Timeline cut-points
          <input className={`${field} block w-36`} value={timeline} onChange={(e) => setTimeline(e.target.value)} />
        </label>
        <label className="text-sm">
          Potential cut-points
          <input className={`${field} block w-36`} value={potential} onChange={(e) => setPotential(e.target.value)} />
        </label>
        <button
          onClick={() =>
            onSave({
              timeline_cutpoints: timeline.split(",").map((s) => Number(s.trim())),
              potential_cutpoints: potential.split(",").map((s) => Number(s.trim())),
            })
          }
          className="border border-neutral-300 px-3 py-1.5 text-sm hover:bg-neutral-100"
        >
          Save cut-points
        </button>
        <span className="pb-2 text-xs text-neutral-500">saving redraws the band edges above</span>
      </div>
    </div>
  );
}

function TokenCeiling({ value, onSave }: { value: number; onSave: (v: number) => void }) {
  const [v, setV] = useState(String(value));
  return (
    <div className="mt-3 flex items-end gap-4">
      <label className="text-sm">
        Max dossier tokens
        <input className={`${field} block w-36`} type="number" value={v} onChange={(e) => setV(e.target.value)} />
      </label>
      <button onClick={() => onSave(Number(v))} className="border border-neutral-300 px-3 py-1.5 text-sm hover:bg-neutral-100">
        Save
      </button>
    </div>
  );
}
