"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Fragment, useEffect, useRef, useState } from "react";
import BackendError from "@/components/BackendError";
import { ApiError, errorText, fetchJson, sendJson } from "@/lib/api";
import { formatDay, plural } from "@/lib/format";
import { PreviewBlank, PreviewPart, SkillPreviewDoc } from "@/lib/prompts";

const KEYS = ["technology", "fabric", "measure", "source", "page", "horizon"] as const;
const FOLD = 600; // characters of a filled-in part shown before "Show all"
const field =
  "mt-1 w-full rounded border border-neutral-300 bg-white px-3 py-1.5 text-sm outline-none focus:border-neutral-500";

type Draft = { system: string | null; prompt: string } | null;

/** What a skill turns into: how many versions of it the radar sends, where
 *  its blanks are filled from, and a real example. The backend builds the
 *  example with the same code a run uses; `draft` (unsaved text) rebuilds it
 *  from that text instead. The switches live in the page address. */
export default function SkillPreview({ name, draft }: { name: string; draft: Draft }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const choices: Record<string, string> = {};
  for (const key of KEYS) {
    const value = params.get(key);
    if (value) choices[key] = value;
  }
  const query = new URLSearchParams(choices).toString();
  const draftKey = draft ? JSON.stringify(draft) : "";

  const [doc, setDoc] = useState<SkillPreviewDoc | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [refused, setRefused] = useState<string | null>(null); // 422: a draft's blanks, or a switch value
  const [loading, setLoading] = useState(true);
  const latest = useRef(0); // the newest request: older answers are dropped

  // the saved skill at once; a draft 600 ms after typing stops
  useEffect(() => {
    const mine = ++latest.current;
    const timer = setTimeout(() => {
      setLoading(true);
      const request = draft
        ? sendJson<SkillPreviewDoc>(`/api/prompts/${name}/preview`, "POST", { ...draft, ...choices })
        : fetchJson<SkillPreviewDoc>(`/api/prompts/${name}/preview${query ? `?${query}` : ""}`);
      request
        .then((d) => {
          if (mine !== latest.current) return;
          setDoc(d);
          setError(null);
          setRefused(null);
        })
        .catch((e) => {
          if (mine !== latest.current) return;
          if (e instanceof ApiError && e.status === 422) setRefused(errorText(e));
          else setError(e);
        })
        .finally(() => {
          if (mine === latest.current) setLoading(false);
        });
    }, draft ? 600 : 0);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name, query, draftKey]);

  const choose = (key: string, value: string) => {
    const next = new URLSearchParams(params.toString());
    next.set(key, value);
    if (key === "source") next.delete("page"); // a page belongs to its source
    router.replace(`${pathname}?${next.toString()}`, { scroll: false });
  };

  const blanks = new Map((doc?.blanks ?? []).map((b) => [b.name, b]));
  const groups: { from: string; href: string | null; names: string[] }[] = [];
  for (const b of doc?.blanks ?? []) {
    const group = groups.find((g) => g.from === b.from);
    if (group) group.names.push(b.name);
    else groups.push({ from: b.from, href: b.href, names: [b.name] });
  }

  return (
    <section className="mt-10" aria-labelledby="turns-into">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h2 id="turns-into" className="text-lg font-medium text-ink">What it turns into</h2>
        {draft && (
          <span className="rounded-full bg-azure/15 px-2 py-0.5 font-mono text-[11px] text-ink">
            Showing your unsaved edit
          </span>
        )}
      </div>
      <p className="mt-1 text-sm text-muted">
        Built from today&apos;s settings and the pages collected so far. No model calls.
      </p>

      {error != null && <BackendError error={error} />}
      {!doc && loading && error == null && <p className="mt-5 text-sm text-muted">Building the example…</p>}

      {doc && (
        <div className="mt-5 space-y-5">
          <Card title="How many versions">
            <p className="mt-2 text-sm text-neutral-700">{doc.fires}</p>
            <p className="mt-2 font-medium text-ink">{doc.versions.sentence}</p>
            {doc.versions.set_in.length > 0 && (
              <p className="mt-1 text-sm text-muted">
                Set in{" "}
                {doc.versions.set_in.map((s, i) => (
                  <Fragment key={s.from}>
                    {i > 0 && " · "}
                    <Place from={s.from} href={s.href} />
                  </Fragment>
                ))}
              </p>
            )}
            <p className="mt-3 text-sm text-neutral-700">{lastRun(doc.last_run)}</p>
          </Card>

          <Card title="Where the blanks are filled from">
            {groups.length === 0 ? (
              <p className="mt-2 text-sm text-neutral-600">None: the text is sent as it is.</p>
            ) : (
              <ul className="mt-2 divide-y divide-neutral-100 text-sm">
                {groups.map((g) => (
                  <li key={g.from} className="flex flex-col gap-1.5 py-2.5 sm:flex-row sm:items-start sm:gap-6">
                    <span className="flex flex-wrap gap-1.5 sm:w-2/5 sm:shrink-0">
                      {g.names.map((n) => (
                        <span key={n} title={blanks.get(n)?.what}
                          className="rounded-full bg-navy/5 px-2 py-0.5 font-mono text-[11px] text-ink">
                          {"{" + n + "}"}
                        </span>
                      ))}
                    </span>
                    <span className="min-w-0 text-neutral-700">
                      <Place from={g.from} href={g.href} />
                      <span className="block text-xs text-muted">
                        {g.names.map((n) => blanks.get(n)?.what).filter(Boolean).join(" · ")}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card title="A real one">
            {doc.switches.length > 0 && (
              <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {doc.switches.map((s) => (
                  <label key={s.key} className="block min-w-0 text-sm">
                    <span className="font-medium">{s.label}</span>
                    <select className={field} value={s.value ?? ""} disabled={s.options.length === 0}
                      onChange={(e) => choose(s.key, e.target.value)}>
                      {s.options.length === 0 && <option value="">none yet</option>}
                      {s.options.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}{o.scored_last_run ? " · scored in the last run" : ""}
                        </option>
                      ))}
                    </select>
                    {s.note && <span className="mt-1 block text-xs text-muted">{s.note}</span>}
                  </label>
                ))}
              </div>
            )}
            {loading && <p className="mt-3 text-sm text-muted">Building the example…</p>}
            {!doc.enabled && (
              <Note>Switched off: its step fails or is skipped when it runs. This is what it would send if it were on.</Note>
            )}
            {doc.example.stand_in && <Note>{doc.example.stand_in}</Note>}
            {doc.example.note && <Note>{doc.example.note}</Note>}
            {refused ? (
              <p className="mt-3 text-sm text-failed">{refused}</p>
            ) : doc.example.why_missing ? (
              <p className="mt-3 text-sm text-neutral-600">{doc.example.why_missing}</p>
            ) : (
              <>
                <pre key={`${query}|${draftKey}|${doc.version}`}
                  className="mt-3 max-h-[70vh] overflow-auto whitespace-pre-wrap break-words rounded border border-line bg-ground p-4 font-mono text-[12.5px] leading-relaxed text-ink">
                  {doc.example.parts.map((p, i) =>
                    p.blank ? <Filled key={i} part={p} blank={blanks.get(p.blank)} /> : <span key={i}>{p.text}</span>
                  )}
                </pre>
                <p className="mt-2 text-xs text-muted">
                  About {plural(doc.example.tokens_about, "token")} · {plural(doc.example.characters, "character")}
                  {doc.example.built_from ? ` · ${doc.example.built_from}` : ""}
                </p>
              </>
            )}
          </Card>
        </div>
      )}
    </section>
  );
}

function lastRun(r: SkillPreviewDoc["last_run"]): string {
  if (!r.run_id) return r.why_missing ?? "";
  const head = `Last ${r.kind}, ${formatDay(r.at)}${r.status === "running" ? " (still running)" : ""}`;
  if (r.prompts == null) return `${head}: ${r.why_missing ?? "not counted"}`;
  return `${head}: ${plural(r.prompts, "prompt")}.${r.note ? ` ${r.note}` : ""}`;
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-card border border-line bg-white px-6 py-5">
      <div className="font-mono text-[11px] uppercase tracking-wider text-neutral-500">{title}</div>
      {children}
    </div>
  );
}

function Place({ from, href }: { from: string; href: string | null }) {
  return href ? (
    <Link href={href} className="text-link underline underline-offset-4">{from}</Link>
  ) : (
    <>{from}</>
  );
}

function Note({ children }: { children: React.ReactNode }) {
  return <p className="mt-3 border-l-2 border-azure/60 pl-3 text-sm text-neutral-700">{children}</p>;
}

/** One filled-in blank: tinted, tagged with where it came from, folded when long. */
function Filled({ part, blank }: { part: PreviewPart; blank?: PreviewBlank }) {
  const [open, setOpen] = useState(false);
  const cut = part.cut ?? 0;
  const long = part.text.length > FOLD;
  const tag = `from ${blank?.tag ?? part.blank}`;
  return (
    <span className="rounded-sm bg-azure/10 box-decoration-clone">
      <span title={`{${part.blank}}${blank ? `: ${blank.what}` : ""}`}
        className="mr-1 select-none whitespace-nowrap rounded-sm bg-navy/10 px-1 font-sans text-[10.5px] text-muted">
        {blank?.href ? <Link href={blank.href} className="hover:text-ink hover:underline">{tag}</Link> : tag}
      </span>
      {open || !long ? part.text : `${part.text.slice(0, FOLD)}…`}
      {long && !open && (
        <button type="button" onClick={() => setOpen(true)}
          className="ml-1 select-none font-sans text-[11px] text-link underline underline-offset-2">
          Show all {(part.text.length + cut).toLocaleString()} characters
        </button>
      )}
      {open && cut > 0 && (
        <span className="select-none font-sans text-[11px] text-muted">
          {" "}… and {cut.toLocaleString()} more characters, which the model gets but which aren&apos;t shown here
        </span>
      )}
    </span>
  );
}
