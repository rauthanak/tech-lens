import { createContext, createElement, Fragment, type ReactNode } from "react";

// A Point of View cites its numbered sources as "[3]" in its text.
const CITE = /\[(\d+)\]/g;

type Numbered = { n: number; url: string; title?: string; doc_id?: string };

/** On a Point of View, its sources' numbers by page id and by address, so a
 *  cited page shows the same number everywhere on it (components/PageRefs);
 *  elsewhere none, and each list of pages counts from 1. */
export const SourceNumbers = createContext<Map<string, number> | null>(null);

export const sourceNumbers = (sources: Numbered[]) =>
  new Map(sources.flatMap((s) => [...(s.doc_id ? [[s.doc_id, s.n] as const] : []), ...(s.url ? [[s.url, s.n] as const] : [])]));

/** Source numbers (built by the backend) as "[1] [4]" links, as in the text. */
export const renderRefs = (nums: number[] | undefined, sources: Numbered[]): ReactNode =>
  nums?.length ? renderCitations(nums.map((n) => `[${n}]`).join(" "), sources) : null;

/** `text` with each "[3]" a link to source 3's page, opening in a new tab
 *  (its title, when given, shows on hover). A number with no source, or a
 *  source with no address, stays plain text. */
export function renderCitations(text: string, sources: Numbered[]): ReactNode {
  const byNumber = new Map(sources.map((s) => [s.n, s]));
  const parts: ReactNode[] = [];
  let last = 0;
  for (const m of text.matchAll(CITE)) {
    const source = byNumber.get(Number(m[1]));
    if (!source?.url) continue;
    const at = m.index ?? 0;
    if (at > last) parts.push(text.slice(last, at));
    parts.push(createElement("a", {
      href: source.url, target: "_blank", rel: "noreferrer", title: source.title || undefined,
      className: "text-link hover:underline",
    }, m[0]));
    last = at + m[0].length;
  }
  if (parts.length === 0) return text;
  if (last < text.length) parts.push(text.slice(last));
  // children passed one by one, not as an array, need no keys
  return createElement(Fragment, null, ...parts);
}
