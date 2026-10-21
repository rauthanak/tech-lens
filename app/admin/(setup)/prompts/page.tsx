"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import BackendError from "@/components/BackendError";
import PageHeader from "@/components/PageHeader";
import TechnicalDetailsSwitch from "@/components/TechnicalDetailsSwitch";
import { fetchJson } from "@/lib/api";
import { useHood } from "@/lib/hood";
import { PROMPT_IMPACT, PromptDoc, skillTitle, STAGE_MEANING, UNKNOWN_IMPACT } from "@/lib/prompts";

// the pipeline's order; a skill no step reads yet comes last
const ORDER = Object.keys(PROMPT_IMPACT);
const order = (id: string) => (ORDER.includes(id) ? ORDER.indexOf(id) : ORDER.length);

export default function PromptsPage() {
  const [prompts, setPrompts] = useState<PromptDoc[] | null>(null);
  const [error, setError] = useState<unknown>(null);
  const hood = useHood();

  useEffect(() => {
    fetchJson<{ prompts: PromptDoc[] }>("/api/prompts")
      .then((d) => setPrompts(d.prompts))
      .catch(setError);
  }, []);

  return (
    <div>
      <PageHeader title="Skills" right={<TechnicalDetailsSwitch />}
        intro="The instructions the AI models follow at each step, and where each one acts."
        help={<>
          <li>One row per skill, in the order the radar uses them. The tag is the step that uses it, as on
            Operations: {Object.entries(STAGE_MEANING).map(([step, means]) => `${step} ${means}`).join("; ")}.</li>
          <li>The dot shows whether it&apos;s switched on. Technical details adds each skill&apos;s code name, the one
            the code reads it by, and its version, which counts its saved edits.</li>
          <li>Click a skill to edit its text and see what an edit changes. Saving costs no model calls; the step
            uses the new text the next time it runs.</li>
          <li>A skill&apos;s page also shows what it turns into when it runs: how many versions, where its blanks
            are filled from, and a real example.</li>
        </>}>
        {prompts && (
          <p className="mt-1 flex flex-wrap gap-x-4 text-sm text-muted">
            <span>{prompts.length} skills · {prompts.filter((p) => p.enabled).length} switched on</span>
            <Link href="/admin/prompts/map" className="text-link hover:underline">Where each skill is used →</Link>
          </p>
        )}
      </PageHeader>

      {error != null && <BackendError error={error} />}

      {prompts && (
        <div className="mt-7 divide-y divide-neutral-100 overflow-hidden rounded-card border border-line bg-white">
          {[...prompts].sort((a, b) => order(a._id) - order(b._id)).map((p) => {
            const impact = PROMPT_IMPACT[p._id] ?? UNKNOWN_IMPACT;
            return (
              <Link
                key={p._id}
                href={`/admin/prompts/${p._id}`}
                className="flex items-center gap-4 px-5 py-3.5 hover:bg-neutral-50"
              >
                <span
                  className={`h-2 w-2 shrink-0 rounded-full ${p.enabled ? "bg-azure" : "bg-neutral-300"}`}
                  title={p.enabled ? "switched on" : "switched off"}
                />
                <span className="min-w-0 flex-1">
                  <span className="text-sm font-medium">{p.title || skillTitle(p._id)}</span>
                  {hood && <span className="ml-2 font-mono text-xs text-neutral-500">{p.name}</span>}
                  <span className="ml-3 text-sm text-neutral-500">{p.description}</span>
                </span>
                <span
                  className={`shrink-0 bg-neutral-100 px-2 py-0.5 text-xs ${impact.live ? "text-neutral-600" : "text-ink"}`}
                  title={STAGE_MEANING[impact.stage] ? `${impact.stage}: ${STAGE_MEANING[impact.stage]}` : undefined}
                >
                  {impact.stage}
                </span>
                {hood && <span className="shrink-0 text-xs text-neutral-500">version {p.version}</span>}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
