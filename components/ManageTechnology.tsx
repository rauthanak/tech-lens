"use client";

import { useEffect, useState } from "react";
import ConfirmAction from "@/components/ConfirmAction";
import Dialog from "@/components/Dialog";
import { errorText, fetchJson, sendJson } from "@/lib/api";
import { andList, formatAt, plural } from "@/lib/format";

type Tech = { name: string; aliases: string[]; enabled: boolean; switched_off_at?: string | null; switched_off_tz?: string | null };
type Found = { id: string; name: string; pages: number; enabled: boolean; names: string[] };
/** What POST /technologies/{id}/merge says it carried over, and what it couldn't. */
type Merged = { merge?: { absorbed: { id: string; name: string; assessed?: boolean; pov?: boolean }[]; choices_moved: number;
  catalog_carried: boolean; conflicts: { kept: string; dropped: string; from: string }[]; assess_again?: boolean } };

const FIELD = "mt-1 w-full rounded border border-neutral-300 px-3 py-1.5 text-sm outline-none focus:border-neutral-500";
const SECONDARY = "rounded-full border border-line bg-white px-3.5 py-1.5 text-sm hover:bg-ground disabled:opacity-50";

/** The notice after a merge: what moved, what was kept, and what to do next. */
function mergedNotice(r: Merged, into: string, typed: string): string {
  const m = r.merge;
  if (!m) return `Merged. ${into} keeps its name and now has the merged pages.`;
  const x = m.absorbed.length ? andList(m.absorbed.map((a) => a.name)) : typed;
  let text = `Merged: ${x} is now part of ${into}, with its names and pages`;
  text += m.choices_moved > 0 ? `, and ${plural(m.choices_moved, "choice")} people made on it.` : ".";
  if (m.conflicts.length)
    text += ` Where both had a choice, ${into}'s was kept: ${m.conflicts.map((c) => `${c.kept} (${c.from} had: ${c.dropped})`).join("; ")}.`;
  if (m.catalog_carried) text += ` ${x}'s place in Tata's catalog moved to ${into}.`;
  const left = m.absorbed.filter((a) => a.assessed || a.pov);
  if (left.length) text += ` ${andList(left.map((a) => a.name))}'s own assessment and Point of View stay in history; they aren't carried over.`;
  if (m.assess_again) text += ` Next: assess ${into} again so its scores read the merged pages (Next step, on its page).`;
  return text;
}

/** Suggestions as a person types: technologies whose name, or a name found on
 *  pages, contains the words. `pick` gets the technology and the name chosen. */
function NameField({ id, label, placeholder, exclude, value, onChange, show }: {
  id: string; label: string; placeholder: string; exclude: string; value: string;
  onChange: (v: string) => void; show: "names" | "technologies";
}) {
  const [found, setFound] = useState<Found[]>([]);
  const [open, setOpen] = useState(false);
  const short = value.trim().length < 2; // nothing suggested for a letter or two
  useEffect(() => {
    const q = value.trim();
    if (q.length < 2) return;
    const wait = setTimeout(() => fetchJson<{ technologies: Found[] }>(`/api/technologies/lookup?q=${encodeURIComponent(q)}`)
      .then((d) => setFound(d.technologies.filter((t) => t.id !== exclude))).catch(() => setFound([])), 250);
    return () => clearTimeout(wait);
  }, [value, exclude]);
  const options = short ? [] : show === "names"
    ? found.flatMap((t) => t.names.map((n) => ({ key: `${t.id}:${n}`, value: n, label: n, note: `now under ${t.name}` })))
    : found.map((t) => ({ key: t.id, value: t.name, label: t.name, note: `${plural(t.pages, "page")}${t.enabled ? "" : ", switched off"}` }));
  return (
    <div className="relative">
      <label htmlFor={id} className="sr-only">{label}</label>
      <input id={id} className={FIELD} placeholder={placeholder} value={value} autoComplete="off"
        onChange={(e) => { onChange(e.target.value); setOpen(true); }} onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)} />
      {open && options.length > 0 && (
        <ul role="listbox" className="absolute z-10 mt-1 max-h-52 w-full overflow-y-auto rounded border border-line bg-white py-1 text-[13px] shadow-md">
          {options.slice(0, 8).map((o) => (
            <li key={o.key} role="option" aria-selected={o.value === value}>
              <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => { onChange(o.value); setOpen(false); }}
                className="flex w-full items-baseline justify-between gap-3 px-3 py-1 text-left hover:bg-ground">
                <span>{o.label}</span><span className="shrink-0 text-[12px] text-muted">{o.note}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Part({ title, hint, children, last }: { title: string; hint: string; children: React.ReactNode; last?: boolean }) {
  return (
    <section className={`py-3 ${last ? "" : "border-b border-line"}`}>
      <h3 className="font-medium">{title}</h3>
      <p className="mt-0.5 text-[12.5px] text-muted">{hint}</p>
      <div className="mt-2">{children}</div>
    </section>
  );
}

/** Manage, in a box over the technology's page: its names, rename it, bring
 *  in a name filed under another technology, merge another technology in, and
 *  include it in assessments or not. Each part says when to use it; each
 *  result shows at the top, in red when it failed. */
export default function ManageTechnology({ id, t, name, open, onClose, onChanged }: {
  id: string; t: Tech; name: string; open: boolean; onClose: () => void; onChanged: () => void;
}) {
  // the page mounts it afresh each time it opens (its key), so every box starts from the technology as it is
  const [rename, setRename] = useState(name);
  const [claim, setClaim] = useState("");
  const [other, setOther] = useState("");
  const [notice, setNotice] = useState<{ text: string; failed: boolean } | null>(null);
  const [busy, setBusy] = useState(false);

  async function act<T>(fn: () => Promise<T>, done: (r: T) => string) {
    setNotice(null);
    setBusy(true);
    try {
      const r = await fn();
      setNotice({ text: done(r), failed: false });
      onChanged();
    } catch (e) {
      setNotice({ text: `Not done: ${errorText(e)}`, failed: true });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onClose={onClose} title={`Manage ${name}`}>
      <div className="text-sm">
        {notice && <p role="status" className={`mb-1 rounded border px-3 py-2 ${notice.failed
          ? "border-red-200 bg-red-50 text-failed" : "border-emerald-200 bg-emerald-50 text-emerald-900"}`}>{notice.text}</p>}

        <Part title="Its names" hint="Every name the radar found on pages for this technology. A page that uses any of them counts as its evidence.">
          <div className="flex max-h-28 flex-wrap gap-1.5 overflow-y-auto">
            {t.aliases.map((x) => <span key={x} className="rounded-full bg-navy/5 px-2 py-0.5 text-[12px] text-ink">{x}</span>)}
          </div>
        </Part>

        <Part title="Rename" hint="The name everyone sees, here and in the leaders' view. Capitals are kept. No model calls.">
          <div className="flex items-end gap-2">
            <div className="min-w-0 flex-1">
              <label htmlFor="rename" className="sr-only">New name</label>
              <input id="rename" className={FIELD} value={rename} onChange={(e) => setRename(e.target.value)} />
            </div>
            <button type="button" className={SECONDARY} disabled={busy || !rename.trim() || rename.trim() === name} onClick={() =>
              act(() => sendJson(`/api/technologies/${id}`, "PUT", { name: rename.trim(), enabled: t.enabled }),
                () => `Renamed to ${rename.trim()}. Its pages now carry the new name.`)}>
              {busy ? "Saving…" : "Save name"}
            </button>
          </div>
        </Part>

        <Part title="A name filed under the wrong technology?"
          hint="When pages about this technology were filed under another one because the radar read one of its names as different: bring that name here, and the pages that use it move with it.">
          <div className="flex items-end gap-2">
            <div className="min-w-0 flex-1">
              <NameField id="claim" label="The name to bring here" placeholder="Start typing the name, e.g. qkd" exclude={id}
                value={claim} onChange={setClaim} show="names" />
            </div>
            <button type="button" className={SECONDARY} disabled={busy || !claim.trim()} onClick={() =>
              act(() => sendJson(`/api/technologies/${id}/claim_alias`, "POST", { alias: claim.trim() }),
                () => { const c = claim.trim(); setClaim(""); return `“${c}” is now one of ${name}'s names; its pages moved here.`; })}>
              Bring it here
            </button>
          </div>
          {!claim.trim() && <p className="mt-1 text-[12px] text-muted">Pick a name from the suggestions as you type.</p>}
        </Part>

        <Part title="The same technology under another name?"
          hint="Merge the other one into this one: its names, pages and the choices people made on it move here, and it is removed. Its own assessment and Point of View aren't carried over, so assess this one again afterwards. This can't be undone.">
          <div className="flex items-end gap-2">
            <div className="min-w-0 flex-1">
              <NameField id="merge" label="The technology to merge in" placeholder="Start typing its name, e.g. ai agents" exclude={id}
                value={other} onChange={setOther} show="technologies" />
            </div>
            <ConfirmAction label="Merge it in" secondary confirmLabel="Merge"
              disabled={other.trim() ? (busy ? "Working…" : null) : "Pick the technology to merge in."}
              question={`Merge ${other.trim()} into ${name}? ${other.trim()}'s names, pages and the choices people made on it move to ${name}, `
                + `and ${other.trim()} is removed. Where both have a choice on the same thing, ${name}'s is kept. Its assessment and `
                + "Point of View stay in history; assess this one again afterwards. This can't be undone."}
              onConfirm={() => act(() => sendJson<Merged>(`/api/technologies/${id}/merge`, "POST", { others: [other.trim()] }),
                (r) => { const typed = other.trim(); setOther(""); return mergedNotice(r, name, typed); })} />
          </div>
        </Part>

        <Part last title="Include it in assessments"
          hint="Switched off, it's left out of assessments, Points of View and the leaders' view; its pages are still collected, and the radar flags it if new ones keep coming.">
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={t.enabled} disabled={busy} onChange={(e) => {
              const on = e.target.checked;
              act(() => sendJson(`/api/technologies/${id}`, "PUT", { name: t.name, enabled: on }),
                () => on ? "Switched back on: assessment runs include it again." : "Switched off: left out of assessments. Tick again to switch it back on.");
            }} />
            {t.enabled ? "Included" : `Switched off${t.switched_off_at ? ` on ${formatAt(t.switched_off_at, t.switched_off_tz)}` : ""}`}
          </label>
        </Part>
      </div>
    </Dialog>
  );
}
