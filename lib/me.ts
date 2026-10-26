"use client";

import { useEffect, useState } from "react";
import { fetchJson, sendJson } from "@/lib/api";

/** The signed-in person (GET /api/auth/me). */
export type Me = { email: string; name: string; role: "admin" | "leader"; must_change: boolean };

let asked: Promise<Me> | null = null; // once per page load: a change of person reloads the page

/** Who is signed in; null until known. */
export function useMe(): Me | null {
  const [me, setMe] = useState<Me | null>(null);
  useEffect(() => {
    let live = true;
    (asked ??= fetchJson<Me>("/api/auth/me"))
      .then((m) => { if (live) setMe(m); })
      .catch(() => { asked = null; });
    return () => { live = false; };
  }, []);
  return me;
}

/** Sign out, then a full page load: nothing of this person stays in the tab. */
export async function signOut(): Promise<void> {
  try {
    await sendJson("/api/auth/sign-out", "POST");
  } catch {
    // signed out already, or the server can't be reached: the sign-in page says which on the next try
  }
  // a full page load on purpose, not router.push: module caches start empty for the next person
  // eslint-disable-next-line @next/next/no-location-assign-relative-destination
  window.location.assign("/sign-in");
}

/** Where to go after signing in: a path on this site only (never `//elsewhere` or a full address). */
export function safeNext(next: string | null): string {
  return next && next.startsWith("/") && !next.startsWith("//") && !next.startsWith("/\\") ? next : "/";
}
