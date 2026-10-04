"use client";

import { useHood } from "@/lib/hood";

/** Technical detail that renders only with the Technical details switch on. */
export default function Hood({ children }: { children: React.ReactNode }) {
  return useHood() ? <>{children}</> : null;
}
