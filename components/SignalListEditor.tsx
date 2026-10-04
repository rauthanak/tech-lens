"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import BackendError from "@/components/BackendError";
import ConfirmAction from "@/components/ConfirmAction";
import SavedNote from "@/components/SavedNote";
import { ApiError, configChanged, fetchJson, sendJson } from "@/lib/api";
import { plural } from "@/lib/format";
import { refreshPipeline } from "@/lib/pipeline";
import { MODE_LABELS, type Mode, type SignalRow, type SignalsResponse } from "@/lib/signals";

const field =
  "mt-1 w-full rounded border border-neutral-300 bg-white px-3 py-1.5 text-sm outline-none focus:border-neutral-500";
const darkBtn =
  "rounded-full bg-navy px-3.5 py-1.5 text-sm font-medium text-white hover:bg-navy-strong disabled:cursor-not-allowed disabled:opacity-50";
const lightBtn =
  "rounded-full border border-line bg-white px-3 py-1.5 text-sm hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-50";
const MODES: Mode[] = ["never_miss", "can_ignore"];

type Draft = { id: string | null; name: string; look_for: string; mode: Mode; enabled: boolean };
const BLANK: Draft = { id: null, name: "", look_for: "", mode: "never_miss", enabled: true };

const reason = (e: unknown) =>
  e instanceof ApiError && e.detail ? e.detail : "It couldn't be saved. Check that tech-atlas is running.";

/** Setup → Signal list: add, edit, reorder, switch on or off, and delete
 *  rows. ?name= and ?look_for= open the add form already filled in ("Add to
 *  signal list"). Uses useSearchParams, so the page wraps it in <Suspense>. */
export default function SignalListEditor() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const [rows, setRows] = useState<SignalRow[] | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [draft, setDraft] = useState<Draft | null>(null);

  // ?name= opens the add form filled in, also when it changes without a reload
  // (this page's own suggestions link here): the draft follows the address
  const prefill = params.has("name") ? `${params.get("name")}\n${params.get("look_for") ?? ""}` : null;
  const [seenPrefill, setSeenPrefill] = useState<string | null>(null);
  if (prefill !== seenPrefill) {
    setSeenPrefill(prefill);
    if (prefill !== null) {
      setDraft({ ...BLANK, name: params.get("name") ?? "", look_for: params.get("look_for") ?? "" });
      setSaved(false);
      setNotice(null);
    }
  }

  const load = useCallback(() => {
    fetchJson<SignalsResponse>("/api/signals").then((d) => { setRows(d.signals); setError(null); }).catch(setError);
  }, []);
  useEffect(() => { load(); }, [load]);

  /** After any edit: the Changes count, the pages "not yet checked", and the list itself. */
  const changed = () => {
    configChanged();
    refreshPipeline();
    load();
    setNotice(null);
    setSaved(true);
  };

  const open = (d: Draft) => { setDraft(d); setSaved(false); setNotice(null); };
  // closing drops ?name= too, so the same suggestion can open the form again
  const close = () => {
    setDraft(null);
    if (prefill !== null) router.replace(pathname, { scroll: false });
  };

  async function toggle(row: SignalRow) {
    setNotice(null);
    try {
      await sendJson(`/api/signals/${row._id}`, "PUT",
        { name: row.name, look_for: row.look_for, mode: row.mode, enabled: !row.enabled });
      changed();
    } catch (e) {
      setSaved(false);
      setNotice(reason(e));
    }
  }

  /** Move a never-miss row up or down: the order the Briefing lists findings in. */
  async function move(row: SignalRow, by: -1 | 1) {
    const ids = (rows ?? []).filter((r) => r.mode === "never_miss").map((r) => r._id);
    const at = ids.indexOf(row._id);
    [ids[at], ids[at + by]] = [ids[at + by], ids[at]];
    setNotice(null);
    try {
      await sendJson("/api/signals/order", "PUT", { ids });
      changed();
    } catch (e) {
      setSaved(false);
      setNotice(reason(e));
    }
  }

  async function remove(row: SignalRow) {
    await sendJson(`/api/signals/${row._id}`, "DELETE"); // ConfirmAction shows why if this fails
    if (draft?.id === row._id) setDraft(null);
    changed();
  }

  return (
    <div className="mt-6">
      {error != null && <BackendError error={error} />}
      <div className="flex flex-col-reverse gap-8 xl:flex-row xl:items-start">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-3">
            <button className={darkBtn} onClick={() => open(BLANK)}>Add signal</button>
            <SavedNote show={saved} />
            {notice && <span className="text-sm text-failed">{notice}</span>}
          </div>
          {rows && MODES.map((mode) => (
            <section key={mode} className="mt-6">
              <h2 className="text-lg font-semibold">{MODE_LABELS[mode]}</h2>
              <p className="text-xs text-neutral-500">
                {mode === "never_miss"
                  ? "Called out in the summary with its implication when a page states it. Findings on the Briefing follow this order; reordering costs no model calls and doesn't mark pages as not yet checked."
                  : "A page that is wholly this kind of content, with no signal, is set aside: kept, but not used for technologies or assessments."}
              </p>
              <div className="mt-2 divide-y divide-neutral-100 rounded-card border border-line bg-white">
                {rows.filter((r) => r.mode === mode).map((r, i, list) => (
                  <div key={r._id}
                    className={`flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2.5 ${draft?.id === r._id ? "bg-ground" : ""}`}>
                    {mode === "never_miss" && (
                      <span className="flex shrink-0 flex-col">
                        <button type="button" onClick={() => move(r, -1)} disabled={i === 0} aria-label={`Move ${r.name} up`}
                          className="px-1 text-[11px] leading-none text-muted hover:text-ink disabled:opacity-25">▲</button>
                        <button type="button" onClick={() => move(r, 1)} disabled={i === list.length - 1} aria-label={`Move ${r.name} down`}
                          className="px-1 text-[11px] leading-none text-muted hover:text-ink disabled:opacity-25">▼</button>
                      </span>
                    )}
                    <button type="button" role="switch" aria-checked={r.enabled} aria-label={r.name}
                      onClick={() => toggle(r)} title={r.enabled ? "On: switch off to pause" : "Off: switch on"}
                      className={`relative h-4 w-7 shrink-0 rounded-full ${r.enabled ? "bg-azure" : "bg-neutral-300"}`}>
                      <span className={`absolute top-0.5 h-3 w-3 rounded-full bg-white ${r.enabled ? "left-3.5" : "left-0.5"}`} />
                    </button>
                    <div className="min-w-0 flex-1 basis-48">
                      <div className={`text-sm font-medium ${r.enabled ? "" : "text-neutral-400"}`}>{r.name}</div>
                      <div className="truncate text-xs text-neutral-500" title={r.look_for}>{r.look_for}</div>
                    </div>
                    <div className="text-xs text-muted sm:w-56 sm:text-right">
                      {r.hits_total === 0 ? "Not seen yet"
                        : `${mode === "never_miss" ? `Found ${plural(r.hits_total, "time")}`
                          : `Set aside ${plural(r.hits_total, "page")}`} · ${r.hits_last_run} in the last collection`}
                    </div>
                    <button className="shrink-0 text-sm text-link hover:underline"
                      onClick={() => open({ id: r._id, name: r.name, look_for: r.look_for, mode: r.mode, enabled: r.enabled })}>
                      Edit
                    </button>
                    <ConfirmAction label="Delete" confirmLabel="Delete" secondary onConfirm={() => remove(r)}
                      question={r.enabled
                        ? `Delete “${r.name}”? It leaves the list from the next collection. Findings it already found stay on their pages. Changing the list marks stored pages as not yet checked.`
                        : `Delete “${r.name}”? It's switched off, so nothing else changes.`} />
                  </div>
                ))}
              </div>
            </section>
          ))}
          <p className="mt-4 text-xs text-neutral-500">
            Edits apply from the next collection. Pages already stored show as not yet checked until
            you <Link href="/admin/operations" className="text-link hover:underline">check them again on Operations</Link>.
          </p>
        </div>
        {draft && (
          <SignalForm key={draft.id ?? "new"} draft={draft} onClose={close}
            onSaved={() => { close(); changed(); }} />
        )}
      </div>
    </div>
  );
}

function SignalForm({ draft, onClose, onSaved }: { draft: Draft; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState<Draft>(draft);
  const [error, setError] = useState<{ field: "name" | "general"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    setError(null);
    const body = { name: form.name, look_for: form.look_for, mode: form.mode, enabled: form.enabled };
    try {
      if (form.id) await sendJson(`/api/signals/${form.id}`, "PUT", body);
      else await sendJson("/api/signals", "POST", body);
      onSaved();
    } catch (e) {
      const text = reason(e);
      const nameProblem = e instanceof ApiError && (e.status === 409 || (e.status === 422 && /name|other/i.test(text)));
      setError({ field: nameProblem ? "name" : "general", text });
      setBusy(false);
    }
  }

  return (
    <form className="w-full shrink-0 space-y-4 rounded-card border border-line bg-white px-5 py-4 xl:sticky xl:top-6 xl:w-[380px]"
      onSubmit={(e) => { e.preventDefault(); save(); }}>
      <div className="font-mono text-[11px] uppercase tracking-wider text-neutral-500">
        {form.id ? "Edit signal" : "New signal"}
      </div>
      <label className="block text-sm font-medium">
        Name
        <input className={field} value={form.name} required maxLength={80}
          onChange={(e) => setForm({ ...form, name: e.target.value })} />
        {error?.field === "name" && <span className="mt-1 block text-xs font-normal text-failed">{error.text}</span>}
      </label>
      <label className="block text-sm font-medium">
        What to look for
        <textarea className={`${field} h-36`} value={form.look_for} required maxLength={2000}
          onChange={(e) => setForm({ ...form, look_for: e.target.value })} />
        <span className="mt-1 block text-xs font-normal text-neutral-500">
          Describe it in plain words, including what makes it significant.
        </span>
      </label>
      <div className="flex overflow-hidden rounded border border-neutral-300 text-sm">
        {MODES.map((m) => (
          <button key={m} type="button" onClick={() => setForm({ ...form, mode: m })} aria-pressed={form.mode === m}
            className={`flex-1 px-3 py-1.5 ${form.mode === m ? "bg-navy font-medium text-white" : "hover:bg-neutral-100"}`}>
            {MODE_LABELS[m]}
          </button>
        ))}
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={form.enabled} onChange={(e) => setForm({ ...form, enabled: e.target.checked })} />
        On: used from the next collection
      </label>
      {error?.field === "general" && <p className="text-xs text-failed">{error.text}</p>}
      <div className="flex flex-wrap items-center gap-2">
        <button type="submit" className={darkBtn} disabled={busy}>{busy ? "Saving…" : "Save"}</button>
        <button type="button" className={lightBtn} onClick={onClose}>Cancel</button>
      </div>
    </form>
  );
}
