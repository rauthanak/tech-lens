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
      <PageHeader title="Skills"
        intro="The instructions the AI models follow at each step, and where each one acts."
        help={<>
          <li>One row per skill, in alphabetical order. The tag says which step uses it: a collection, crawling,
            organizing technologies, an assessment run or a Point of View.</li>
          <li>The dot shows whether it&apos;s switched on; v and a number count its saved edits.</li>
          <li>Click a skill to edit its text and see what an edit changes. Saving costs no model calls; the step
            uses the new text the next time it runs.</li>
        </>}>
        {prompts && (
          <p className="mt-1 text-sm text-muted">
            {prompts.length} skills · {prompts.filter((p) => p.enabled).length} switched on
          </p>
        )}
      </PageHeader>

      {error != null && <BackendError error={error} />}

      {prompts && (
        <div className="mt-7 divide-y divide-neutral-100 overflow-hidden rounded-card border border-line bg-white">
          {prompts.map((p) => {
            const impact = PROMPT_IMPACT[p._id] ?? UNKNOWN_IMPACT;
            return (
              <Link
                key={p._id}
                href={`/admin/prompts/${p._id}`}
                className="flex items-center gap-4 px-5 py-3.5 hover:bg-neutral-50"
              >
                <span
                  className={`h-2 w-2 shrink-0 rounded-full ${p.enabled ? "bg-azure" : "bg-neutral-300"}`}
                  title={p.enabled ? "enabled" : "disabled"}
                />
                <span className="min-w-0 flex-1">
                  <span className="font-mono text-sm font-medium">{p.name}</span>
                  <span className="ml-3 text-sm text-neutral-500">{p.description}</span>
                </span>
                <span
                  className={`shrink-0 bg-neutral-100 px-2 py-0.5 font-mono text-[11px] uppercase ${
                    impact.live ? "text-neutral-600" : "text-ink"
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
