"use client";

import { useEffect, useState } from "react";
import BackendError from "@/components/BackendError";
import { fetchJson } from "@/lib/api";
import { plural } from "@/lib/format";

type Part = { label: string; reused: boolean; text: string };
type Preview = { recipe: string; name: string; keys: string[]; skills: string[]; parts: Part[];
  technology: { id: string; label: string }; fabric: { id: string; name: string } | null;
  fabrics: { id: string; name: string }[]; characters: number; tokens_about: number };

const FOLD = 1200;

/** A stacked call, as a run sends it, for one technology (and fabric): the
 *  reused parts first, then what's sent each time. This skill's own blocks
 *  are highlighted; the rest belong to the other skills in the same call. */
export default function StackedPreview({ recipe, skill }: { recipe: string; skill: string }) {
  const [fabric, setFabric] = useState<string>("");
  const [doc, setDoc] = useState<Preview | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [open, setOpen] = useState<Record<number, boolean>>({});

  useEffect(() => {
    fetchJson<Preview>(`/api/recipes/${recipe}/preview${fabric ? `?fabric=${encodeURIComponent(fabric)}` : ""}`)
      .then((d) => { setDoc(d); setError(null); })
      .catch(setError);
  }, [recipe, fabric]);

  if (error != null) return <BackendError error={error} />;
  if (!doc) return null;
  const mine = (block: string) => {
    const key = block.match(/^### ([^:]+(?::[^:]+)?):/)?.[1] ?? "";
    return key === skill || (skill === "measure_scoring" && key.startsWith("measure:"));
  };
  return (
    <div className="mt-3">
      <p className="text-sm text-neutral-600">
        The {doc.name.toLowerCase()} for {doc.technology.label}
        {doc.fabric && <> in {doc.fabric.name}</>}: {plural(doc.keys.length, "task")} in one call, about{" "}
        {doc.tokens_about.toLocaleString()} tokens. The skills in it: {doc.skills.join(", ")}.
      </p>
      {doc.fabric && (
        <label className="mt-2 block text-sm">
          Fabric{" "}
          <select value={doc.fabric.id} onChange={(e) => setFabric(e.target.value)}
            className="ml-1 rounded border border-neutral-300 bg-white px-2 py-1 text-sm">
            {doc.fabrics.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
          </select>
        </label>
      )}
      <div className="mt-3 space-y-3">
        {doc.parts.map((p, i) => {
          const blocks = p.text.split(/\n\n(?=### )/);
          const long = p.text.length > FOLD && !open[i] && !blocks.some((b) => b.startsWith("### "));
          return (
            <section key={i} className={`rounded-card border px-4 py-3 ${p.reused ? "border-dashed border-navy/40 bg-navy/[0.02]" : "border-line bg-white"}`}>
              <div className="font-mono text-[11px] uppercase tracking-wider text-neutral-500">
                {i + 1}. {p.label}
              </div>
              <div className="mt-2 space-y-2">
                {blocks.map((b, j) => (
                  <pre key={j} className={`whitespace-pre-wrap break-words font-mono text-[12px] leading-relaxed ${
                    b.startsWith("### ") ? (mine(b) ? "rounded bg-azure/10 p-2 ring-1 ring-azure/40" : "rounded bg-neutral-50 p-2 text-neutral-500") : ""}`}>
                    {long ? `${b.slice(0, FOLD)}…` : b}
                  </pre>
                ))}
              </div>
              {long && (
                <button type="button" onClick={() => setOpen({ ...open, [i]: true })}
                  className="mt-1 text-sm text-link hover:underline">Show all ({p.text.length.toLocaleString()} characters)</button>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}
