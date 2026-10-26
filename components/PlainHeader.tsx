import Link from "next/link";

/** The brand header for the pages outside the portal and the leaders' view
 *  (sign in, change password, no access), above their content. */
export default function PlainHeader({ children }: { children: React.ReactNode }) {
  return (
    <>
      <header className="brand-header">
        <div className="mx-auto flex min-h-14 max-w-[1760px] items-center px-4 py-2 sm:px-6 lg:px-10">
          <Link href="/" className="flex flex-col text-white sm:flex-row sm:items-center sm:gap-3">
            <span className="text-lg font-semibold tracking-[-0.02em]">Emerging technology radar</span>
            <span aria-hidden className="hidden h-5 w-px bg-white/25 sm:block" />
            <span className="text-xs text-white/70 sm:text-sm">Tata Communications</span>
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-md px-4 py-12 sm:px-6">{children}</main>
    </>
  );
}
