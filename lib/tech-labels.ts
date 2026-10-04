"use client";

import { useSyncExternalStore } from "react";
import { fetchJson } from "@/lib/api";

// Technology names are stored in lowercase ("ml-kem"); their labels give the
// usual capitals ("ML-KEM"). GET /api/technologies/labels is fetched once
// for every reader; refreshTechLabels() after a rename.

let labels: Record<string, string> = {};
let loading = false;
let loaded = false;
const listeners = new Set<() => void>();

export function refreshTechLabels(): void {
  loading = true;
  fetchJson<Record<string, string>>("/api/technologies/labels")
    .then((next) => { labels = next; listeners.forEach((l) => l()); })
    .catch(() => {})
    .finally(() => { loading = false; loaded = true; });
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
