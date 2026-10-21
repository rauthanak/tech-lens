"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import ConfirmAction from "@/components/ConfirmAction";
import { calls } from "@/lib/actions";
import { errorText, fetchJson, sendJson } from "@/lib/api";
import { SOURCE_WORDS, type ListItem, type Source } from "@/lib/classification";
import { formatTokens, plural } from "@/lib/format";

/** A technology in the register as a match is judged by (tech-atlas
 *  services/imports.target_info): its pages and its classification. */
export type Target = { name: string; page_count: number; origin: string | null;
  availability: { name: string; source: Source }; domain: { name: string; subdomain: string | null; source: Source };
  trl: { level: number | null; source: Source } };

/** "Early commercial · Edge Computing › Telecom Edge · TRL 6", and where each came from. */
export function targetValues(t: Target): { line: string; from: string } {
  const where = [t.domain.source !== "none" && t.domain.name, t.domain.subdomain].filter(Boolean).join(" › ");
  const parts: [string, Source, string | false][] = [
    ["commercial availability", t.availability.source, t.availability.source !== "none" && t.availability.name],
    ["domain", t.domain.source, where], ["TRL", t.trl.source, t.trl.level != null && `TRL ${t.trl.level}`]];
  const known = parts.filter(([, s, v]) => s !== "none" && v);
  if (!known.length) return { line: "Not classified yet", from: "" };
  const bySource = new Map<Source, string[]>();
  for (const [what, s] of known) bySource.set(s, [...(bySource.get(s) ?? []), what]);
  return { line: known.map(([, , v]) => v).join(" · "),
    from: [...bySource].map(([s, what]) => `${what.join(", ")} ${SOURCE_WORDS[s]}`).join("; ") };
}

type Cost = { names: number; calls: number; register: number; tokens_about: number };
type Preview = { outcome: "matched" | "proposed" | "unmatched"; why: string | null;
  target: (Target & { tech_id: string }) | null; cost: Cost | null };
type Result = { outcome: "matched" | "proposed" | "added"; tech_id: string; name: string; values_set?: number;
  why?: string; proposed?: Target & { tech_id: string }; kept_apart?: { tech_id: string; name: string } | null };
type Values = { availability: string; domain: string; subdomain: string; trl: string };
type Lists = { availability: ListItem[]; domains: ListItem[]; subdomains: ListItem[] };

const NONE: Values = { availability: "", domain: "", subdomain: "", trl: "" };
const SELECT = "w-full rounded border border-neutral-300 bg-white px-2 py-1 text-[13px] disabled:opacity-50";
const SMALL = "rounded-full border border-line px-3 py-1 hover:bg-ground disabled:opacity-50";
const href = (id: string) => `/admin/technologies/${encodeURIComponent(id)}`;

function TargetSummary({ t }: { t: Target & { tech_id: string } }) {
  const v = targetValues(t);
  return (
    <span className="block text-xs text-muted">
      <Link href={href(t.tech_id)} className="text-link hover:underline">{t.name}</Link> · {plural(t.page_count, "page")}
      {" · "}{v.line}{v.from && ` (${v.from})`}
    </span>
  );
}

/** "+ Add technology": one technology by hand, matched against the register
 *  the way an import row is — its name or an alias joins it; a close name is
 *  offered to confirm; otherwise it's added, with no pages yet. Checking a
 *  name with no exact match uses the organize skill, and says so first. The
 *  values chosen count as a person's choices, as an imported row's do. */
export default function AddTechnology({ onAdded }: { onAdded: () => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [values, setValues] = useState<Values>(NONE);
  const [lists, setLists] = useState<Lists | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  const [preview, setPreview] = useState<{ name: string; data?: Preview; error?: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);
  const key = name.trim();
  const checked = key && preview?.name === key ? preview : null; // null while the name is being checked

  useEffect(() => {
    if (!open || lists) return;
    let live = true;
    Promise.all(["availability", "domains", "subdomains"].map((l) => fetchJson<{ items: ListItem[] }>(`/api/lists/${l}`)))
      .then(([a, d, s]) => { if (live) setLists({ availability: a.items, domains: d.items, subdomains: s.items }); })
      .catch((e) => { if (live) setListError(errorText(e)); });
    return () => { live = false; };
  }, [open, lists]);

  useEffect(() => {
    if (!open || !key) return;
    let live = true;
    const wait = setTimeout(() => {
      fetchJson<Preview>(`/api/technologies/add/preview?name=${encodeURIComponent(key)}`)
        .then((d) => { if (live) setPreview({ name: key, data: d }); })
        .catch((e) => { if (live) setPreview({ name: key, error: errorText(e) }); });
    }, 350);
    return () => { live = false; clearTimeout(wait); };
  }, [open, key]);

  const chosen = Object.values(values).filter(Boolean).length;
  async function add(confirmAs?: "join" | "new") {
    const r = await sendJson<Result>("/api/technologies", "POST", {
      name: key, ...(confirmAs ? { confirm: confirmAs, into: result?.proposed?.tech_id } : {}),
      availability: values.availability || null, domain: values.domain || null, subdomain: values.subdomain || null,
      trl: values.trl ? Number(values.trl) : null });
    setResult(r);
    if (r.outcome !== "proposed") onAdded();
  }
  async function addFree(confirmAs?: "join" | "new") {
    setBusy(true);
    setError(null);
    try {
      await add(confirmAs);
    } catch (e) {
      setError(`Nothing was added: ${errorText(e)}.`);
    } finally {
      setBusy(false);
    }
  }
  const set = (field: keyof Values, value: string) =>
    setValues((v) => ({ ...v, [field]: value, ...(field === "domain" ? { subdomain: "" } : {}) }));
  const close = () => { setOpen(false); setResult(null); setName(""); setValues(NONE); setError(null); };

  if (!open) return (
    <button type="button" onClick={() => setOpen(true)} className="rounded-full bg-navy px-3.5 py-1.5 text-sm text-white hover:bg-navy-strong">
      + Add technology
    </button>
  );

  const p = checked?.data;
  const valuesSet = (r: Result) => chosen === 0 ? "" : r.values_set
    ? ` ${plural(r.values_set, "value")} you chose ${r.values_set === 1 ? "is" : "are"} set on it as a person's choice${r.values_set === 1 ? "" : "s"}.`
    : " The values you chose were already set on it.";
  const subdomains = lists?.subdomains.filter((s) => s.domain_id === values.domain) ?? [];

  return (
    <div className="w-[26rem] max-w-full rounded-card border border-line bg-white p-3 text-sm shadow-sm">
      <label className="block text-xs font-medium text-neutral-700" htmlFor="add-tech-name">Its name</label>
      <input id="add-tech-name" autoFocus value={name} onChange={(e) => { setName(e.target.value); setResult(null); }}
        placeholder="For example, Zero trust network access"
        className="mt-1 w-full rounded border border-neutral-300 px-2 py-1" />
      <p className="mt-1.5 min-h-[1rem] text-xs text-muted" role="status">
        {!key ? "Matched against the register first, the way an imported row is."
          : !checked ? "Checking the register…"
            : checked.error ? <span className="text-failed">The register couldn&apos;t be checked, so the cost isn&apos;t known: {checked.error}.</span>
              : p?.outcome === "matched" ? <>Already in the register: nothing new is added{chosen ? "; the values you choose are set on it" : ""}. No model call.</>
                : p?.outcome === "proposed" ? <>Close to a technology in the register: {p.why}. You&apos;ll be asked to confirm. No model call.</>
                  : p?.cost ? <>No exact match. Checking it against the {plural(p.cost.register, "name")} in the register
                    uses {calls(p.cost.calls)}, about {formatTokens(p.cost.tokens_about)} tokens; a close name is offered to
                    confirm, otherwise it&apos;s added as new.</> : null}
      </p>
      {p?.target && !result && <TargetSummary t={p.target} />}

      <fieldset className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2" disabled={!lists}>
        <legend className="col-span-2 mb-1 text-xs text-muted">
          Optional. What you choose counts as a person&apos;s choice, as an imported row&apos;s values do: classifying never
          overwrites it, and a Research, Pilot or Early commercial one counts as emerging.
        </legend>
        <label className="text-xs text-neutral-700">Commercial availability
          <select value={values.availability} onChange={(e) => set("availability", e.target.value)} className={SELECT}>
            <option value="">Not set</option>
            {lists?.availability.filter((a) => !a.catch_all).map((a) => <option key={a._id} value={a._id}>{a.name}</option>)}
          </select>
        </label>
        <label className="text-xs text-neutral-700">TRL
          <select value={values.trl} onChange={(e) => set("trl", e.target.value)} className={SELECT}>
            <option value="">Not set</option>
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => <option key={n} value={n}>TRL {n}</option>)}
          </select>
        </label>
        <label className="text-xs text-neutral-700">Domain
          <select value={values.domain} onChange={(e) => set("domain", e.target.value)} className={SELECT}>
            <option value="">Not set</option>
            {lists?.domains.filter((d) => !d.catch_all).map((d) => <option key={d._id} value={d._id}>{d.name}</option>)}
          </select>
        </label>
        <label className="text-xs text-neutral-700">Sub-domain
          <select value={values.subdomain} onChange={(e) => set("subdomain", e.target.value)} className={SELECT}
            disabled={!values.domain}>
            <option value="">{values.domain ? "Not set" : "Choose a domain first"}</option>
            {subdomains.map((s) => <option key={s._id} value={s._id}>{s.name}</option>)}
          </select>
        </label>
      </fieldset>
      {listError && <p role="alert" className="mt-1 text-xs text-failed">Our lists couldn&apos;t be loaded, so values can&apos;t be chosen: {listError}.</p>}

      {!result && (
        <div className="mt-3">
          {p?.outcome === "unmatched" && p.cost
            ? <ConfirmAction label="Add" cost={`${calls(p.cost.calls)}, about ${formatTokens(p.cost.tokens_about)} tokens`}
              confirmLabel="Check and add"
              question={`Check “${key}” against the ${plural(p.cost.register, "name")} in the register? It uses ${calls(p.cost.calls)}, about ${formatTokens(p.cost.tokens_about)} tokens.`}
              onConfirm={() => add()} />
            : <button type="button" disabled={!p || busy} onClick={() => addFree()}
              className="rounded-full bg-navy px-3.5 py-1.5 text-white hover:bg-navy-strong disabled:opacity-50">
              {busy ? "Adding…" : "Add"}
            </button>}
        </div>
      )}

      {result?.outcome === "matched" && (
        <p className="mt-3">Already in the register as <Link href={href(result.tech_id)} className="text-link hover:underline">{result.name}</Link>;
          {" "}nothing new was added.{valuesSet(result)}</p>
      )}
      {result?.outcome === "added" && (
        <p className="mt-3">
          Added: <Link href={href(result.tech_id)} className="text-link hover:underline">{result.name}</Link>. It has no pages
          yet; Find evidence on its page looks for some.{valuesSet(result)}
          {result.kept_apart && <> The organize skill read it as {result.kept_apart.name}, but it is narrower, so it was kept separate.</>}
        </p>
      )}
      {result?.outcome === "proposed" && result.proposed && (
        <div className="mt-3">
          <p>Is it <b>{result.proposed.name}</b>, already in the register?</p>
          <TargetSummary t={result.proposed} />
          {result.why && <span className="block text-xs text-muted">{result.why}.</span>}
          <div className="mt-1.5 flex flex-wrap gap-2">
            <button type="button" disabled={busy} onClick={() => addFree("join")} className={SMALL}>Yes, the same: join it</button>
            <button type="button" disabled={busy} onClick={() => addFree("new")} className={SMALL}>No, add it as new</button>
          </div>
        </div>
      )}
      {error && <p role="alert" className="mt-2 text-failed">{error}</p>}
      <button type="button" onClick={close} className="mt-2 block text-xs text-muted hover:text-ink">Close</button>
    </div>
  );
}
