"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import BackendError from "@/components/BackendError";
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
    <Link href={href} className="border border-neutral-200 bg-white px-5 py-4 hover:border-neutral-400">
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
      <h1 className="font-display text-[28px] font-semibold leading-tight">
        The scoring method, at a glance
      </h1>
      <p className="mt-2 max-w-2xl text-sm text-neutral-600">
        Everything here is configuration, not code — edit it and the next scoring
        run uses it. Items carrying an open question still await the client&apos;s
        answer; blank the question once it&apos;s settled.
      </p>

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
            <div className="mt-3 grid max-w-5xl grid-cols-1 gap-3 lg:grid-cols-4">
              {AXIS_ORDER.map((axis) => (
                <div key={axis} className="border border-neutral-200 bg-white px-4 py-3.5">
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

          <section className="mt-8 max-w-3xl">
            <h2 className="text-lg font-semibold">Next open questions</h2>
            <div className="mt-3 divide-y divide-neutral-100 border border-neutral-200 bg-white">
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
