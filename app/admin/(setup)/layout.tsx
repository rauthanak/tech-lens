"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useChangesCount } from "@/lib/changes";

// Setup: everything that configures the radar, under one side menu. A route
// group, so every address stays as it was.
const under = (prefix: string) => (path: string) => path === prefix || path.startsWith(prefix + "/");

const ITEMS = [
  { href: "/admin/sources", label: "Sources",
    active: (p: string) => under("/admin/sources")(p) && !under("/admin/sources/settings")(p) },
  { href: "/admin/signals/list", label: "Signal list", active: under("/admin/signals/list") },
  { href: "/admin/scoring", label: "Scoring method", active: under("/admin/scoring") },
  { href: "/admin/prompts", label: "Skills", active: under("/admin/prompts") },
  { href: "/admin/sources/settings", label: "Crawl settings", active: under("/admin/sources/settings") },
  { href: "/admin/changes", label: "Changes", active: under("/admin/changes") },
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
        {ITEMS.map((item) => {
          const active = item.active(pathname);
          return (
            <Link key={item.href} href={item.href}
              className={`flex items-center gap-2 rounded-full px-3 py-1.5 text-sm lg:rounded-none lg:border-l-2 ${
                active ? "bg-white font-medium text-ink lg:border-azure lg:bg-transparent"
                  : "text-muted hover:text-ink lg:border-transparent"}`}>
              <span className="flex-1">{item.label}</span>
              {item.label === "Changes" && changes > 0 && (
                <span title="Edits not yet in the seeding data"
                  className="rounded-full bg-azure px-1.5 font-mono text-[10px] text-ink">
                  {changes}
                </span>
              )}
            </Link>
          );
        })}
      </nav>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
