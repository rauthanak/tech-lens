"use client";

import { useCallback, useEffect, useState } from "react";
import BackendError from "@/components/BackendError";
import PageHeader from "@/components/PageHeader";
import { ApiError, configChanged, fetchJson, sendJson } from "@/lib/api";
import { formatTime } from "@/lib/format";

type FieldDiff = { field: string; seeding_value: unknown; live_value: unknown };
type Change = {
  collection: string;
  id: string;
  label: string;
  kind: "added" | "edited" | "deleted";
  updated_at: string | null;
  fields: FieldDiff[];
};
type ChangesResponse = { count: number; loaded_at: string | null; items: Change[] };

const LIST_LABELS: Record<string, string> = {
  sources: "Source",
  prompts: "Skill",
  signals: "Signal",
  settings: "Setting",
  fabrics: "Fabric",
  measures: "Measure",
  scoring_config: "Scoring method",
};

const key = (c: Change) => `${c.collection}:${c.id}`;

function show(value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "string") return value;
  return JSON.stringify(value, null, 2);
}

/** Edits apply the moment they're saved. This page only decides which of
 * them go into the seeding data — the configuration the next deployment
 * ships with. */
export default function ChangesPage() {
  const [data, setData] = useState<ChangesResponse | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [ticked, setTicked] = useState<Set<string>>(new Set());
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);

  const load = useCallback(() => {
    fetchJson<ChangesResponse>("/api/changes")
      .then((d) => {
        setData(d);
        setError(null);
        setTicked((prev) => new Set([...prev].filter((k) => d.items.some((c) => key(c) === k))));
      })
      .catch(setError);
  }, []);

  useEffect(() => { load(); }, [load]);

  const toggle = (k: string) =>
    setTicked((prev) => {
      const next = new Set(prev);
      if (next.has(k)) next.delete(k);
      else next.add(k);
      return next;
    });

  async function update() {
    if (!data) return;
    setBusy(true);
    setConfirming(false);
    setResult(null);
    const items = data.items.filter((c) => ticked.has(key(c))).map((c) => ({ collection: c.collection, id: c.id }));
    try {
      const r = await sendJson<{ written: number; files: string[] }>("/api/changes/update-seeding-data", "POST", { items });
      setResult({
        ok: true,
        text: r.files.length
          ? `Updated ${r.files.join(", ")}. Push with git to share it.`
          : "Nothing to write — those edits already match the seeding data.",
      });
      setTicked(new Set());
    } catch (e) {
      setResult({ ok: false, text: e instanceof ApiError ? (e.detail ?? e.message) : "the update failed" });
    } finally {
      setBusy(false);
      configChanged();
      load();
    }
  }

  const all = data ? data.items.map(key) : [];
  const allTicked = all.length > 0 && all.every((k) => ticked.has(k));

  return (
    <div>
      <PageHeader title="Changes"
        intro="Setup edits not yet in the seeding data: the configuration a new deployment starts from."
        help={<>
          <li>Every edit applies the moment it&apos;s saved. This page only decides which edits are written into the
            seeding data, the files in the code.</li>
          <li>Each card shows what changed: the old value struck through and the new one in bold. &ldquo;+
            added&rdquo; and &ldquo;deleted&rdquo; mark whole items.</li>
          <li>Tick the edits to keep and click Update seeding data. Only the seed files change; push them with git
            to share them. No model calls.</li>
          <li>A deployment that loads new seeding data replaces any edit that wasn&apos;t written into it.</li>
        </>} />

      {error != null && <BackendError error={error} />}

      {data && (
        <>
          <p className="mt-5 border-l-2 border-neutral-300 pl-3 text-xs text-neutral-600">
            Seeding data loaded {formatTime(data.loaded_at)}. A deployment that loads new seeding data
            replaces edits that weren&apos;t written into it.
          </p>

          {result && (
            <p className={`mt-4 rounded-card border px-4 py-2 text-sm ${result.ok ? "border-line bg-white" : "border-failed/40 bg-failed/5 text-failed"}`}>
              {result.text}
            </p>
          )}

          {data.items.length === 0 ? (
            <p className="mt-6 text-sm text-neutral-500">
              No edits since the seeding data was loaded. The live configuration matches it.
            </p>
          ) : (
            <>
              <div className="mt-6 flex flex-wrap items-center gap-3">
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={allTicked}
                    onChange={() => setTicked(allTicked ? new Set() : new Set(all))} />
                  Select all
                </label>
                {confirming ? (
                  <span className="flex items-center gap-2 text-sm">
                    Write {ticked.size} edit{ticked.size === 1 ? "" : "s"} into the seeding data? The next
                    deployment will use them.
                    <button onClick={update} disabled={busy}
                      className="rounded-full bg-navy px-3 py-1.5 text-sm font-medium text-white hover:bg-navy-strong">Write</button>
                    <button onClick={() => setConfirming(false)}
                      className="rounded-full border border-line bg-white px-3 py-1.5 text-sm hover:bg-neutral-100">Cancel</button>
                  </span>
                ) : (
                  <button onClick={() => setConfirming(true)} disabled={ticked.size === 0 || busy}
                    className="rounded-full bg-navy px-3.5 py-1.5 text-sm font-medium text-white hover:bg-navy-strong disabled:cursor-not-allowed disabled:opacity-50">
                    {busy ? "Updating…" : `Update seeding data${ticked.size ? ` (${ticked.size})` : ""}`}
                  </button>
                )}
              </div>

              <div className="mt-4 space-y-3">
                {data.items.map((c) => (
                  <div key={key(c)} className="rounded-card border border-line bg-white px-5 py-3.5">
                    <label className="flex cursor-pointer flex-wrap items-center gap-3">
                      <input type="checkbox" checked={ticked.has(key(c))} onChange={() => toggle(key(c))} />
                      <span className="font-medium">
                        {LIST_LABELS[c.collection] ?? c.collection} · {c.label}
                      </span>
                      <span className="bg-neutral-100 px-2 py-0.5 font-mono text-[11px] uppercase">
                        {c.kind === "added" && "+ "}{c.kind}
                      </span>
                      {c.updated_at && (
                        <span className="font-mono text-[11px] text-neutral-500">edited {formatTime(c.updated_at)}</span>
                      )}
                    </label>
                    <div className="mt-3 space-y-2.5">
                      {c.fields.map((f) => <FieldRow key={f.field} diff={f} kind={c.kind} />)}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}

function FieldRow({ diff, kind }: { diff: FieldDiff; kind: Change["kind"] }) {
  const before = show(diff.seeding_value);
  const after = show(diff.live_value);
  const long = before.length > 80 || after.length > 80 || before.includes("\n") || after.includes("\n");
  const box = "max-h-64 overflow-y-auto whitespace-pre-wrap break-words border px-3 py-2 font-mono text-[11.5px] leading-relaxed";
  return (
    <div>
      <div className="font-mono text-[11px] uppercase tracking-wider text-neutral-500">{diff.field}</div>
      {long ? (
        <div className="mt-1 grid grid-cols-2 gap-2">
          <div>
            <div className="text-[11px] text-neutral-500">Seeding data</div>
            <div className={`${box} border-neutral-200 bg-neutral-50 text-neutral-600`}>{kind === "added" ? "—" : before}</div>
          </div>
          <div>
            <div className="text-[11px] text-neutral-500">Live</div>
            <div className={`${box} border-navy/30 bg-navy/5`}>{kind === "deleted" ? "— (deleted)" : after}</div>
          </div>
        </div>
      ) : (
        <div className="mt-0.5 text-sm">
          <span className="text-neutral-500 line-through decoration-neutral-300">{kind === "added" ? "—" : before}</span>
          <span className="mx-2 text-neutral-400">→</span>
          <span className="font-medium">{kind === "deleted" ? "— (deleted)" : after}</span>
        </div>
      )}
    </div>
  );
}
