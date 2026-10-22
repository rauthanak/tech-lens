"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useChangesCount } from "@/lib/changes";
import { FINANCE_SHOWN } from "@/lib/value";

// Setup: everything that configures the radar, under one side menu. A route
// group, so every address stays as it was.
const under = (prefix: string) => (path: string) => path === prefix || path.startsWith(prefix + "/");

// Four groups: what the radar reads, how it judges, Tata's own frame, and the system.
const GROUPS: { title: string; items: { href: string; label: string; active: (p: string) => boolean }[] }[] = [
  { title: "What the radar reads", items: [
  { href: "/admin/sources", label: "Sources",
    active: (p: string) => under("/admin/sources")(p) && !under("/admin/sources/settings")(p) },
  { href: "/admin/signals/list", label: "Signal list", active: under("/admin/signals/list") }] },
  { title: "How it judges", items: [
  { href: "/admin/scoring", label: "Scoring method", active: under("/admin/scoring") },
  { href: "/admin/classification", label: "Classification", active: under("/admin/classification") },
  { href: "/admin/prompts", label: "Skills", active: under("/admin/prompts") }] },
  { title: "Tata's frame", items: [
  { href: "/admin/path", label: "Path to scale", active: under("/admin/path") },
  { href: "/admin/mechanisms", label: "Mechanisms", active: under("/admin/mechanisms") },
  { href: "/admin/assumptions", label: "Assumptions", active: under("/admin/assumptions") },
  ...(FINANCE_SHOWN ? [{ href: "/admin/finance", label: "Finance", active: under("/admin/finance") }] : [])] }, // set aside for now
  { title: "System", items: [
  { href: "/admin/sources/settings", label: "Settings", active: under("/admin/sources/settings") },
  { href: "/admin/changes", label: "Changes", active: under("/admin/changes") }] },
];

export default function SetupLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? "";
  const changes = useChangesCount();
  return (
    <div className="flex flex-col gap-6 lg:flex-row lg:gap-10">
      <nav className="flex shrink-0 flex-wrap gap-1 print:hidden lg:w-44 lg:flex-col lg:gap-0.5">
        <div className="mb-2 hidden font-mono text-[11px] uppercase tracking-[0.3em] text-neutral-500 lg:block">
          Setup
        </div>
        {GROUPS.map((g) => (
          <div key={g.title} className="contents lg:mb-3 lg:block">
            <div className="mb-1 hidden pl-3 text-[11px] text-neutral-500 lg:block">{g.title}</div>
            {g.items.map((item) => {
              const active = item.active(pathname);
              return (
                <Link key={item.href} href={item.href}
                  className={`flex items-center gap-2 rounded-full px-3 py-1.5 text-sm lg:rounded-none lg:border-l-2 ${
                    active ? "bg-white font-medium text-ink lg:border-azure lg:bg-transparent"
                      : "text-muted hover:text-ink lg:border-transparent"}`}>
                  <span className="flex-1">{item.label}</span>
                  {item.label === "Changes" && changes > 0 && (
                    <span title="Setup edits not yet kept as the defaults"
                      className="rounded-full bg-azure px-1.5 font-mono text-[10px] text-ink">
                      {changes}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
