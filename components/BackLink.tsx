"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { safeFrom, sectionOf } from "@/lib/here";

/** "← Signals": back to the address in `from`, else to `fallback`
 *  (labelled `fallbackLabel`, or by its section). Needs a <Suspense> boundary. */
export default function BackLink({ fallback, fallbackLabel }: { fallback: string; fallbackLabel?: string }) {
  const from = safeFrom(useSearchParams().get("from"));
  return (
    <Link href={from ?? fallback} className="text-sm text-link hover:underline print:hidden">
      ← {from ? sectionOf(from) : (fallbackLabel ?? sectionOf(fallback))}
    </Link>
  );
}
