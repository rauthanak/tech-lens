"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import BackendError from "@/components/BackendError";
import PageHeader from "@/components/PageHeader";
import { ApiError, configChanged, fetchJson, sendJson } from "@/lib/api";
import SavedNote from "@/components/SavedNote";
import { PROMPT_IMPACT, PromptDoc, UNKNOWN_IMPACT } from "@/lib/prompts";

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
      });
      setSaved(true);
      configChanged();
      load();
    } catch (e) {
      setSaveError(e instanceof ApiError ? (e.detail ?? e.message) : "save failed");
    } finally {
      setSaving(false);
    }
  }

  const impact = PROMPT_IMPACT[name] ?? UNKNOWN_IMPACT;
  const dirty =
    doc && draft &&
    (doc.description !== draft.description || (doc.system ?? "") !== (draft.system ?? "") ||
      doc.prompt !== draft.prompt || doc.enabled !== draft.enabled);

  return (
    <div>
      <PageHeader eyebrow="Skill" title={name}
        intro="One instruction the models follow. The step uses the new text the next time it runs."
        help={<>
          <li>Skill text is what the model receives, after the optional System text. Words in {"{single braces}"}
            are filled in when it runs; literal braces stay doubled: {"{{ }}"}.</li>
          <li>Where it acts says which step uses it, when it fires and what an edit changes.</li>
          <li>Saving costs no model calls and lists the edit in Changes; Discard changes puts back the saved
            text. Switching a skill off makes its step fail or be skipped when it runs.</li>
        </>}>
        <p className="mt-2 flex flex-wrap items-center gap-3 text-sm text-neutral-600">
          {doc && <span className="font-mono text-xs text-neutral-500">v{doc.version}</span>}
          <Link href="/admin/prompts" className="text-link underline underline-offset-4">
            back to skills
          </Link>
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
              <input className={field} value={draft.description}
                onChange={(e) => setDraft({ ...draft, description: e.target.value })} required />
            </div>
            <div>
              <label className="block text-sm font-medium">System</label>
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
              Enabled — a switched-off skill makes its step fail when it runs
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
                <div className="font-mono text-[11px] uppercase tracking-wider text-neutral-400">Stage</div>
                <p className="mt-0.5">
                  {impact.stage}
                  {!impact.live && " — not wired in yet"}
                </p>
              </div>
              <div>
                <div className="font-mono text-[11px] uppercase tracking-wider text-neutral-400">Used by</div>
                <p className="mt-0.5">{impact.usedBy}</p>
              </div>
              <div>
                <div className="font-mono text-[11px] uppercase tracking-wider text-neutral-400">Fires</div>
                <p className="mt-0.5">{impact.when}</p>
              </div>
              <div className="border-l-2 border-navy/30 pl-3">
                <div className="font-mono text-[11px] uppercase tracking-wider text-neutral-500">
                  What an edit changes
                </div>
                <p className="mt-1 leading-relaxed text-neutral-700">{impact.impacts}</p>
              </div>
              <div>
                <div className="font-mono text-[11px] uppercase tracking-wider text-neutral-400">Variables</div>
                {draft.variables.length > 0 ? (
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {draft.variables.map((v) => (
                      <span key={v}
                        className="rounded-full bg-navy/5 px-2 py-0.5 font-mono text-[11px] text-ink">
                        {"{" + v + "}"}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="mt-0.5 text-neutral-500">none — the text is used as-is</p>
                )}
              </div>
              {doc?.updated_at && (
                <p className="font-mono text-[11px] text-neutral-400">
                  last saved {doc.updated_at.slice(0, 19).replace("T", " ")} UTC
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
