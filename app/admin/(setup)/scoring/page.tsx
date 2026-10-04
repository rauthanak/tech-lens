"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import BackendError from "@/components/BackendError";
import PageHelp from "@/components/PageHelp";
import { fetchJson } from "@/lib/api";
import { AXIS_LABELS, AXIS_ORDER } from "@/lib/scoring";

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

function Tile({ label, value, href }: { label: string; value: string; href: string }) {
  return (
    <Link href={href} className="rounded-card border border-line bg-white px-5 py-4 hover:border-neutral-400">
      <div className="font-mono text-[11px] uppercase tracking-wider text-neutral-500">{label}</div>
      <div className="mt-1 text-[26px] font-semibold leading-tight">{value}</div>
    </Link>
  );
}

export default function ScoringOverview() {
  const [data, setData] = useState<Overview | null>(null);
  const [error, setError] = useState<unknown>(null);

  useEffect(() => {
    fetchJson<Overview>("/api/scoring/overview").then(setData).catch(setError);
  }, []);

  return (
    <div>
      <h1 className="font-display text-[28px] leading-tight">
        The scoring method, at a glance
      </h1>
      <p className="mt-2 max-w-4xl text-sm text-neutral-600">
        How the radar scores a technology, on one page. Everything here is configuration you can edit.
      </p>
      <PageHelp>
        <li>An assessment scores each technology in each fabric it touches (Tata Communications&apos; business
          areas) on twelve measures, from 0 to 10, each backed by collected evidence.</li>
        <li>Nine of them average into the three TORA numbers: Market Potential (how big), Strategic Fit (how well it
          fits) and Adoption Readiness (how ready). The × number is each measure&apos;s weight.</li>
        <li>Some of the same scores also place it on the priority grid, from P1 act now to P6 just watch, and give
          its horizon, from H1 near to H3 far. Weights &amp; Grid shows how.</li>
        <li>Open questions are decisions still waiting on the client&apos;s answer; blank one once it&apos;s
          settled.</li>
        <li>Edits cost no model calls and apply from the next assessment run. Weight and cut-point changes can be
          applied to a past run with Recompute on its page.</li>
      </PageHelp>

      {error != null && <BackendError error={error} />}

      {data && (
        <>
          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
            <Tile label="Fabrics" value={`${data.fabrics.enabled} of ${data.fabrics.total}`} href="/admin/scoring/fabrics" />
            <Tile label="Measures" value={String(data.measures.total)} href="/admin/scoring/measures" />
            <Tile label="Open questions" value={`${data.pending.length} of ${data.total_items}`} href="/admin/scoring/pending" />
          </div>

          <section className="mt-8">
            <h2 className="text-lg font-semibold">TORA composition &amp; weights</h2>
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
                          <span>
                            <span className="font-mono text-xs text-neutral-500">{m.code}</span>{" "}
                            {m.name}
                          </span>
                          <span className="font-mono text-xs tabular-nums text-neutral-600">
                            {m.weight != null ? `× ${m.weight}` : "—"}
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
              {data.pending.slice(0, 5).map((p) => (
                <div key={`${p.kind}-${p.id}`} className="px-4 py-2.5 text-sm">
                  <span className="font-mono text-[11px] uppercase text-neutral-500">{p.kind}</span>{" "}
                  <span className="font-medium">{p.label}</span>
                  {p.open_question && (
                    <span className="text-neutral-600"> — {p.open_question}</span>
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
