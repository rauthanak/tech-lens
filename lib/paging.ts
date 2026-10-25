"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

// Long lists come in pages (plan 10, §5): "101–150 of 10,512", Next and Prev.
// A list's place (its filters, search and first row) is in the address, so
// Back and a shared link keep it; each list also remembers its place for the
// browser tab, so arriving from the top menu (a bare address) puts you back
// on the same rows. The row you opened is brought back into view.

export const PAGE_SIZE = 50;
const AT = "at"; // the address parameter: the first row shown, counted from 1

const stored = (list: string) => `place:${list}`;
const openedKey = (list: string) => `opened:${list}`;

function read(key: string): string | null {
  try { return sessionStorage.getItem(key); } catch { return null; }
}
function write(key: string, value: string | null) {
  try { if (value == null) sessionStorage.removeItem(key); else sessionStorage.setItem(key, value); } catch { /* private window: starts at the top */ }
}

/** A list's place: `start` is the first row (from 0); `go(start)` moves to
 *  another page; `startOver()` drops every filter and goes to the top. On a
 *  bare address it brings back the place this tab last had. */
export function useListPlace(list: string) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const query = params.toString();
  const start = Math.max(0, (Number(params.get(AT)) || 1) - 1);
  const restored = useRef(false);

  useEffect(() => {
    if (!restored.current) {
      restored.current = true;
      const saved = read(stored(list));
      if (!query && saved) {  // came back by a bare address: the same rows as last time
        router.replace(`${pathname}?${saved}`, { scroll: false });
        return;
      }
    }
    write(stored(list), query || null);
  }, [list, query, pathname, router]);

  const go = useCallback((next: number) => {
    const p = new URLSearchParams(params.toString());
    if (next > 0) p.set(AT, String(next + 1)); else p.delete(AT);
    router.replace(p.toString() ? `${pathname}?${p}` : pathname, { scroll: false });
  }, [params, pathname, router]);

  const startOver = useCallback(() => {
    write(stored(list), null);
    router.replace(pathname, { scroll: false });
  }, [list, pathname, router]);

  return { start, go, startOver, query };
}

/** The address with the list's place reset: a new filter or search starts at the first row. */
export function withoutPlace(params: URLSearchParams): URLSearchParams {
  const p = new URLSearchParams(params.toString());
  p.delete(AT);
  return p;
}

/** Remember the row a person opens, to bring it back into view on return. */
export const rememberOpened = (list: string, id: string) => write(openedKey(list), id);

/** Once the rows are shown: scroll the remembered row into view and mark it briefly. */
export function useBackToOpened(list: string, ready: boolean) {
  useEffect(() => {
    if (!ready) return;
    const id = read(openedKey(list));
    if (!id) return;
    write(openedKey(list), null);
    const el = document.querySelector<HTMLElement>(`[data-row="${CSS.escape(id)}"]`);
    if (!el) return;
    el.scrollIntoView({ block: "center" });
    el.classList.add("row-flash");
    setTimeout(() => el.classList.remove("row-flash"), 1600);
  }, [list, ready]);
}

/** A list fully in memory, in pages, with the same place-keeping. */
export function useClientPage<T>(rows: T[] | null | undefined, list: string, size = PAGE_SIZE) {
  const place = useListPlace(list);
  const total = rows?.length ?? 0;
  const lastStart = total ? Math.floor((total - 1) / size) * size : 0;
  const shorter = total > 0 && place.start > lastStart;
  const start = shorter ? lastStart : place.start;
  return { ...place, start, shorter, total, page: (rows ?? []).slice(start, start + size), size };
}

/** A list's first row kept for the browser tab only (for a list on a page whose address
 *  carries other things): [start, setStart]. Coming back to the page brings the same rows. */
export function useStoredStart(list: string): [number, (start: number) => void] {
  const key = `place:${list}`;
  const [start, setStartState] = useState(() => Number(read(key)) || 0);
  const setStart = useCallback((n: number) => { write(key, n ? String(n) : null); setStartState(n); }, [key]);
  return [start, setStart];
}

/** A value kept for the browser tab (a list's filters held in the page, not its address),
 *  so coming back to the page brings the same view. */
export function useStoredState<T>(key: string, initial: T): [T, (value: T) => void] {
  const [value, setValueState] = useState<T>(() => {
    const saved = read(`view:${key}`);
    try { return saved == null ? initial : (JSON.parse(saved) as T); } catch { return initial; }
  });
  const setValue = useCallback((v: T) => { write(`view:${key}`, JSON.stringify(v)); setValueState(v); }, [key]);
  return [value, setValue];
}
