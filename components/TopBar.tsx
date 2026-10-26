"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import PersonMenu from "@/components/PersonMenu";
import StatusPill from "@/components/StatusPill";
import { useChangesCount } from "@/lib/changes";

type Item = { href: string; label: string; active: (path: string) => boolean };

const under = (prefix: string) => (path: string) => path === prefix || path.startsWith(prefix + "/");
const SETUP_ROUTES = ["/admin/sources", "/admin/signals/list", "/admin/scoring/fabrics",
  "/admin/scoring/measures", "/admin/scoring/config", "/admin/scoring/pending", "/admin/prompts",
  "/admin/changes", "/admin/classification", "/admin/path", "/admin/mechanisms", "/admin/finance"];

// One technology's result in one fabric (/admin/scoring/assessments/{run}/{id})
// is read as part of that technology, so Technologies stays lit there; the
// runs list and a run's page are Operations' history.
const oneAssessment = (path: string) => /^\/admin\/scoring\/assessments\/[^/]+\/[^/]+/.test(path);

// What the radar found, then how it runs. Assessment runs live on
// Operations, and single assessments on each technology's page. Findings
// are read on the Briefing; the signal list is in Setup.
const MAIN: Item[] = [
  { href: "/admin", label: "Briefing", active: (p) => p === "/admin" },
  { href: "/admin/technologies", label: "Technologies",
    active: (p) => under("/admin/technologies")(p) || under("/admin/import")(p) || oneAssessment(p) },
  { href: "/admin/scoring/pov", label: "Points of View", active: under("/admin/scoring/pov") },
];

const WORK: Item[] = [
  { href: "/admin/operations", label: "Operations",
    active: (p) => !oneAssessment(p) && ["/admin/operations", "/admin/runs", "/admin/scoring/assessments"].some((r) => under(r)(p)) },
  { href: "/admin/sources", label: "Setup",
    active: (p) => p === "/admin/scoring" || SETUP_ROUTES.some((r) => under(r)(p)) },
];

/** The brand header with the top menu and the status pill, above every admin page. */
export default function TopBar() {
  const pathname = usePathname() ?? "";
  const changes = useChangesCount();
  const [open, setOpen] = useState(false);

  const menu = (items: Item[]) =>
    items.map((item) => (
      <Link key={item.href} href={item.href} onClick={() => setOpen(false)}
        className={`flex items-center gap-2 border-b-2 px-3 py-2 text-sm ${item.active(pathname)
          ? "border-azure text-white" : "border-transparent text-white/70 hover:text-white"}`}>
        {item.label}
        {item.label === "Setup" && changes.count > 0 && (
          <span title={`${changes.count.toLocaleString()} setup ${changes.count === 1 ? "edit" : "edits"} not yet kept as the defaults`}
            aria-label={`${changes.count.toLocaleString()} unsaved setup changes`}
            className="rounded-full bg-azure px-1.5 font-mono text-[10px] text-ink">
            {changes.count.toLocaleString()}
          </span>
        )}
      </Link>
    ));

  return (
    <header className="brand-header print:hidden">
      <div className="mx-auto flex h-14 max-w-[1760px] items-stretch gap-6 px-6 lg:px-10">
        <Link href="/admin" className="flex shrink-0 items-center gap-3 whitespace-nowrap text-lg font-semibold tracking-[-0.02em] text-white">
          Tech Lens
        </Link>
        <nav className="hidden items-stretch lg:flex">
          {menu(MAIN)}
          <span aria-hidden className="mx-2 my-auto h-5 w-px bg-white/25" />
          {menu(WORK)}
        </nav>
        <div className="ml-auto flex items-center gap-4">
          <a href="/frontier" target="_blank" rel="noreferrer"
            className="hidden whitespace-nowrap text-sm text-white/70 hover:text-white sm:inline">Leaders&apos; view ↗</a>
          <StatusPill />
          <PersonMenu />
          <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} aria-label="Menu"
            className="text-lg text-white/80 hover:text-white lg:hidden">
            {open ? "✕" : "☰"}
          </button>
        </div>
      </div>
      {open && (
        <nav className="flex flex-col items-start border-t border-white/10 px-6 pb-3 pt-1 lg:hidden">
          {menu(MAIN)}
          <span aria-hidden className="my-1 h-px w-full bg-white/15" />
          {menu(WORK)}
          <span aria-hidden className="my-1 h-px w-full bg-white/15" />
          <a href="/frontier" target="_blank" rel="noreferrer"
            className="px-3 py-2 text-sm text-white/70 hover:text-white">Leaders&apos; view ↗</a>
        </nav>
      )}
    </header>
  );
}
