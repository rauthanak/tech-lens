"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import BackendError from "@/components/BackendError";
import PageHeader from "@/components/PageHeader";
import { configChanged, errorText, fetchJson, sendJson } from "@/lib/api";
import SavedNote from "@/components/SavedNote";
import SkillPreview from "@/components/SkillPreview";
import StackedPreview from "@/components/StackedPreview";
import TechnicalDetailsSwitch from "@/components/TechnicalDetailsSwitch";
import { formatAt, formatDay, plural } from "@/lib/format";
import { useHood } from "@/lib/hood";
import { PROMPT_IMPACT, PromptDoc, type SkillMap, skillTitle, STAGE_MEANING, tokensUsed, UNKNOWN_IMPACT } from "@/lib/prompts";
import BackLink from "@/components/BackLink";

// a step's runs, named as the reader knows them
const RUN_NOUN: Record<string, string> = { collect: "collection", organise: "Organize run", classify: "Classify run",
  assess: "assessment run", pov: "Points of View run" };

const times = (n: number) => (n === 1 ? "once" : n === 2 ? "twice" : `${n.toLocaleString()} times`);

const field =
  "mt-1 w-full rounded border border-neutral-300 bg-white px-3 py-1.5 text-sm outline-none focus:border-neutral-500";

export default function PromptDetailPage() {
  const { name } = useParams<{ name: string }>();
  const [doc, setDoc] = useState<PromptDoc | null>(null);
  const [draft, setDraft] = useState<PromptDoc | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [recipes, setRecipes] = useState<{ _id: string; name: string; skills: string[] }[]>([]);
  const [sent, setSent] = useState<string>("alone"); // how it's shown: on its own, or inside a recipe's combined call
  useEffect(() => {
    fetchJson<{ recipes: { _id: string; name: string; skills: string[] }[] }>("/api/recipes")
      .then((d) => setRecipes(d.recipes.filter((r) => r.skills.includes(name))))
      .catch(() => {});
  }, [name]);
  const [month, setMonth] = useState<{ calls: number; written_per_call: number } | null>(null); // the last 30 days
  useEffect(() => {
    fetchJson<{ calls: number; written_per_call: number }>(`/api/usage/skill/${name}`).then(setMonth).catch(() => setMonth(null));
  }, [name]);
  const [map, setMap] = useState<SkillMap | null>(null);
  const hood = useHood();

  // what it used in each step's last full run, one line per step: inside the
  // combined calls that carry it, and on its own; tokens under Technical details
  useEffect(() => {
    fetchJson<SkillMap>("/api/skills/map").then(setMap).catch(() => {});
  }, [name]);
  const used = (map?.stages ?? []).flatMap((st) => {
    if (!st.run) return [];
    const inside = st.recipes.filter((r) => r.skills.includes(name) && r.used);
    const alone = st.skills.find((k) => k.name === name)?.alone ?? inside.map((r) => r.alone[name]).find(Boolean) ?? null;
    if (!inside.length && !alone) return [];
    const parts = [
      ...inside.map((r) => `inside ${plural(r.used!.calls, r.name.toLowerCase())}${hood ? ` (${tokensUsed(r.used!)}, the whole call's)` : ""}`),
      ...(alone ? [`${inside.length ? `${times(alone.calls)} on its own` : plural(alone.calls, "call")}${hood ? ` (${tokensUsed(alone)})` : ""}`] : []),
    ];
    return [`Last full ${RUN_NOUN[st.id] ?? st.name}, ${formatDay(st.run.at)}: ${parts.join(", and ")}`];
  });

  const load = () =>
    fetchJson<{ prompts: PromptDoc[] }>("/api/prompts")
      .then((d) => {
        const p = d.prompts.find((x) => x._id === name) ?? null;
        setDoc(p);
        setDraft(p ? { ...p } : null);
      })
      .catch(setError);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name]);

  async function save() {
    if (!draft) return;
    setSaving(true);
    setSaveError(null);
    setSaved(false);
    try {
      await sendJson(`/api/prompts/${name}`, "PUT", {
        description: draft.description,
        system: draft.system || null,
        prompt: draft.prompt,
        enabled: draft.enabled,
        reasoning: draft.reasoning ?? "off",
      });
      setSaved(true);
      configChanged();
      load();
    } catch (e) {
      setSaveError(errorText(e));
    } finally {
      setSaving(false);
    }
  }

  const impact = PROMPT_IMPACT[name] ?? UNKNOWN_IMPACT;
  const dirty =
    doc && draft &&
    (doc.description !== draft.description || (doc.system ?? "") !== (draft.system ?? "") ||
      doc.prompt !== draft.prompt || doc.enabled !== draft.enabled ||
      (doc.reasoning ?? "off") !== (draft.reasoning ?? "off"));
  // unsaved skill text: What it turns into is rebuilt from it
  const textDraft =
    doc && draft && ((doc.system ?? "") !== (draft.system ?? "") || doc.prompt !== draft.prompt)
      ? { system: draft.system || null, prompt: draft.prompt }
      : null;

  return (
    <div>
      <Suspense fallback={null}><BackLink fallback="/admin/prompts" fallbackLabel="Skills" /></Suspense>
      <PageHeader eyebrow="Skill" title={doc?.title || skillTitle(name)} right={<TechnicalDetailsSwitch />}
        intro="One instruction the models follow. The step uses the new text the next time it runs."
        help={<>
          <li>Skill text is what the model receives, after the optional instructions sent first. Words in{" "}
            {"{single braces}"} are filled in when it runs; literal braces stay doubled: {"{{ }}"}.</li>
          <li>Where it acts says which step uses it, when it runs and what an edit changes. Technical details adds
            the skill&apos;s code name, the one the code reads it by, its version and the tokens it used.</li>
          <li>Saving costs no model calls and lists the edit in Changes; Discard changes puts back the saved
            text. Switching a skill off makes its step fail or be skipped when it runs.</li>
          <li>What it turns into, below the card, shows how many versions of this skill a run sends, where
            each blank is filled from, and a real example built from today&apos;s settings. It costs no model
            calls, and while you have unsaved edits it shows what your edit would send.</li>
        </>}>
        <p className="mt-2 flex flex-wrap items-center gap-3 text-sm text-neutral-600">
          {hood && doc && <span className="text-xs text-neutral-500">Version {doc.version}</span>}
          {hood && <span className="font-mono text-xs text-neutral-500">{name}</span>}
          {used.map((u) => <span key={u} className="text-xs text-neutral-500">{u}</span>)}
          <Link href="/admin/prompts/map" className="text-link underline underline-offset-4">where each skill is used</Link>
        </p>
      </PageHeader>

      {error != null && <BackendError error={error} />}
      {doc === null && error == null && (
        <p className="mt-6 text-sm text-neutral-500">Unknown skill.</p>
      )}

      {draft && (
        <div className="mt-7 flex flex-col gap-6 rounded-card border border-line bg-white px-6 py-5 lg:flex-row">
          {/* left 65% — the prompt itself, editable */}
          <form
            className="min-w-0 space-y-4 lg:w-[65%]"
            onSubmit={(e) => {
              e.preventDefault();
              save();
            }}
          >
            <div>
              <label className="block text-sm font-medium">Description</label>
              <textarea className={field} rows={2} value={draft.description}
                onChange={(e) => setDraft({ ...draft, description: e.target.value })} required />
            </div>
            <div>
              <label className="block text-sm font-medium">Instructions sent first (optional)</label>
              <textarea className={`${field} min-h-24 font-mono text-[13px] leading-relaxed`}
                value={draft.system ?? ""}
                placeholder="optional — put before the skill text, with a blank line"
                onChange={(e) => setDraft({ ...draft, system: e.target.value })} />
            </div>
            <div>
              <label className="block text-sm font-medium">Skill text</label>
              <textarea className={`${field} min-h-96 font-mono text-[13px] leading-relaxed`}
                value={draft.prompt}
                onChange={(e) => setDraft({ ...draft, prompt: e.target.value })} required />
              <p className="mt-1.5 text-xs text-neutral-500">
                {"{single_braces}"} are variables, filled at runtime. Literal braces —
                JSON examples — must stay doubled: {"{{ }}"}. Saving recomputes the
                variables list from the text and rejects unbalanced braces.
              </p>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={draft.enabled}
                onChange={(e) => setDraft({ ...draft, enabled: e.target.checked })} />
              Switched on: a switched-off skill makes its step fail or be skipped when it runs
            </label>
            <label className="flex items-start gap-2 text-sm">
              <input type="checkbox" className="mt-1" checked={draft.reasoning === "on"}
                onChange={(e) => setDraft({ ...draft, reasoning: e.target.checked ? "on" : "off" })} />
              <span>
                Let the model reason before it answers
                <span className="block text-xs text-neutral-500">
                  Better judgment on hard calls, such as scoring and Points of View. Its reasoning isn&apos;t shown but
                  is paid for as written tokens, often several times the answer, and calls take longer. A call that
                  carries several skills reasons when any of them asks to.
                </span>
                {month && (
                  <span className="mt-1 block text-xs text-ink">
                    {month.calls === 0 ? "Not called in the last 30 days, so switching costs nothing until it is."
                      : `In the last 30 days: ${plural(month.calls, "call")}, each writing about ${month.written_per_call.toLocaleString()} tokens${
                        doc?.reasoning === "on" ? " with reasoning on; switching it off writes far fewer" : "; with reasoning on, expect several times that"}. The number of calls doesn't change.`}
                  </span>
                )}
              </span>
            </label>
            {saveError && <p className="text-sm text-failed">Save failed: {saveError}</p>}
            <SavedNote show={saved && !dirty} />
            <div className="flex items-center gap-3">
              <button type="submit" disabled={saving || !dirty}
                className="rounded-full bg-navy px-4 py-2 text-sm font-medium text-white hover:bg-navy-strong disabled:opacity-50">
                {saving ? "Saving…" : "Save"}
              </button>
              {dirty && (
                <button type="button" onClick={() => { setDraft({ ...doc! }); setSaveError(null); }}
                  className="px-2 py-2 text-sm text-neutral-600 hover:text-black">
                  Discard changes
                </button>
              )}
            </div>
          </form>

          {/* thin fading separator */}
          <div
            aria-hidden
            className="hidden w-px self-stretch bg-gradient-to-b from-transparent via-neutral-300 to-transparent lg:block"
          />

          {/* right — where it acts (long code paths may break anywhere on narrow screens) */}
          <div className="min-w-0 flex-1 border-t border-neutral-100 pt-5 [overflow-wrap:anywhere] lg:border-0 lg:pt-0">
            <div className="font-mono text-[11px] uppercase tracking-wider text-neutral-500">
              Where it acts
            </div>
            <div className="mt-2 space-y-3 text-sm">
              <div>
                <div className="font-mono text-[11px] uppercase tracking-wider text-neutral-400">Step</div>
                <p className="mt-0.5">
                  {impact.stage}
                  {STAGE_MEANING[impact.stage] && <span className="text-neutral-500">: {STAGE_MEANING[impact.stage]}</span>}
                </p>
              </div>
              <div>
                <div className="font-mono text-[11px] uppercase tracking-wider text-neutral-400">Used in</div>
                <p className="mt-0.5">{impact.usedBy}</p>
                {hood && impact.code && <p className="mt-0.5 font-mono text-xs text-neutral-500">{impact.code}</p>}
              </div>
              <div>
                <div className="font-mono text-[11px] uppercase tracking-wider text-neutral-400">Runs</div>
                <p className="mt-0.5">{impact.when}</p>
              </div>
              <div className="border-l-2 border-navy/30 pl-3">
                <div className="font-mono text-[11px] uppercase tracking-wider text-neutral-500">
                  What an edit changes
                </div>
                <p className="mt-1 leading-relaxed text-neutral-700">{impact.impacts}</p>
              </div>
              {doc?.updated_at && (
                <p className="font-mono text-[11px] text-neutral-400">
                  last saved {formatAt(doc.updated_at)}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {doc && recipes.length > 0 && (
        <div className="mt-8 flex flex-wrap items-center gap-2" role="radiogroup" aria-label="Show it">
          <span className="mr-1 text-sm font-medium">Show it</span>
          {[{ id: "alone", label: "On its own" }, ...recipes.map((r) => ({ id: r._id, label: `Inside the ${r.name.toLowerCase()}` }))]
            .map((o) => (
              <button key={o.id} type="button" role="radio" aria-checked={sent === o.id} onClick={() => setSent(o.id)}
                className={`rounded-full border px-3 py-1 text-[13px] ${sent === o.id ? "border-navy bg-navy text-white" : "border-line bg-white hover:bg-ground"}`}>
                {o.label}
              </button>
            ))}
          <span className="basis-full text-xs text-neutral-500">
            {recipes.length === 1 ? "Its step sends" : "Each of these steps sends"} this skill inside one call with
            other skills; it&apos;s sent on its own only when that call&apos;s reply left its task out and it&apos;s
            asked again alone.
          </span>
        </div>
      )}
      {doc && sent !== "alone" && <StackedPreview recipe={sent} skill={name} />}
      {doc && sent === "alone" && (
        <Suspense fallback={null}>
          <SkillPreview name={name} draft={textDraft} />
        </Suspense>
      )}
    </div>
  );
}
