"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// Classification's tabs, inside Setup: the lists Classify and assessments
// file technologies under.
const TABS = [
  { href: "/admin/classification", label: "Commercial availability" },
  { href: "/admin/classification/domains", label: "Domains and sub-domains" },
  { href: "/admin/classification/trl", label: "TRL levels" },
];

export default function ClassificationLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? "";
  return (
    <div>
      <div className="font-mono text-[11px] uppercase tracking-[0.3em] text-neutral-500">Classification</div>
      <div className="mt-3 flex flex-wrap gap-1 border-b border-neutral-200">
        {TABS.map((tab) => {
          const active = tab.href === "/admin/classification" ? pathname === tab.href : pathname.startsWith(tab.href);
          return (
            <Link key={tab.href} href={tab.href}
              className={`-mb-px border-b-2 px-3.5 py-2 text-sm ${active ? "border-azure font-medium text-ink" : "border-transparent text-neutral-600 hover:text-black"}`}>
              {tab.label}
            </Link>
          );
        })}
      </div>
      <div className="mt-6">{children}</div>
    </div>
  );
}
