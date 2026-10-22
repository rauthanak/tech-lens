"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import BackendError from "@/components/BackendError";
import Hood from "@/components/Hood";
import PageHeader from "@/components/PageHeader";
import TechnicalDetailsSwitch from "@/components/TechnicalDetailsSwitch";
import { fetchJson } from "@/lib/api";
import { formatAt, plural } from "@/lib/format";
import { useHood } from "@/lib/hood";
import { type MapSkill, type SkillMap, usedLine } from "@/lib/prompts";

// what each step does and when, in one line
const WHEN: Record<string, string> = {
  collect: "Each collection: plan it, crawl each source, choose links, read each page.",
  organise: "After each collection: merge new spellings into the technologies the radar already knows, and set their capitals.",
  classify: "After Organize: one call per technology with new pages, judging its evidence and setting its domain, availability and maturity.",
  assess: "Each assessment run: one call per technology, then one per fabric it touches.",
  pov: "One call per technology, when its Point of View is written.",
};

/** Every skill where it's used: a step's combined calls as dashed boxes with
 *  the skills they carry, then the skills called on their own; numbers from
 *  each step's last full run, named at the top of the step. */
export default function SkillMapPage() {
  const [data, setData] = useState<SkillMap | null>(null);
  const [error, setError] = useState<unknown>(null);
  const hood = useHood(); // tokens beside the calls
  useEffect(() => { fetchJson<SkillMap>("/api/skills/map").then(setData).catch(setError); }, []);
  const skill = (name: string): MapSkill | undefined => data?.stages.flatMap((s) => s.skills).find((s) => s.name === name);

  return (
    <div className="print-landscape print:text-[10.5px] print:[&_h1]:text-2xl">
      <Link href="/admin/prompts" className="text-sm text-link hover:underline print:hidden">← Skills</Link>
      <PageHeader title="Where each skill is used"
        intro="The radar's steps, left to right, with every skill where it's used and what it used in the step's last full run."
        help={<>
          <li>Each column is a step. Under its name: the run its numbers come from, the step&apos;s last full run
            (the newest run at least half the size of its largest, so a small test run doesn&apos;t stand in).</li>
          <li>A dashed box is one combined call carrying several skills: the evidence is sent once and each skill
            answers under its own heading. Its numbers are the whole call&apos;s; they aren&apos;t split between its
            skills. &ldquo;Asked alone&rdquo; counts the times a skill was asked on its own because the call&apos;s
            reply left its task out. Each skill is still edited on its own.</li>
          <li>A card is a skill called on its own; &ldquo;agent&rdquo; means it plans its own calls. Grey means
            switched off.</li>
          <li>Technical details adds the tokens: tokens in counts everything sent; reused tokens were sent before and
            cost a fraction of the price; out is what the model wrote.</li>
          <li>Click a skill to read or edit it. Print puts the map on one landscape page.</li>
        </>}
        right={<div className="flex flex-col items-end gap-3 print:hidden">
          <TechnicalDetailsSwitch />
          <button type="button" onClick={() => window.print()}
            className="rounded-full border border-line bg-white px-3.5 py-1.5 text-sm hover:bg-ground">Print</button>
        </div>} />

      {error != null && <BackendError error={error} />}
      {data && (
        <ol className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5 print:mt-3 print:grid-cols-5 print:gap-2">
          {data.stages.map((st, i) => (
            <li key={st.id} className="flex min-w-0 flex-col gap-2.5 rounded-card border border-line bg-white p-3.5 print:gap-1.5 print:p-2">
              <div>
                <div className="font-mono text-[11px] uppercase tracking-wider text-neutral-500">Step {i + 1}</div>
                <h2 className="text-base font-semibold">{st.name}</h2>
                <p className="mt-0.5 text-xs text-muted print:text-[10px]">{WHEN[st.id]}</p>
                <p className="mt-1 text-[11.5px] text-neutral-500 print:text-[10px]">
                  {st.run ? <>Last full run: {formatAt(st.run.at)} · {plural(st.run.calls, "call")}</>
                    : "Not run since tokens were first recorded"}
                  <Hood>{st.run && <span className="ml-1 font-mono">{st.run.run_id}</span>}</Hood>
                </p>
              </div>
              {st.recipes.map((r) => (
                <div key={r.recipe_id} className="rounded-lg border border-dashed border-navy/40 bg-navy/[0.03] p-2.5 print:p-1.5">
                  <div className="text-[13px] font-medium print:text-[11px]">One call: {r.name}</div>
                  <div className="mt-1 text-[11.5px] text-muted print:text-[10px]">
                    {r.used ? <>{usedLine(r.used, hood)}{hood && ", the whole call's"}</> : st.run ? "No calls in that run" : "—"}
                  </div>
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {r.skills.map((name) => {
                      const sk = skill(name);
                      const alone = r.alone[name];
                      return (
                        <Link key={name} href={`/admin/prompts/${name}`}
                          title={alone ? `Asked alone: ${usedLine(alone, hood)}` : undefined}
                          className={`rounded-full px-2 py-0.5 text-[11.5px] ring-1 hover:ring-navy print:px-1.5 print:text-[10px] ${sk && !sk.enabled ? "bg-neutral-50 text-neutral-400 ring-neutral-300" : "bg-white ring-line"}`}>
                          {sk?.title ?? name}
                          {sk && !sk.enabled && " (off)"}
                          {alone && <span className="text-muted"> · asked alone {alone.calls}×</span>}
                        </Link>
                      );
                    })}
                  </div>
                </div>
              ))}
              {st.skills.length === 0 && st.recipes.length === 0 && <p className="text-xs text-faint">No skills in this step yet.</p>}
              {st.skills.filter((sk) => sk.recipes.length === 0).map((sk) => (
                <Link key={sk.name} href={`/admin/prompts/${sk.name}`}
                  className={`block rounded-lg border px-2.5 py-2 hover:border-navy print:px-1.5 print:py-1 ${sk.enabled ? "border-line" : "border-dashed border-neutral-300 bg-neutral-50 text-neutral-400"}`}>
                  <div className="flex items-center gap-2">
                    <span className={`h-2 w-2 shrink-0 rounded-full ${sk.enabled ? "bg-azure" : "bg-neutral-300"}`}
                      title={sk.enabled ? "switched on" : "switched off"} />
                    <span className="min-w-0 flex-1 text-[13px] font-medium print:text-[11px]">{sk.title}</span>
                    {sk.agent && <Hood><span className="rounded bg-navy/10 px-1.5 text-[10.5px] text-navy" title="Plans its own calls">agent</span></Hood>}
                  </div>
                  {!sk.enabled && <div className="mt-0.5 text-[11.5px]">Switched off</div>}
                  <div className="mt-0.5 text-[11.5px] text-muted print:text-[10px]">
                    {sk.alone ? usedLine(sk.alone, hood) : st.run ? "No calls in that run" : "—"}
                  </div>
                </Link>
              ))}
            </li>
          ))}
        </ol>
      )}
      {data && data.unplaced.length > 0 && (
        <p className="mt-4 text-sm text-muted">Not in any step yet: {data.unplaced.join(", ")}.</p>
      )}
    </div>
  );
}
