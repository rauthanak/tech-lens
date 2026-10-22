"use client";

import ListItems from "@/components/ListItems";
import PageHeader from "@/components/PageHeader";

export default function PathPage() {
  return (
    <div>
      <PageHeader title="Path to scale"
        intro="The seven steps a technology goes through at Tata, from a first look (Evaluation) to full investment. Each step says the proof needed to reach it and the decision it then lets Tata make."
        help={<>
          <li>A person records the step Tata has reached with a technology, on its fabric tab; the radar then shows what
            is still missing for the next one, with a box beside each piece of proof a person records.</li>
          <li>The radar checks each piece of proof as a person records it on the fabric tab. When everything the next step
            needs is in hand, the tab says &ldquo;Proof for &lt;step&gt; is in hand&rdquo; and the technology joins Before
            publishing. Exposed contracts count only where a lever protects revenue.</li>
          <li>Beta, Roadmap and Investment have no proof written yet, so nothing is checked for them: Tata words them
            here.</li>
          <li>Edit a step to change its words. Edits cost no model calls.</li>
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
    </div>
  );
}
