"use client";

import { useEffect, useState } from "react";
import { CONFIG_CHANGED, fetchJson } from "@/lib/api";
import { everyVisible } from "@/lib/visible";

// How many setup edits aren't in the seeding data yet, and how many model
// proposals wait for review (GET /api/changes/count). One shared copy for
// every reader (the top bar and Setup's menu): fetched when a setup page
// saves, and otherwise every 5 minutes while a page shows it.
export type ChangesCount = { count: number; awaiting_review: Record<string, number> };

const EMPTY: ChangesCount = { count: 0, awaiting_review: {} };
const EVERY_MS = 5 * 60_000;
let current: ChangesCount = EMPTY;
const readers = new Set<(c: ChangesCount) => void>();
let stopTimer: (() => void) | null = null;

function load() {
  fetchJson<ChangesCount>("/api/changes/count")
    .then((c) => { current = c; readers.forEach((r) => r(c)); })
    .catch(() => {});
}

export function useChangesCount(): ChangesCount {
  const [value, setValue] = useState(current);
  useEffect(() => {
    readers.add(setValue);
    if (readers.size === 1) {
      load();
      stopTimer = everyVisible(load, EVERY_MS);
      window.addEventListener(CONFIG_CHANGED, load);
    }
    return () => {
      readers.delete(setValue);
      if (readers.size === 0) {
        stopTimer?.();
        stopTimer = null;
        window.removeEventListener(CONFIG_CHANGED, load);
      }
    };
  }, []);
  return value;
}
