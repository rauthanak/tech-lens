"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import ListCounts from "@/components/ListCounts";
import ListItems from "@/components/ListItems";
import PageHeader from "@/components/PageHeader";
import { configChanged, errorText, fetchJson, sendJson } from "@/lib/api";
import type { ListItem } from "@/lib/classification";
import { plural } from "@/lib/format";

/** Tata's domains, and the sub-domains under each; the model's proposed
 *  sub-domains wait here to be accepted, merged into another or renamed. */
export default function DomainsPage() {
  const [domains, setDomains] = useState<ListItem[]>([]);
  const [subs, setSubs] = useState<ListItem[]>([]);
  const [onlyNew, setOnlyNew] = useState(false);
  const [q, setQ] = useState("");
  const [note, setNote] = useState<{ text: string; undo?: () => Promise<unknown> } | null>(null);
  const [picked, setPicked] = useState<Set<string>>(new Set());   // proposed sub-domains ticked for Accept or Merge
  const [asking, setAsking] = useState<{ ids: string[]; into?: string } | null>(null); // waits for a yes: into = merge, else accept
  const load = () => Promise.all([fetchJson<{ items: ListItem[] }>("/api/lists/domains"), fetchJson<{ items: ListItem[] }>("/api/lists/subdomains")])
    .then(([d, s]) => { setDomains(d.items); setSubs(s.items); }).catch(() => {});
  useEffect(() => { load(); }, []);
  const proposed = subs.filter((s) => s.status === "new");
  const shown = subs.filter((s) => (!onlyNew || s.status === "new") && (!q || s.name.toLowerCase().includes(q.toLowerCase())));
  const nameOf = (id: string) => subs.find((x) => x._id === id)?.name ?? id;
  const act = (fn: () => Promise<unknown>, done: string, undo?: () => Promise<unknown>) =>
    fn().then(() => { setNote({ text: done, undo }); configChanged(); load(); })
      .catch((e) => setNote({ text: `Not done: ${errorText(e)}` }));
  const accept = (ids: string[]) => act(() => sendJson("/api/lists/subdomains/status", "POST", { ids, status: "seeded" }),
    ids.length === 1 ? `${nameOf(ids[0])} accepted.` : `${plural(ids.length, "sub-domain")} accepted.`,
    () => sendJson("/api/lists/subdomains/status", "POST", { ids, status: "new" }));
  const merge = (ids: string[], into: string) => {
    let undo: unknown = null;
    return act(async () => { undo = (await sendJson<{ undo: unknown }>("/api/lists/subdomains/merge", "POST", { ids, into })).undo; },
      `${ids.length === 1 ? nameOf(ids[0]) : plural(ids.length, "sub-domain")} merged into ${nameOf(into)}.`,
      () => sendJson("/api/lists/subdomains/unmerge", "POST", undo));
  };
  const yes = () => {
    if (!asking) return;
    (asking.into ? merge(asking.ids, asking.into) : accept(asking.ids)).then(() => setPicked(new Set()));
    setAsking(null);
  };
  const pick = (ids: string[], on: boolean) => setPicked((prev) => {
    const next = new Set(prev);
    for (const id of ids) if (on) next.add(id); else next.delete(id);
    return next;
  });
  // where a proposed sub-domain can merge: the accepted ones, by domain
  const targets = domains.map((d) => ({ d, list: subs.filter((x) => x.domain_id === d._id && x.status !== "new") }))
    .filter((g) => g.list.length > 0);

  return (
    <div>
      <PageHeader title="Domains and sub-domains"
        intro={<>Tata&apos;s subject areas, each with its sub-domains. Classify and assessments file every technology under one.
          Not the same as <Link href="/admin/scoring/fabrics" className="text-link hover:underline">fabrics</Link>: a domain
          files a technology by subject, for browsing; a fabric is a business line it&apos;s scored in.</>}
        help={<>
          <li>Nine domains from the catalog, Tata&apos;s own list of emerging technologies (the three blockchain spellings merged), plus Other when none fits.
            Sub-domains come from Tata&apos;s file, grouped under their domain.</li>
          <li>When no sub-domain fits, the model proposes a new one, marked &ldquo;new&rdquo;. Accept it, merge it into an
            existing one (its technologies move there at no cost), or rename it. Tick several, or all the new ones in a
            domain, to accept or merge them together; each asks first and can be undone. The Briefing&apos;s To do counts the ones
            waiting. Each one accepted shows on Changes until it&apos;s kept as a default.</li>
          <li>A person can move any technology to another domain or sub-domain on its page; that choice wins.</li>
        </>} />
      <h2 className="mt-6 text-base font-semibold">Domains</h2>
      <ListCounts list="domains" />
      <div className="mt-2">
        <ListItems list="domains" noun="a domain" technologies={false} fields={[
          { key: "name", label: "Name" },
          { key: "definition", label: "Definition", kind: "long", note: "What the model reads: what belongs here." },
          { key: "order", label: "Order", kind: "number" },
        ]} />
      </div>

      <div className="mt-10 flex flex-wrap items-baseline gap-3">
        <h2 className="text-base font-semibold">Sub-domains</h2>
        <span className="text-sm text-muted">{plural(subs.length, "sub-domain")} · {proposed.length.toLocaleString()} proposed by the model</span>
        <label className="flex items-center gap-1.5 text-sm">
          <input type="checkbox" checked={onlyNew} onChange={(e) => setOnlyNew(e.target.checked)} /> Only the new ones
        </label>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search sub-domains…"
          className="ml-auto rounded-full border border-line bg-white px-3 py-1 text-sm" />
      </div>
      {note && (
        <p role="status" className="mt-2 flex flex-wrap items-baseline gap-x-3 text-sm text-muted">
          {note.text}
          {note.undo && (
            <button type="button" className="text-link hover:underline"
              onClick={() => { const u = note.undo!; setNote(null); act(u, "Undone."); }}>Undo</button>
          )}
        </p>
      )}
      {(picked.size > 0 || asking) && (
        <div role="region" aria-label="Selected sub-domains" className="sticky top-0 z-10 mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-card border border-line bg-white px-4 py-2.5 text-sm shadow-sm">
          {asking ? (
            <>
              <span>
                {asking.into
                  ? `Merge ${asking.ids.length === 1 ? nameOf(asking.ids[0]) : plural(asking.ids.length, "sub-domain")} into ${nameOf(asking.into)}? Their technologies move there, at no model cost; Undo puts them back.`
                  : `Accept ${plural(asking.ids.length, "proposed sub-domain")}? They join Tata's list; Undo marks them new again.`}
              </span>
              <button type="button" onClick={yes} className="rounded-full bg-navy px-3 py-1 text-white">{asking.into ? "Merge" : "Accept"}</button>
              <button type="button" onClick={() => setAsking(null)} className="text-muted hover:text-ink">Cancel</button>
            </>
          ) : (
            <>
              <span className="font-medium">{plural(picked.size, "selected", "selected")}</span>
              <button type="button" onClick={() => setAsking({ ids: [...picked] })} className="rounded-full border border-line px-3 py-1 hover:bg-ground">Accept</button>
              <MergeInto label="Merge the selected into" targets={targets} exclude={picked}
                onPick={(into) => setAsking({ ids: [...picked], into })} />
              <button type="button" onClick={() => setPicked(new Set())} className="text-muted hover:text-ink">Clear</button>
            </>
          )}
        </div>
      )}
      <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-2 xl:grid-cols-3">
        {domains.map((d) => {
          const mine = shown.filter((s) => s.domain_id === d._id);
          if (mine.length === 0) return null;
          const fresh = mine.filter((s) => s.status === "new");
          return (
            <details key={d._id} open={Boolean(q) || onlyNew} className="self-start rounded-card border border-line bg-white px-4 py-3">
              <summary className="cursor-pointer text-sm font-semibold">
                {d.name} <span className="font-normal text-muted">· {plural(mine.length, "sub-domain")}
                  {fresh.length ? `, ${fresh.length.toLocaleString()} new to review` : ""}</span>
              </summary>
              {fresh.length > 1 && (
                <label className="mt-1.5 flex items-center gap-1.5 text-xs text-muted">
                  <input type="checkbox" checked={fresh.every((x) => picked.has(x._id))}
                    onChange={(e) => pick(fresh.map((x) => x._id), e.target.checked)} />
                  Select the {fresh.length.toLocaleString()} new ones
                </label>
              )}
              <ul className="mt-1.5 space-y-1 text-[13px]">
                {mine.map((s) => (
                  <li key={s._id} className="flex flex-wrap items-baseline gap-x-2">
                    {s.status === "new" && (
                      <input type="checkbox" aria-label={`Select ${s.name}`} checked={picked.has(s._id)}
                        onChange={(e) => pick([s._id], e.target.checked)} className="self-center" />
                    )}
                    <span>{s.name}</span>
                    {(s.technologies ?? 0) > 0 && (
                      <Link href={`/admin/technologies?domain=${encodeURIComponent(d._id)}&subdomain=${encodeURIComponent(s._id)}`}
                        title={`Open the ${s.technologies} technologies in ${s.name}`} className="text-xs tabular-nums text-link hover:underline">
                        {s.technologies}
                      </Link>
                    )}
                    {s.status === "new" && (
                      <span className="flex flex-wrap items-baseline gap-x-2 text-xs">
                        <span className="rounded bg-azure/15 px-1 text-navy">new</span>
                        <button type="button" className="text-link hover:underline" onClick={() => accept([s._id])}>Accept</button>
                        <MergeInto label={`Merge ${s.name} into`} small exclude={new Set([s._id])}
                          targets={targets.filter((g) => g.d._id === s.domain_id)}
                          onPick={(into) => setAsking({ ids: [s._id], into })} />
                        <button type="button" className="text-link hover:underline"
                          onClick={() => { const n = window.prompt("New name", s.name); if (n && n.trim()) act(() => sendJson(`/api/lists/subdomains/${s._id}`, "PUT", { name: n.trim() }), "Renamed."); }}>Rename</button>
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </details>
          );
        })}
      </div>
    </div>
  );
}

/** "Merge into…": the accepted sub-domains, by domain. Picking one only asks; the merge waits for a yes. */
function MergeInto({ label, targets, exclude, onPick, small }: {
  label: string; targets: { d: ListItem; list: ListItem[] }[]; exclude: Set<string>; onPick: (into: string) => void; small?: boolean;
}) {
  return (
    <select aria-label={label} value="" onChange={(e) => e.target.value && onPick(e.target.value)}
      className={`rounded border border-line bg-white ${small ? "w-28 px-1 text-xs" : "max-w-[16rem] px-2 py-1 text-sm"}`}>
      <option value="">Merge into…</option>
      {targets.map(({ d, list }) => (
        <optgroup key={d._id} label={d.name}>
          {list.filter((x) => !exclude.has(x._id)).map((x) => <option key={x._id} value={x._id}>{x.name}</option>)}
        </optgroup>
      ))}
    </select>
  );
}
