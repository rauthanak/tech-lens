"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import BackendError from "@/components/BackendError";
import PageHeader from "@/components/PageHeader";
import { fetchJson } from "@/lib/api";
import { AXIS_LABELS, AXIS_ORDER, CONFIG_LABELS, KIND_LABELS, weightShare } from "@/lib/scoring";

type Overview = {
  fabrics: { total: number; enabled: number };
  measures: {
    total: number;
    by_axis: Record<string, { id: string; code: string; name: string; weight: number | null }[]>;
  };
  config: Record<string, Record<string, unknown>>;
  pending: { kind: string; id: string; label: string; open_question: string | null }[];
  total_items: number;
};

function Tile({ label, value, note, href }: { label: string; value: string; note?: string; href: string }) {
  return (
    <Link href={href} className="rounded-card border border-line bg-white px-5 py-4 hover:border-neutral-400">
      <div className="font-mono text-[11px] uppercase tracking-wider text-neutral-500">{label}</div>
      <div className="mt-1 text-[26px] font-semibold leading-tight">{value}</div>
      {note && <div className="text-xs text-muted">{note}</div>}
    </Link>
  );
}

type Pending = Overview["pending"][number];

/** Open questions with the same text, asked of several items, as one line. */
function grouped(pending: Pending[]): { kind: string; labels: string[]; question: string | null }[] {
  const groups = new Map<string, { kind: string; labels: string[]; question: string | null }>();
  for (const p of pending) {
    const key = `${p.kind}|${p.open_question ?? ""}`;
    const g = groups.get(key) ?? { kind: p.kind, labels: [], question: p.open_question };
    g.labels.push(p.kind === "config" ? CONFIG_LABELS[p.id] ?? p.label : p.label);
    groups.set(key, g);
  }
  return [...groups.values()];
}

export default function ScoringOverview() {
  const [data, setData] = useState<Overview | null>(null);
  const [error, setError] = useState<unknown>(null);

  useEffect(() => {
    fetchJson<Overview>("/api/scoring/overview").then(setData).catch(setError);
  }, []);

  return (
    <div>
      <PageHeader title="The scoring method, at a glance"
        intro="How the radar scores a technology, on one page. Everything here is configuration you can edit."
        help={<>
        <li>An assessment scores each technology in each fabric it touches (Tata Communications&apos; business
          areas) on twelve measures, from 0 to 10, each backed by collected evidence.</li>
        <li>Nine of them average into the three scores: Market Potential (how big), Strategic Fit (how well it
          fits) and Adoption Readiness (how ready). The percentage is each measure&apos;s share of its score.</li>
        <li>Some of the same scores also place it on the priority grid, from P1 act now to P6 just watch, and give
          its horizon, from H1 near to H3 far. Weights &amp; Grid shows how.</li>
        <li>Open questions are decisions still waiting on Tata&apos;s answer; clear one once it&apos;s
          settled.</li>
        <li>Edits cost no model calls and apply from the next assessment run. Weight and cut-point changes can be
          applied to a past run with Redo scores on its page.</li>
      </>} />

      {error != null && <BackendError error={error} />}

      {data && (
        <>
          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
            <Tile label="Fabrics" value={`${data.fabrics.enabled} of ${data.fabrics.total}`} href="/admin/scoring/fabrics" />
            <Tile label="Measures" value={String(data.measures.total)} href="/admin/scoring/measures" />
            <Tile label="Open questions" value={String(data.pending.length)}
              note={`still open, of ${data.total_items} setup items`} href="/admin/scoring/pending" />
          </div>

          <section className="mt-8">
            <h2 className="text-lg font-semibold">How the three scores are made</h2>
            <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-4">
              {AXIS_ORDER.map((axis) => (
                <div key={axis} className="rounded-card border border-line bg-white px-4 py-3.5">
                  <div className="font-mono text-[11px] uppercase tracking-wider text-neutral-500">
                    {AXIS_LABELS[axis]}
                  </div>
                  <div className="mt-2 space-y-1.5">
                    {(data.measures.by_axis[axis] ?? [])
                      .sort((a, b) => a.code.localeCompare(b.code))
                      .map((m) => (
                        <div key={m.id} className="flex items-baseline justify-between gap-2 text-sm">
                          <span>{m.name}</span>
                          <span className="font-mono text-xs tabular-nums text-neutral-600">
                            {weightShare(m.weight)}
                          </span>
                        </div>
                      ))}
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="mt-8">
            <h2 className="text-lg font-semibold">Next open questions</h2>
            <div className="mt-3 divide-y divide-neutral-100 rounded-card border border-line bg-white">
              {grouped(data.pending).slice(0, 5).map((g) => (
                <div key={`${g.kind}-${g.labels.join(",")}`} className="px-4 py-2.5 text-sm">
                  <span className="text-xs text-neutral-500">{KIND_LABELS[g.kind] ?? g.kind}{g.labels.length > 1 ? "s" : ""}</span>{" "}
                  <span className="font-medium">{g.labels.join(", ")}</span>
                  {g.question && (
                    <span className="text-neutral-600">: {g.question}</span>
                  )}
                </div>
              ))}
              {data.pending.length === 0 && (
                <div className="px-4 py-3 text-sm text-neutral-500">
                  No open questions — every decision is settled.
                </div>
              )}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
