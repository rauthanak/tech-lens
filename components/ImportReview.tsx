"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { targetValues } from "@/components/AddTechnology";
import Pager from "@/components/Pager";
import { errorText, fetchJson, sendJson } from "@/lib/api";
import type { ListItem } from "@/lib/classification";
import { plural } from "@/lib/format";
import { withFrom } from "@/lib/here";
import { type Decision, Empty, FIELD_WORDS, type Import, type Item, KEEP, LEAVE, SECONDARY, SMALL_PRIMARY, SMALL_SECONDARY, TH, type Unknown, fileValues, isOrAre, sharedTargets, waitingOf, waitsOrWait } from "@/lib/imports";
import { useTechLabel } from "@/lib/tech-labels";

// An import under review: its proposed matches, the names coming in, and the values our lists
// don't have (the Import page's Review step).

function DecisionChip({ decision }: { decision: Decision }) {
  const [text, style] = decision === "accept" ? ["Accepted: joins it", "bg-emerald-50 text-emerald-800"]
    : decision === "reject" ? ["Rejected: comes in as new", "bg-neutral-100 text-muted"]
      : ["Waiting for your decision", "bg-amber-50 text-amber-900"];
  return <span className={`whitespace-nowrap rounded-full px-2 py-0.5 text-[11.5px] ${style}`}>{text}</span>;
}

function TechLink({ item, here }: { item: Item; here: string }) {
  const label = useTechLabel();
  const name = label(item.target_name ?? "");
  return item.target_tech_id
    ? <Link href={withFrom(`/admin/technologies/${encodeURIComponent(item.target_tech_id)}`, here)}
      className="text-link hover:underline">{name}</Link>
    : <>{name}</>;
}

/** The row's description, two lines until opened. */
function Description({ text }: { text?: string }) {
  const [open, setOpen] = useState(false);
  if (!text) return null;
  return (
    <span className="mt-1 block text-[12px] text-neutral-600">
      <span className={open ? "" : "line-clamp-2"}>{text}</span>
      {text.length > 140 && (
        <button type="button" onClick={() => setOpen(!open)} className="text-link hover:underline">
          {open ? "Less" : "More"}
        </button>
      )}
    </span>
  );
}

/** Several rows would join one technology: usually a narrower one folded into
 *  a broader one, and none of their values is set on it if confirmed so. */
function SharedNotice({ groups, imp, here }: { groups: [string, Item[]][]; imp: Import; here: string }) {
  if (!groups.length) return null;
  return (
    <div role="note" className="mt-3 rounded-card border border-amber-200 bg-amber-50/70 px-5 py-3 text-[13px] text-amber-950">
      <p>
        <b className="font-semibold">Several rows would join one technology.</b> That usually means a narrower technology
        was read as a broader one: reject the rows that are a different technology, and each comes in as its own. Rows
        that still share a technology when you confirm keep their values on this import&apos;s record; none is set on
        the technology.
      </p>
      <ul className="mt-2 space-y-1">
        {groups.map(([id, rows]) => (
          <li key={id} className="[overflow-wrap:anywhere]">
            <b className="font-semibold">{plural(rows.length, "row")} would join{" "}
              <TechLink item={{ ...rows[0], target_name: imp.targets[id]?.name ?? rows[0].target_name }} here={here} />
            </b>
            {imp.targets[id] && <span className="text-amber-900/80"> ({plural(imp.targets[id].page_count, "page")})</span>}:{" "}
            {rows.map((r) => r.name + (r.group === "matched" ? " (exact)" : "")).join(", ")}
          </li>
        ))}
      </ul>
    </div>
  );
}

function Proposed({ imp, editable, here, onChange }: { imp: Import; editable: boolean; here: string;
  onChange: (imp: Import) => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const shared = sharedTargets(imp.items);
  // the rows a technology shares come first, together, so they're judged side by side
  const rows = imp.items.filter((i) => i.group === "proposed").sort((a, b) =>
    (shared.get(b.target_tech_id ?? "")?.length ?? 1) - (shared.get(a.target_tech_id ?? "")?.length ?? 1)
    || (a.target_name ?? "").localeCompare(b.target_name ?? "") || a.row - b.row);
  const waiting = rows.filter((i) => !i.decision);

  const decide = async (which: number[], decision: "accept" | "reject") => {
    setBusy(true);
    setError(null);
    try {
      onChange(await sendJson<Import>(`/api/imports/${encodeURIComponent(imp._id)}/items`, "PUT", { rows: which, decision }));
    } catch (e) {
      setError(`Not saved: ${errorText(e)}.`);
    } finally {
      setBusy(false);
    }
  };

  if (!rows.length)
    return <Empty>The model proposed no matches: every name without an exact match comes in as new.</Empty>;
  // the bulk buttons decide the rows still waiting; once none wait, every row
  const bulk = waiting.length ? waiting : rows;
  const bulkWords = waiting.length && waiting.length < rows.length ? `the ${waiting.length.toLocaleString()} waiting`
    : `all ${rows.length.toLocaleString()}`;
  const groups = [...shared].filter(([, its]) => its.some((i) => i.group === "proposed"));

  return (
    <div>
      <p className="text-[13px] text-neutral-700">
        Each name below reads as a technology the radar already knows, in other words. Compare your row with what it
        would join: accept to join it (the name in your file becomes an alias, and its pages are filed under it);
        reject to keep it separate, as a new technology. Accept only when they are the same technology, not a narrower
        or related one.
        {" "}{waiting.length ? `${waiting.length.toLocaleString()} still ${waitsOrWait(waiting.length)} for a decision.`
          : "Every proposed match has a decision."}
      </p>
      <SharedNotice groups={groups} imp={imp} here={here} />
      {editable && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button type="button" disabled={busy} onClick={() => decide(bulk.map((r) => r.row), "accept")}
            className="rounded-full bg-navy px-3.5 py-1.5 text-sm text-white hover:bg-navy-strong disabled:opacity-50">
            Accept {bulkWords}
          </button>
          <button type="button" disabled={busy} onClick={() => decide(bulk.map((r) => r.row), "reject")} className={SECONDARY}>
            Reject {bulkWords}
          </button>
          {busy && <span className="text-xs text-muted">Saving…</span>}
        </div>
      )}
      {error && <p role="alert" className="mt-2 text-sm text-failed">{error}</p>}
      {/* relative: keeps the hidden column label inside the scroller, so the page never scrolls sideways */}
      <div className="relative mt-3 overflow-x-auto rounded-card border border-line bg-white">
        <table className="w-full min-w-[760px] text-sm">
          <thead>
            <tr className={TH}>
              <th className="w-[38%] px-5 py-2 font-medium">In your file</th>
              <th className="w-[34%] px-3 py-2 font-medium">Would join, as it is now</th>
              <th className="px-3 py-2 font-medium">Decision</th>
              {editable && <th className="px-5 py-2"><span className="sr-only">Accept or reject</span></th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {rows.map((it) => {
              const t = it.target_tech_id ? imp.targets[it.target_tech_id] : undefined;
              const tv = t && targetValues(t);
              const sharing = shared.get(it.target_tech_id ?? "")?.length ?? 0;
              return (
                <tr key={it.row} className="hover:bg-neutral-50">
                  <td className="px-5 py-2.5 align-top">
                    <span className="font-medium">{it.name}</span>
                    <span className="text-[11px] text-muted"> · Row {it.row}</span>
                    <span className="mt-0.5 block text-[12.5px] text-neutral-700">{fileValues(it.values)}</span>
                    <Description text={it.values.description} />
                  </td>
                  <td className="px-3 py-2.5 align-top">
                    <TechLink item={{ ...it, target_name: t?.name ?? it.target_name }} here={here} />
                    {t && <span className="text-[11px] text-muted"> · {plural(t.page_count, "page")}</span>}
                    {tv && <span className="mt-0.5 block text-[12.5px] text-neutral-700">{tv.line}</span>}
                    {tv?.from && <span className="block text-[11px] text-muted">{tv.from}</span>}
                    {sharing > 1 && it.decision !== "reject" && (
                      <span className="mt-1 inline-block rounded-full bg-amber-50 px-2 py-0.5 text-[11px] text-amber-900">
                        1 of {sharing} rows that would join it
                      </span>
                    )}
                    <span className="mt-1 block text-[11px] text-muted">
                      {it.why ? `Proposed at no cost: ${it.why}.` : "Proposed by the model."}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 align-top"><DecisionChip decision={it.decision} /></td>
                  {editable && (
                    <td className="whitespace-nowrap px-5 py-2.5 text-right align-top">
                      <span className="inline-flex gap-1.5">
                        {it.decision !== "accept" && (
                          <button type="button" disabled={busy} onClick={() => decide([it.row], "accept")} className={SMALL_PRIMARY}>
                            {it.decision ? "Accept instead" : "Accept"}
                          </button>
                        )}
                        {it.decision !== "reject" && (
                          <button type="button" disabled={busy} onClick={() => decide([it.row], "reject")} className={SMALL_SECONDARY}>
                            {it.decision ? "Reject instead" : "Reject: keep separate"}
                          </button>
                        )}
                      </span>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const LIST_LIMIT = 60;

/** A compact list of names; for matched ones, the technology each joins; for
 *  new ones, the technology code kept it apart from. */
function NameList({ items, joins, here }: { items: Item[]; joins: boolean; here: string }) {
  const [start, setStart] = useState(0); // a few names a page: the review stays short
  const shown = items.slice(start, start + LIST_LIMIT);
  return (
    <div className="rounded-card border border-line bg-white px-5 py-3">
      <ul className="grid gap-x-8 gap-y-1.5 text-sm sm:grid-cols-2 2xl:grid-cols-3">
        {shown.map((it) => (
          <li key={it.row} className="min-w-0 [overflow-wrap:anywhere]">
            {joins ? (
              it.target_name && it.target_name.toLowerCase() !== it.name.toLowerCase()
                ? <>{it.name} <span className="text-muted">→</span> <TechLink item={it} here={here} /></>
                : <TechLink item={{ ...it, target_name: it.name }} here={here} />
            ) : <>
              {it.name}
              {it.kept_apart && <span className="text-[12px] text-muted"> · narrower than {it.kept_apart.name}, kept apart</span>}
            </>}
          </li>
        ))}
      </ul>
      <Pager className="mt-3" start={start} total={items.length} size={LIST_LIMIT} go={setStart} what="names" />
    </div>
  );
}

type Lists = { availability: ListItem[]; domains: ListItem[]; subdomains: ListItem[] };

/** Values the file uses that our lists don't have: each mapped to one of ours,
 *  left out, or (a sub-domain) kept as written. A sub-domain waits for a
 *  person's choice; the others are left out until mapped. */
function ValuesTable({ imp, editable, onChange }: { imp: Import; editable: boolean; onChange: (imp: Import) => void }) {
  const [lists, setLists] = useState<Lists | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    Promise.all(["availability", "domains", "subdomains"].map((l) => fetchJson<{ items: ListItem[] }>(`/api/lists/${l}`)))
      .then(([a, d, s]) => { if (live) setLists({ availability: a.items, domains: d.items, subdomains: s.items }); })
      .catch((e) => { if (live) setListError(errorText(e)); });
    return () => { live = false; };
  }, []);

  const values = imp.unknown_values;
  if (!values.length) return <Empty>Every value is in our lists.</Empty>;

  const options = (u: Unknown): { value: string; name: string }[] => {
    if (u.field === "trl") return [1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => ({ value: String(n), name: `TRL ${n}` }));
    if (!lists) return [];
    const items = u.field === "availability" ? lists.availability : u.field === "domain" ? lists.domains
      : lists.subdomains.filter((s) => s.domain_id === u.domain_id);
    return items.map((i) => ({ value: i._id, name: i.name }));
  };
  const chosen = (u: Unknown) => u.map_to != null && u.map_to !== "" ? String(u.map_to)
    : u.field !== "subdomain" ? LEAVE : u.keep ? KEEP : u.keep === false ? LEAVE : "";
  const keyOf = (u: Unknown) => `${u.field}:${u.value}:${u.domain_id ?? ""}`;
  const save = async (u: Unknown, choice: string) => {
    setSaving(keyOf(u));
    setError(null);
    const keep = choice === KEEP;
    const map_to = keep || choice === LEAVE ? null : u.field === "trl" ? Number(choice) : choice;
    try {
      onChange(await sendJson<Import>(`/api/imports/${encodeURIComponent(imp._id)}/values`, "PUT",
        [{ field: u.field, value: u.value, domain_id: u.domain_id ?? null, map_to, keep }]));
    } catch (e) {
      setError(`Not saved: ${errorText(e)}.`);
    } finally {
      setSaving(null);
    }
  };
  const domainName = (id?: string) => lists?.domains.find((d) => d._id === id)?.name;
  const c = imp.counts;

  return (
    <div>
      <p className="text-[13px] text-neutral-700">
        Your file uses these values, which our lists don&apos;t have. Choose one of ours for each; a value left out is
        not set on its technologies. A sub-domain waits for your choice: one of ours, kept as written (a new
        sub-domain), or left out.
        {(c.values_waiting ?? 0) > 0 && ` ${plural(c.values_waiting ?? 0, "sub-domain")} still ${waitsOrWait(c.values_waiting ?? 0)}.`}
        {c.values_to_map > 0 && ` ${plural(c.values_to_map, "value")} ${isOrAre(c.values_to_map)} left out so far.`}
      </p>
      {listError && <p role="alert" className="mt-2 text-sm text-failed">Our lists couldn&apos;t be loaded: {listError}.</p>}
      {error && <p role="alert" className="mt-2 text-sm text-failed">{error}</p>}
      <div className="mt-3 overflow-x-auto rounded-card border border-line bg-white">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className={TH}>
              <th className="px-5 py-2 font-medium">Where</th>
              <th className="px-3 py-2 font-medium">In your file</th>
              <th className="px-5 py-2 font-medium">Use instead</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {values.map((u) => {
              const key = keyOf(u);
              const value = chosen(u);
              const under = u.field === "subdomain" ? domainName(u.domain_id) : undefined;
              return (
                <tr key={key} className="hover:bg-neutral-50">
                  <td className="px-5 py-2.5 align-top">
                    {FIELD_WORDS[u.field]}
                    {under && <span className="block text-[11.5px] text-muted">under {under}</span>}
                  </td>
                  <td className="px-3 py-2.5 align-top">
                    &ldquo;{u.value}&rdquo;
                    <span className="block text-[11px] text-muted">{plural(u.count, "row")}</span>
                  </td>
                  <td className="px-5 py-2.5 align-top">
                    <select aria-label={`Use instead of ${u.value}`} value={value}
                      disabled={!editable || saving === key || (u.field !== "trl" && !lists)}
                      onChange={(e) => save(u, e.target.value)}
                      className="max-w-full rounded-full border border-line bg-white px-3 py-1.5 text-[13px] text-ink disabled:opacity-60">
                      {value === "" && <option value="" disabled>Choose…</option>}
                      <option value={LEAVE}>Leave it out</option>
                      {u.field === "subdomain" && <option value={KEEP}>Keep as written</option>}
                      {options(u).map((o) => <option key={o.value} value={o.value}>{o.name}</option>)}
                    </select>
                    {saving === key ? <span className="block text-[11px] text-muted">Saving…</span>
                      : value === "" ? <span className="block text-[11px] text-amber-800">Waiting for your choice</span>
                        : value === LEAVE ? <span className="block text-[11px] text-amber-800">Not set on its technologies</span>
                          : value === KEEP ? <span className="block text-[11px] text-muted">Added as a new sub-domain</span> : null}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

type Tab = "matched" | "proposed" | "new" | "values";

export function Review({ imp, editable, here, onChange }: { imp: Import; editable: boolean; here: string;
  onChange: (imp: Import) => void }) {
  const c = imp.counts;
  // opens where there is something to do; stays put while you work through it
  const [on, setTab] = useState<Tab>(() => waitingOf(c) ? "proposed" : c.values_waiting || c.values_to_map ? "values"
    : c.proposed ? "proposed" : imp.unknown_values.length ? "values" : c.new ? "new" : "matched");
  const tabs: [Tab, string, number][] = [["matched", "Matched exactly", c.matched], ["proposed", "Proposed matches", c.proposed],
    ["new", "New", c.new], ["values", "Values not in our lists", imp.unknown_values.length]];
  const exactShared = [...sharedTargets(imp.items)].filter(([, its]) => its.some((i) => i.group === "matched"));
  const keptApart = imp.items.filter((i) => i.group === "new" && i.kept_apart).length;

  return (
    <section className="mt-7">
      <h2 className="text-lg font-semibold">Review</h2>
      <div className="mt-2 flex flex-wrap gap-1.5" role="group" aria-label="What to review">
        {tabs.map(([t, text, n]) => (
          <button key={t} type="button" aria-pressed={on === t} onClick={() => setTab(t)}
            className={`rounded-full border px-3 py-1 text-[13px] ${on === t ? "border-navy bg-navy text-white" : "border-line bg-white hover:bg-ground"}`}>
            {text} <span className={`tabular-nums ${on === t ? "text-white/75" : "text-muted"}`}>{n.toLocaleString()}</span>
          </button>
        ))}
      </div>
      <div className="mt-3">
        {on === "proposed" && <Proposed imp={imp} editable={editable} here={here} onChange={onChange} />}
        {on === "matched" && (c.matched ? <>
          <p className="mb-3 text-[13px] text-neutral-700">
            Already known to the radar, by name or alias: each joins the technology shown, and its row&apos;s values are
            set on it, unless another row joins it too. No model call was needed.
          </p>
          <SharedNotice groups={exactShared} imp={imp} here={here} />
          <div className="mt-3"><NameList items={imp.items.filter((i) => i.group === "matched")} joins here={here} /></div>
        </> : <Empty>No name in the file matched a technology the radar already knows exactly.</Empty>)}
        {on === "new" && (c.new ? <>
          <p className="mb-3 text-[13px] text-neutral-700">
            New to the radar: each comes in as a new technology with no pages yet
            {c.rejected > 0 && `, as ${c.rejected === 1 ? "does the" : `do the ${c.rejected.toLocaleString()}`} rejected proposed ${c.rejected === 1 ? "match" : "matches"}`}.
            {keptApart > 0 && ` For ${plural(keptApart, "name")}, the model proposed a broader technology; code kept ${keptApart === 1 ? "it" : "them"} apart, because the name adds a word in front or says what it is for, in, at or on.`}
          </p>
          <NameList items={imp.items.filter((i) => i.group === "new")} joins={false} here={here} />
        </> : <Empty>
          No new names{c.rejected > 0 && `, besides the ${plural(c.rejected, "rejected proposed match", "rejected proposed matches")}, which come in as new`}.
        </Empty>)}
        {on === "values" && <ValuesTable imp={imp} editable={editable} onChange={onChange} />}
      </div>
    </section>
  );
}

/** One import, open: what was read, then the step it is at. */
