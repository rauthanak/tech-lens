import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Leaders' view · Tata Communications",
  description: "Emerging technologies by how soon they arrive and how big the prize is, for Tata Communications' leaders",
};

/** The executive view: the brand header with its name only (no menu, no
 *  status), above every Frontier page. */
export default function FrontierLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <header className="brand-header print:hidden">
        <div className="mx-auto flex min-h-14 max-w-[1760px] items-center px-4 py-2 sm:px-6 lg:px-10">
          <Link href="/frontier" className="flex flex-col text-white sm:flex-row sm:items-center sm:gap-3">
            <span className="text-lg font-semibold tracking-[-0.02em]">Leaders&apos; view</span>
            <span aria-hidden className="hidden h-5 w-px bg-white/25 sm:block" />
            <span className="text-xs text-white/70 sm:text-sm">Tata Communications · Emerging technology radar</span>
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-[1760px] px-4 py-8 sm:px-6 lg:px-10">{children}</main>
    </>
  );
}
