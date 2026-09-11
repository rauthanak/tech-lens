"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV: { href: string; label: string }[] = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/runs", label: "Runs" },
  { href: "/admin/sources", label: "Sources" },
  { href: "/admin/technologies", label: "Technologies" },
  { href: "/admin/scoring", label: "Scoring" },
  { href: "/admin/prompts", label: "Skills" },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-60 shrink-0 bg-[#171513] px-5 py-8 text-neutral-400 print:hidden">
      <Link href="/admin" className="block px-2.5">
        <span className="text-[15px] font-bold tracking-[0.3em] text-white">
          TECH&nbsp;LENS
        </span>
        <span className="mt-1.5 block font-mono text-[10px] tracking-[0.35em] text-neutral-500">
          ADMIN
        </span>
      </Link>
      <nav className="mt-9 flex flex-col gap-1">
        {NAV.map((item) => {
          const active =
            item.href === "/admin"
              ? pathname === "/admin"
              : pathname?.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 rounded-sm px-2.5 py-2 text-[13.5px] ${
                active
                  ? "bg-[#2e2b28] font-medium text-white"
                  : "hover:bg-[#211f1c] hover:text-neutral-200"
              }`}
            >
              <span
                className={`h-[7px] w-[7px] rounded-full ${
                  active ? "bg-white" : "bg-[#4d4a45]"
                }`}
              />
              <span className="flex-1">{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
