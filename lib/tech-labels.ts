"use client";

import { useSyncExternalStore } from "react";
import { fetchJson } from "@/lib/api";

// Technology names are stored in lowercase ("ml-kem"); their labels give the
// usual capitals ("ML-KEM"). GET /api/technologies/labels is fetched once
// for every reader; refreshTechLabels() after a rename. A failed fetch is
// tried again every 30 s while anything reads them (names show as stored
// until then).

let labels: Record<string, string> = {};
let loading = false;
let loaded = false;
let retry: ReturnType<typeof setTimeout> | undefined;
const listeners = new Set<() => void>();
const RETRY_MS = 30_000;

export function refreshTechLabels(): void {
  loading = true;
  clearTimeout(retry);
  retry = undefined;
  fetchJson<Record<string, string>>("/api/technologies/labels")
    .then((next) => { labels = next; loaded = true; listeners.forEach((l) => l()); })
    .catch(() => { if (listeners.size) retry = setTimeout(() => { if (listeners.size) refreshTechLabels(); }, RETRY_MS); })
    .finally(() => { loading = false; });
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (!loading && !loaded) refreshTechLabels();
  return () => { listeners.delete(listener); };
}

/** A function from a technology's name to how it's shown. */
export function useTechLabel(): (name: string) => string {
  const map = useSyncExternalStore(subscribe, () => labels, () => labels);
  return (name: string) => map[name] ?? name;
}
