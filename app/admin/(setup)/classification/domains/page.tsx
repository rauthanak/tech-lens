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
  const [note, setNote] = useState<string | null>(null);
  const load = () => Promise.all([fetchJson<{ items: ListItem[] }>("/api/lists/domains"), fetchJson<{ items: ListItem[] }>("/api/lists/subdomains")])
    .then(([d, s]) => { setDomains(d.items); setSubs(s.items); }).catch(() => {});
  useEffect(() => { load(); }, []);
  const proposed = subs.filter((s) => s.status === "new");
  const shown = subs.filter((s) => (!onlyNew || s.status === "new") && (!q || s.name.toLowerCase().includes(q.toLowerCase())));
  const act = (fn: () => Promise<unknown>, done: string) => fn().then(() => { setNote(done); configChanged(); load(); })
    .catch((e) => setNote(`Not done: ${errorText(e)}`));

  return (
    <div>
      <PageHeader title="Domains and sub-domains"
        intro="Tata's subject areas, each with its sub-domains. Classify and assessments file every technology under one."
        help={<>
          <li>Nine domains from the catalog, Tata&apos;s own list of emerging technologies (the three blockchain spellings merged), plus Other when none fits.
            Sub-domains come from Tata&apos;s file, grouped under their domain.</li>
          <li>When no sub-domain fits, the model proposes a new one, marked &ldquo;new&rdquo;. Accept it, merge it into an
            existing one (its technologies move there at no cost), or rename it. The Briefing&apos;s To do counts the ones
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
        <span className="text-sm text-muted">{plural(subs.length, "sub-domain")} · {proposed.length} proposed by the model</span>
        <label className="flex items-center gap-1.5 text-sm">
          <input type="checkbox" checked={onlyNew} onChange={(e) => setOnlyNew(e.target.checked)} /> Only the new ones
        </label>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search sub-domains…"
          className="ml-auto rounded-full border border-line bg-white px-3 py-1 text-sm" />
      </div>
      {note && <p role="status" className="mt-2 text-sm text-muted">{note}</p>}
      <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-2 xl:grid-cols-3">
        {domains.map((d) => {
          const mine = shown.filter((s) => s.domain_id === d._id);
          if (mine.length === 0) return null;
          return (
            <details key={d._id} open={Boolean(q) || onlyNew} className="self-start rounded-card border border-line bg-white px-4 py-3">
              <summary className="cursor-pointer text-sm font-semibold">
                {d.name} <span className="font-normal text-muted">· {plural(mine.length, "sub-domain")}
                  {(() => { const n = mine.filter((s) => s.status === "new").length; return n ? `, ${n} new to review` : ""; })()}</span>
              </summary>
              <ul className="mt-1.5 space-y-1 text-[13px]">
                {mine.map((s) => (
                  <li key={s._id} className="flex flex-wrap items-baseline gap-x-2">
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
                        <button type="button" className="text-link hover:underline"
                          onClick={() => act(() => sendJson(`/api/lists/subdomains/${s._id}`, "PUT", { name: s.name, status: "seeded" }), `${s.name} accepted.`)}>Accept</button>
                        <select aria-label={`Merge ${s.name} into`} value="" className="rounded border border-line bg-white px-1 text-xs"
                          onChange={(e) => e.target.value && act(() => sendJson(`/api/lists/subdomains/${s._id}/merge`, "POST", { into: e.target.value }), `${s.name} merged.`)}>
                          <option value="">Merge into…</option>
                          {subs.filter((x) => x.domain_id === s.domain_id && x._id !== s._id && x.status !== "new").map((x) => <option key={x._id} value={x._id}>{x.name}</option>)}
                        </select>
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
