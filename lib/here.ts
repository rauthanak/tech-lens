"use client";

import { usePathname, useSearchParams } from "next/navigation";

// Back links return you to the exact results you came from: links into a
// detail page carry the full address they were on as `from` (window and
// filters included), and BackLink goes straight back to it.

/** The current address, path and query. Needs a <Suspense> boundary. */
export function useHere(): string {
  const path = usePathname() ?? "/admin";
  const query = useSearchParams().toString();
  return query ? `${path}?${query}` : path;
}

export const withFrom = (href: string, from: string) =>
  `${href}${href.includes("?") ? "&" : "?"}from=${encodeURIComponent(from)}`;

/** Only the portal's own addresses are followed back. */
export const safeFrom = (from: string | null) =>
  from && (from === "/admin" || from.startsWith("/admin/") || from.startsWith("/admin?")) ? from : null;

const SECTIONS: [string, string][] = [
  ["/admin/signals/list", "Signal list"],
  ["/admin/technologies", "Technologies"],
  ["/admin/scoring/pov", "Points of View"],
  ["/admin/scoring/assessments", "Assessment runs"],
  ["/admin/operations", "Operations"],
  ["/admin/runs", "Collections"],
  ["/admin", "Briefing"],
];

/** The section an address belongs to, for the back link's label. */
export const sectionOf = (href: string) =>
  SECTIONS.find(([prefix]) => href === prefix || href.startsWith(prefix + "/") || href.startsWith(prefix + "?"))?.[1]
  ?? "Back";
