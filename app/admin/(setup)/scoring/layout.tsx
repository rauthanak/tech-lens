"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// The scoring method's tabs, inside Setup. Assessments and Points of View
// live outside Setup, so this layout never wraps them.
const TABS = [
  { href: "/admin/scoring", label: "Method" },
  { href: "/admin/scoring/fabrics", label: "Fabrics" },
  { href: "/admin/scoring/measures", label: "Measures" },
  { href: "/admin/scoring/config", label: "Weights & Grid" },
  { href: "/admin/scoring/pending", label: "Open questions" },
];

export default function ScoringLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? "";
  return (
    <div>
      <div className="font-mono text-[11px] uppercase tracking-[0.3em] text-neutral-500 print:hidden">
        Scoring method
      </div>
      <div className="mt-3 flex flex-wrap gap-1 border-b border-neutral-200 print:hidden">
        {TABS.map((tab) => {
          const active = tab.href === "/admin/scoring"
            ? pathname === "/admin/scoring"
            : pathname.startsWith(tab.href);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`-mb-px border-b-2 px-3.5 py-2 text-sm ${
                active
                  ? "border-azure font-medium text-ink"
                  : "border-transparent text-neutral-600 hover:text-black"
              }`}
            >
              {tab.label}
            </Link>
          );
        })}
      </div>
      <div className="mt-6">{children}</div>
    </div>
  );
}
