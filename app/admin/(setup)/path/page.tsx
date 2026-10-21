"use client";

import { useEffect, useState } from "react";
import ListItems from "@/components/ListItems";
import PageHeader from "@/components/PageHeader";
import { errorText, fetchJson } from "@/lib/api";
import type { PathStep } from "@/lib/value";

/** What the radar checks before it flags each step: the seeded `needs` of
 *  each step, in words. Set in the seeding data (seeds/path_steps.json). */
function Checks() {
  const [data, setData] = useState<{ path: PathStep[]; needs: Record<string, string> } | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { fetchJson<{ path: PathStep[]; needs: Record<string, string> }>("/api/finance").then(setData).catch((e) => setError(errorText(e))); }, []);
  if (error) return <p className="mt-6 text-sm text-failed">Couldn&apos;t load what the radar checks: {error}</p>;
  if (!data) return null;
  return (
    <section className="mt-6 rounded-card border border-line bg-white px-5 py-4">
      <h2 className="font-semibold">What the radar checks before it flags a step</h2>
      <p className="mt-0.5 text-[12.5px] text-muted">When everything a technology&apos;s next step needs is in hand, its fabric tab says
        &ldquo;Proof for &lt;step&gt; is in hand&rdquo; and it joins the Before publishing list. The notes and figures are entered on its
        finance card; exposed contracts count only where the revenue is protected.</p>
      <ul className="mt-2 space-y-1 text-sm">
        {data.path.map((s) => (
          <li key={s._id}><span className="font-medium">{s.name}:</span>{" "}
            {(s.needs ?? []).length ? (s.needs ?? []).map((k) => data.needs[k] ?? k).join("; ")
              : <span className="text-muted">nothing checked: its proof isn&apos;t written yet</span>}</li>
        ))}
      </ul>
    </section>
  );
}

export default function PathPage() {
  return (
    <div>
      <PageHeader title="Path to scale"
        intro="The seven steps a technology goes through at Tata, from a first look (Evaluation) to full investment. Each step says the proof needed to reach it and the decision it then lets Tata make."
        help={<>
          <li>A person records the step Tata has reached with a technology, on its fabric tab; the radar then shows what
            is still missing for the next one. The finance card asks for figures from Proof of concept on, or earlier
            when the next step needs a note or figure it holds.</li>
          <li>Beta, Roadmap and Investment have no proof written yet: Tata words them here.</li>
          <li>Click a step to edit its words. Edits cost no model calls.</li>
          <li>The steps come from Tri&apos;s process; the proof for the first four from Nick&apos;s value note.</li>
        </>} />
      <div className="mt-6">
        <ListItems list="path_steps" noun="a step" canAdd={false} canRemove={false} technologies={false}
          note="It changes no score. Every technology's fabric tab shows the new words at once; Points of View use a new name when they're next written."
          fields={[
            { key: "name", label: "Name" },
            { key: "evidence_needed", label: "Proof needed to reach it", kind: "long" },
            { key: "decision", label: "What it lets Tata decide", kind: "long" },
          ]} />
      </div>
      <Checks />
    </div>
  );
}
