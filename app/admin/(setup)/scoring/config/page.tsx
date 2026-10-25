"use client";

import { useEffect, useState } from "react";
import BackendError from "@/components/BackendError";
import Hood from "@/components/Hood";
import PageHeader from "@/components/PageHeader";
import SavedNote from "@/components/SavedNote";
import TechnicalDetailsSwitch from "@/components/TechnicalDetailsSwitch";
import { configChanged, errorText, fetchJson, sendJson } from "@/lib/api";
import { plural } from "@/lib/format";
import { useHood } from "@/lib/hood";
import { AXIS_LABELS, Measure, OpenQuestionBadge, weightShare } from "@/lib/scoring";
import { PRIORITY } from "@/lib/theme";

type ConfigDoc = {
  _id: string;
  open_question: string | null;
  version: number;
  [key: string]: unknown;
};

const field =
  "mt-1 rounded border border-neutral-300 bg-white px-3 py-1.5 text-sm outline-none focus:border-neutral-500";

const TORA_AXES = ["market_potential", "strategic_fit", "adoption_readiness"] as const;

const TIMELINE_COLS = ["near", "mid", "far"] as const;
const POTENTIAL_ROWS = ["high", "mid", "low"] as const;

export default function ConfigPage() {
  const [docs, setDocs] = useState<ConfigDoc[] | null>(null);
  const [measures, setMeasures] = useState<Measure[] | null>(null);
  const [error, setError] = useState<unknown>(null);
  // the last save, shown in the section it was made in: which setting, and its error if it failed
  const [result, setResult] = useState<{ name: string; what: string; error: string | null } | null>(null);

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

  // `what`: what the save means, said beside it
  async function patch(name: string, changes: Record<string, unknown>, what = "Applies from the next assessment run.") {
    setResult(null);
    try {
      await sendJson(`/api/scoring/config/${name}`, "PUT", changes);
      setResult({ name, what, error: null });
      configChanged();
      load();
    } catch (e) {
      setResult({ name, what, error: errorText(e) });
    }
  }
  // what the last save in a section did, shown in that section
  const resultIn = (name: string) => result?.name === name && (
    <p className="mt-2">
      {result.error ? <span className="text-sm text-failed">Not saved: {result.error}</span>
        : <SavedNote show what={result.what} />}
    </p>
  );
  const settled = "The current values stand as the decision.";

  const grid = docs?.find((d) => d._id === "priority_grid");
  const evidence = docs?.find((d) => d._id === "evidence");
  const engineDoc = docs?.find((d) => d._id === "engine");
  const tora = docs?.find((d) => d._id === "tora");
  const byId = new Map((measures ?? []).map((m) => [m._id, m]));
  const measureName = (slug: string) => byId.get(slug)?.name ?? slug;

  return (
    <div className="space-y-7">
      <div>
        <PageHeader title="Weights and grid" right={<TechnicalDetailsSwitch />}
          intro="The arithmetic that turns the twelve scores into the three scores and a priority, with no model calls."
          help={<>
          <li>The three scores (Market potential, Strategic fit, Adoption readiness): each is the weighted average
            of its measures. Weights are edited on the Measures tab. Technical details adds the measures&apos;
            codes.</li>
          <li>Priority grid: how soon it arrives (Maturity and Commercial adoption) crossed with how big the prize is
            (Addressable market, Growth, Disruption threat, Serviceable capture). Darker cells are more urgent, from
            P1 act now to P6 just watch.</li>
          <li>The band edges split each 0–10 score into three bands: below 4, 4 to 7, and above 7 by default. Raise
            them and fewer technologies reach P1.</li>
          <li>Grid changes apply to new assessment runs, and Redo scores on a run&apos;s page applies them to its
            results, at no model cost.</li>
          <li>Technical details also shows the most evidence sent per technology (a safety limit) and how an
            assessment calls the model; switching that asks first, with its cost.</li>
          </>} />
      </div>

      {error != null && <BackendError error={error} />}

      <FlowStrip soon={((grid?.timeline_from as string[]) ?? []).map(measureName)}
        big={((grid?.potential_from as string[]) ?? []).map(measureName)} />

      {tora && measures && (
        <section className="rounded-card border border-line bg-white px-5 py-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">The three scores</h2>
            <OpenQuestionBadge question={tora.open_question} />
          </div>
          <p className="mt-1.5 text-sm text-neutral-600">
            Nine measures roll into the three scores as weighted
            averages; three more are scored but never averaged in.
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
              inGrid={(grid?.potential_from as string[]) ?? []}
            />
          </div>
          <p className="mt-4 border-t border-neutral-100 pt-3 text-sm text-neutral-600">
            A measure the evidence can&apos;t support is left out of its score, which is then marked partial; it&apos;s
            never counted as zero.
            <Hood><span className="mt-1 block font-mono text-xs text-neutral-500">{String(tora.unscorable_policy ?? "")}</span></Hood>
          </p>
          <OpenQuestionRow doc={tora} onClear={() => patch("tora", { open_question: null }, settled)} />
          {resultIn("tora")}
        </section>
      )}

      <div className="grid items-start gap-7 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
      {grid && (
        <section className="rounded-card border border-line bg-white px-5 py-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Priority grid (P1–P6)</h2>
            <OpenQuestionBadge question={grid.open_question} />
          </div>
          <p className="mt-1.5 text-sm text-neutral-600">
            <em>How soon</em> (from {(grid.timeline_from as string[])?.map(measureName).join(" + ")})
            crossed with <em>how big</em> (from{" "}
            {(grid.potential_from as string[])?.map(measureName).join(", ")}). The
            cut-points slice each 0–10 score into three bands; the cell gives the priority.
          </p>
          <PriorityGridTable grid={grid} />
          <OpenQuestionRow doc={grid} onClear={() => patch("priority_grid", { open_question: null }, settled)} />
          <GridCutpoints grid={grid} onSave={(changes) => patch("priority_grid", changes, "Applies to new assessment runs.")} />
          {resultIn("priority_grid")}
        </section>
      )}

      <Hood>
      {evidence && (
        <section className="rounded-card border border-line bg-white px-5 py-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Most evidence sent per technology</h2>
            <OpenQuestionBadge question={evidence.open_question} />
          </div>
          <p className="mt-1.5 text-sm text-neutral-600">
            A safety limit only: every page summary of a technology is sent, and the oldest are left out only when
            they&apos;d pass this many tokens.
            <Hood><span className="mt-1 block font-mono text-xs text-neutral-500">{String(evidence.note ?? "")}</span></Hood>
          </p>
          <OpenQuestionRow doc={evidence} onClear={() => patch("evidence", { open_question: null }, settled)} />
          <TokenCeiling value={Number(evidence.max_dossier_tokens)} onSave={(v) => patch("evidence", { max_dossier_tokens: v })} />
          {resultIn("evidence")}
        </section>
      )}

      {engineDoc && <EngineChoice mode={String(engineDoc.mode ?? "per_measure")} onSave={(mode) => patch("engine", { mode })}
        result={resultIn("engine")} />}
      </Hood>
      </div>
    </div>
  );
}

const ENGINES = [
  ["stacked", "Combined calls (recommended)", "One call per technology (which fabrics to assess, the measures judged for the technology as a whole, the metrics to watch), then one per fabric it touches. Its evidence is sent once and reused: about 1 call per technology, plus one per fabric.", "about 3"],
  ["per_measure", "One call per measure (older)", "One call per measure in each fabric, plus the fabric choice and the metrics to watch, each sending the full evidence: about 30 per technology.", "about 30"],
] as const;

/** How an assessment calls the model: picking the other way asks first, with its cost. */
function EngineChoice({ mode, onSave, result }: { mode: string; onSave: (mode: string) => void; result: React.ReactNode }) {
  const [ask, setAsk] = useState<(typeof ENGINES)[number] | null>(null);
  return (
    <section className="rounded-card border border-line bg-white px-5 py-4">
      <h2 className="font-semibold">How an assessment calls the model</h2>
      <div className="mt-2 grid gap-2 sm:grid-cols-2" role="radiogroup" aria-label="How an assessment calls the model">
        {ENGINES.map((e) => {
          const on = mode === e[0];
          return (
            <button key={e[0]} type="button" role="radio" aria-checked={on} onClick={() => setAsk(on ? null : e)}
              className={`rounded-lg border px-3.5 py-2.5 text-left ${on ? "border-navy bg-navy/[0.04]" : "border-line hover:bg-ground"}`}>
              <div className="flex items-center gap-2 text-sm font-medium">
                <span className={`h-3 w-3 rounded-full border ${on ? "border-navy bg-navy" : "border-neutral-400"}`} />{e[1]}
              </div>
              <p className="mt-1 text-xs text-neutral-600">{e[2]}</p>
            </button>
          );
        })}
      </div>
      {ask ? (
        <p className="mt-2 flex flex-wrap items-center gap-2 text-sm">
          Switch to {ask[1].replace(/ \(.*\)$/, "").toLowerCase()}? From the next assessment run, {ask[3]} model calls per technology.
          <button type="button" onClick={() => { onSave(ask[0]); setAsk(null); }}
            className="rounded-full bg-navy px-3 py-1 text-xs font-medium text-white">Switch</button>
          <button type="button" onClick={() => setAsk(null)} className="text-xs text-neutral-600 hover:text-black">Cancel</button>
        </p>
      ) : <p className="mt-2 text-xs text-neutral-500">Applies from the next assessment run; the estimate before a run uses it.</p>}
      {result}
    </section>
  );
}

function FlowBox({ title, body, accent = false }: { title: string; body: string; accent?: boolean }) {
  return (
    <div
      className={`flex-1 border px-4 py-3 ${
        accent ? "border-line bg-ground" : "border-neutral-200 bg-white"
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

function FlowStrip({ soon, big }: { soon: string[]; big: string[] }) {
  return (
    <section className="rounded-card border border-line bg-white px-5 py-4">
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
            title="2a · The three scores, the assessment"
            body="The Market, Strategic and Adoption measures are weighted-averaged into the three headline numbers: how big, how well it fits, how ready."
          />
          <FlowBox
            accent
            title="2b · Priority grid — the recommendation"
            body={`${soon.join(" and ") || "Some measures"} say how soon it arrives; ${big.join(", ") || "others"} say how big the prize is; the cell they land in says what to do (P1–P6).`}
          />
        </div>
        <FlowArrow />
        <FlowBox
          title="3 · Point of View"
          body="The Point of View shows both: the three scores as the verdict, the priority as the action, plus the capability gap as the caveat."
        />
      </div>
      <p className="mt-3 text-[13px] text-neutral-500">
        The same twelve scores feed both branches: the grid never reads the three
        scores, it goes back to the individual measures. So a weight (on the Measures
        tab) changes the three scores; a cut-point changes only the priority.
      </p>
    </section>
  );
}

function AxisColumn({ label, rows }: { label: string; rows: Measure[] }) {
  const hood = useHood();
  const total = rows.reduce((s, m) => s + (m.weight ?? 0), 0);
  return (
    <div className="border border-neutral-200 px-4 py-3.5">
      <div className="font-mono text-[11px] uppercase tracking-wider text-neutral-500">{label}</div>
      <div className="mt-2.5 space-y-2.5">
        {rows.map((m) => (
          <div key={m._id}>
            <div className="flex items-baseline justify-between gap-2 text-sm">
              <span className="min-w-0 truncate">
                {hood && <span className="font-mono text-xs text-neutral-500">{m.code} </span>}{m.name}
              </span>
              <span className="shrink-0 font-mono text-xs tabular-nums text-neutral-600">
                {weightShare(m.weight ?? 0, total)}
              </span>
            </div>
            <div className="mt-1 h-1 bg-neutral-100">
              <div className="h-1 bg-navy" style={{ width: `${total > 0 ? ((m.weight ?? 0) / total) * 100 : 0}%` }} />
            </div>
          </div>
        ))}
      </div>
      <Hood>
        <p className="mt-3 border-t border-neutral-100 pt-2 font-mono text-[11px] text-neutral-500">
          = {rows.map((m) => `${m.weight ?? 0}·${m.code}`).join(" + ")}
        </p>
      </Hood>
      {Math.abs(total - 1) > 1e-9 && (
        <p className="mt-1 text-[11px] text-neutral-600">The weights add up to {total.toFixed(2)}; scoring divides each by
          that, so the shares shown are the real ones.</p>
      )}
    </div>
  );
}

function ExtraColumn({ rows, inGrid }: { rows: Measure[]; inGrid: string[] }) {
  const hood = useHood();
  const grid = rows.filter((m) => inGrid.includes(m._id)).map((m) => m.name);
  const rest = rows.filter((m) => !inGrid.includes(m._id)).map((m) => m.name);
  return (
    <div className="border border-dashed border-neutral-300 bg-neutral-50 px-4 py-3.5">
      <div className="font-mono text-[11px] uppercase tracking-wider text-neutral-500">{AXIS_LABELS.extra}</div>
      <div className="mt-2.5 space-y-2 text-sm">
        {rows.map((m) => (
          <div key={m._id} className="text-neutral-600">
            {hood && <span className="font-mono text-xs text-neutral-500">{m.code} </span>}{m.name}
          </div>
        ))}
      </div>
      <p className="mt-3 border-t border-neutral-200 pt-2 text-[11px] leading-snug text-neutral-500">
        Not averaged in{grid.length > 0 && `: ${grid.join(" and ")} feed the priority grid`}
        {rest.length > 0 && `${grid.length ? "; " : ": "}${rest.join(" and ")} the Point of View`}.
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
              How big ↓ · How soon →
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
                return (
                  <td key={c} className={`h-14 w-28 text-center font-semibold ${PRIORITY[p] ?? "bg-neutral-100"}`}>
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
        className="ml-1 rounded-full border border-line bg-white px-2 py-0.5 text-xs hover:bg-neutral-100"
        title="Clear the open question: the current values stand as the decision"
      >
        Mark as settled (keep these values)
      </button>
    </p>
  );
}

function GridCutpoints({ grid, onSave }: { grid: ConfigDoc; onSave: (c: Record<string, unknown>) => void }) {
  const [t, setT] = useState((grid.timeline_cutpoints as number[]) ?? [4, 7]);
  const [p, setP] = useState((grid.potential_cutpoints as number[]) ?? [4, 7]);
  const bad = [t, p].some(([lo, hi]) => !(lo >= 0 && hi <= 10 && lo < hi));
  const edges = { timeline_cutpoints: t, potential_cutpoints: p };
  const [preview, setPreview] = useState<{ placed: number; moves: { from: string | null; to: string | null; count: number }[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const ask = () => {
    setError(null);
    sendJson<NonNullable<typeof preview>>("/api/scoring/edges/preview", "POST", edges)
      .then(setPreview).catch((e) => setError(`Couldn't work out what would move: ${errorText(e)}`));
  };
  const num = (v: number, set: (n: number) => void, label: string) => (
    <input type="number" min={0} max={10} step={0.5} value={v} aria-label={label}
      onChange={(e) => set(Number(e.target.value))} className={`${field} inline-block w-20`} />
  );
  const axis = (name: string, [lo, hi]: number[], set: (v: number[]) => void, words: [string, string, string]) => (
    <div className="text-sm">
      <div className="font-medium">{name}</div>
      <div className="mt-1 flex flex-wrap items-center gap-2 text-neutral-700">
        below {num(lo, (n) => set([n, hi]), `${name}: lower edge`)} is {words[0]}; above{" "}
        {num(hi, (n) => set([lo, n]), `${name}: upper edge`)} is {words[2]}; between is {words[1]}
      </div>
    </div>
  );
  return (
    <div className="mt-4 space-y-3 border-t border-neutral-100 pt-4">
      <p className="text-sm text-neutral-600">
        The band edges on the two 0–10 scores. Raise an upper edge and fewer technologies reach the top band, so fewer
        reach P1; lower a lower edge and fewer sink to P6.
      </p>
      {axis("How soon", t, setT, ["Far", "Mid", "Near"])}
      {axis("How big", p, setP, ["Low", "Mid", "High"])}
      {preview ? (
        <div role="group" aria-label="Save the edges?" className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
          <p>
            {preview.moves.length === 0
              ? `With these edges, none of the ${plural(preview.placed, "placed assessment")} changes priority.`
              : <>With these edges, on each technology&apos;s latest assessment in each fabric:{" "}
                {preview.moves.map((m) => `${m.count.toLocaleString()} move ${m.from ?? "no priority"} → ${m.to ?? "no priority"}`).join(", ")}
                {" "}(of {preview.placed.toLocaleString()} placed).</>}
            {" "}Worked out from their stored scores, no model calls. They move when an assessment run is redone or a new one runs.
          </p>
          <p className="mt-1.5 flex items-center gap-3">
            <button type="button" onClick={() => { setPreview(null); onSave(edges); }}
              className="rounded-full bg-navy px-3 py-1 text-white">Save the edges</button>
            <button type="button" onClick={() => setPreview(null)} className="text-muted hover:text-ink">Cancel</button>
          </p>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" disabled={bad} onClick={ask}
            className="rounded-full border border-line bg-white px-3 py-1.5 text-sm hover:bg-neutral-100 disabled:opacity-50">
            Save the edges
          </button>
          <span className="text-xs text-neutral-500">{bad ? "Each lower edge must be below its upper edge, within 0–10."
            : error ?? "Says first what would move. Applies to new assessment runs; a past run takes it with Redo scores on its page."}</span>
        </div>
      )}
    </div>
  );
}

function TokenCeiling({ value, onSave }: { value: number; onSave: (v: number) => void }) {
  // shown with thousands commas; the commas are dropped before saving
  const [v, setV] = useState(value.toLocaleString());
  const n = Number(v.replace(/[,\s]/g, ""));
  const valid = Number.isFinite(n) && n > 0;
  return (
    <div className="mt-3 flex flex-wrap items-end gap-4">
      <label className="text-sm">
        Limit, in tokens{valid && ` (about ${Math.round(n * 0.75).toLocaleString()} words)`}
        <input className={`${field} block w-36`} inputMode="numeric" value={v} onChange={(e) => setV(e.target.value)} />
      </label>
      <button onClick={() => onSave(n)} disabled={!valid}
        className="rounded-full border border-line bg-white px-3 py-1.5 text-sm hover:bg-neutral-100 disabled:opacity-50">
        Save the limit
      </button>
      {!valid && <span className="pb-2 text-xs text-failed">Enter a whole number of tokens, such as 500,000.</span>}
    </div>
  );
}
