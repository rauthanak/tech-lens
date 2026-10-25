"use client";

// Polling only while someone can see the page: a tab in the background asks
// the server for nothing, and catches up once when it's shown again.

export const hidden = () => typeof document !== "undefined" && document.visibilityState === "hidden";

/** Run `fn` every `ms` while the page is visible, and once when it's shown
 *  again. Returns the stop function, for an effect's cleanup. */
export function everyVisible(fn: () => void, ms: number): () => void {
  const timer = setInterval(() => { if (!hidden()) fn(); }, ms);
  const back = () => { if (!hidden()) fn(); };
  document.addEventListener("visibilitychange", back);
  return () => { clearInterval(timer); document.removeEventListener("visibilitychange", back); };
}

/** Call `fn` the next time the page is visible (now, if it is). */
export function whenVisible(fn: () => void): () => void {
  if (!hidden()) { fn(); return () => {}; }
  const back = () => { if (!hidden()) { document.removeEventListener("visibilitychange", back); fn(); } };
  document.addEventListener("visibilitychange", back);
  return () => document.removeEventListener("visibilitychange", back);
}
