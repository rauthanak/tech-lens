"use client";

import { useEffect, useState } from "react";
import { CONFIG_CHANGED, fetchJson } from "@/lib/api";

// How many edits aren't in the seeding data yet: polled every 30 s and
// reloaded whenever a setup page saves.
export function useChangesCount(): number {
  const [count, setCount] = useState(0);
  useEffect(() => {
    const load = () =>
      fetchJson<{ count: number }>("/api/changes").then((d) => setCount(d.count)).catch(() => {});
    load();
    const timer = setInterval(load, 30000);
    window.addEventListener(CONFIG_CHANGED, load);
    return () => { clearInterval(timer); window.removeEventListener(CONFIG_CHANGED, load); };
  }, []);
  return count;
}
