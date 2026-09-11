"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import BackendError from "@/components/BackendError";
import PageHeader from "@/components/PageHeader";
import { fetchJson } from "@/lib/api";
import { PROMPT_IMPACT, PromptDoc, UNKNOWN_IMPACT } from "@/lib/prompts";

export default function PromptsPage() {
  const [prompts, setPrompts] = useState<PromptDoc[] | null>(null);
  const [error, setError] = useState<unknown>(null);

  useEffect(() => {
    fetchJson<{ prompts: PromptDoc[] }>("/api/prompts")
      .then((d) => setPrompts(d.prompts))
      .catch(setError);
  }, []);

  return (
    <div>
      <PageHeader eyebrow="Skills" title="Every instruction the models receive">
        <p className="mt-2 max-w-2xl text-sm text-neutral-600">
          Skills live in the database and are fetched by name at runtime —
          nothing is hardcoded. Edit one and the next run that reaches its stage
          uses the new text. Click a skill to edit it and see exactly where it
          acts.
        </p>
      </PageHeader>

      {error != null && <BackendError error={error} />}

      {prompts && (
        <div className="mt-7 divide-y divide-neutral-100 border border-neutral-200 bg-white">
          {prompts.map((p) => {
            const impact = PROMPT_IMPACT[p._id] ?? UNKNOWN_IMPACT;
            return (
              <Link
                key={p._id}
                href={`/admin/prompts/${p._id}`}
                className="flex items-center gap-4 px-5 py-3.5 hover:bg-neutral-50"
              >
                <span
                  className={`h-2 w-2 shrink-0 rounded-full ${p.enabled ? "bg-emerald-600" : "bg-neutral-300"}`}
                  title={p.enabled ? "enabled" : "disabled"}
                />
                <span className="min-w-0 flex-1">
                  <span className="font-mono text-sm font-medium">{p.name}</span>
                  <span className="ml-3 text-sm text-neutral-500">{p.description}</span>
                </span>
                <span
                  className={`shrink-0 px-2 py-0.5 font-mono text-[11px] uppercase ${
                    impact.live ? "bg-neutral-100 text-neutral-600" : "bg-amber-100 text-amber-900"
                  }`}
                >
                  {impact.stage}
                </span>
                <span className="shrink-0 font-mono text-xs text-neutral-500">v{p.version}</span>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
