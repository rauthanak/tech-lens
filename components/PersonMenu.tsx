"use client";

import Link from "next/link";
import { signOut, useMe } from "@/lib/me";

/** The signed-in person's name in the header, opening Change password and Sign out. */
export default function PersonMenu() {
  const me = useMe();
  if (!me) return null;
  return (
    <details className="relative">
      <summary className="cursor-pointer list-none whitespace-nowrap text-sm text-white/80 hover:text-white">
        {me.name} ▾
      </summary>
      <div className="absolute right-0 z-20 mt-2 flex w-52 flex-col rounded-card border border-line bg-white py-1 text-sm text-ink shadow-lg">
        <span className="px-3 py-1.5 text-xs text-muted">{me.email} · {me.role === "admin" ? "admin" : "leader"}</span>
        <Link href="/account/password" className="px-3 py-1.5 hover:bg-ground">Change password</Link>
        <button type="button" onClick={signOut} className="px-3 py-1.5 text-left hover:bg-ground">Sign out</button>
      </div>
    </details>
  );
}
