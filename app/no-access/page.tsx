"use client";

import Link from "next/link";
import PlainHeader from "@/components/PlainHeader";
import { signOut } from "@/lib/me";

/** What a leader sees on an admin page (proxy.ts). */
export default function NoAccessPage() {
  return (
    <PlainHeader>
      <div className="rounded-card border border-line bg-white px-6 py-6">
        <h1 className="font-display text-2xl text-ink">This part is for the radar team</h1>
        <p className="mt-3 text-sm text-neutral-700">
          Your account opens the leaders&apos; view: the radar&apos;s published picture and its Points of View.
        </p>
        <div className="mt-5 flex flex-wrap items-center gap-4">
          <Link href="/frontier" className="rounded-full bg-navy px-4 py-2 text-sm font-medium text-white hover:bg-navy-strong">
            Go to the leaders&apos; view
          </Link>
          <button type="button" onClick={signOut} className="text-sm text-link hover:underline">Sign out</button>
        </div>
      </div>
    </PlainHeader>
  );
}
