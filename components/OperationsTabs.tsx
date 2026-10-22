"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// Operations' three pages, as tabs in the same style as Setup's scoring tabs.
const TABS = [
  { href: "/admin/operations", label: "Overview" },
  { href: "/admin/runs", label: "Collections" },
  { href: "/admin/scoring/assessments", label: "Assessment runs" },
];

export default function OperationsTabs() {
  const pathname = usePathname() ?? "";
  return (
    <div className="mb-6 flex flex-wrap gap-1 border-b border-neutral-200 print:hidden">
      {TABS.map((tab) => (
        <Link key={tab.href} href={tab.href}
          className={`-mb-px border-b-2 px-3.5 py-2 text-sm ${pathname === tab.href
            ? "border-azure font-medium text-ink" : "border-transparent text-neutral-600 hover:text-black"}`}>
          {tab.label}
        </Link>
      ))}
    </div>
  );
}
