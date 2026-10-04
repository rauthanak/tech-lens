"use client";

import { useSyncExternalStore } from "react";

// The "Under the hood" switch: technical detail (agents, sub-stages, model
// calls) is hidden by default. The choice lives in this browser only.
const KEY = "tech-lens:under-the-hood";
const EVENT = "tech-lens:hood";

function read(): boolean {
  try {
    return window.localStorage.getItem(KEY) === "on";
  } catch {
    return false;
  }
}

function subscribe(onChange: () => void): () => void {
  window.addEventListener(EVENT, onChange);
  window.addEventListener("storage", onChange); // another tab flipped it
  return () => {
    window.removeEventListener(EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

export function setHood(on: boolean): void {
  try {
    window.localStorage.setItem(KEY, on ? "on" : "off");
  } catch {
    // storage unavailable — nothing to remember
  }
  window.dispatchEvent(new Event(EVENT));
}

export function useHood(): boolean {
  return useSyncExternalStore(subscribe, read, () => false);
}
