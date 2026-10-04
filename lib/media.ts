import { useCallback, useSyncExternalStore } from "react";

/** Whether a CSS media query matches, following changes as the window is
 *  resized (false on the server). */
export function useMedia(query: string): boolean {
  const subscribe = useCallback((onChange: () => void) => {
    const list = window.matchMedia(query);
    list.addEventListener("change", onChange);
    return () => list.removeEventListener("change", onChange);
  }, [query]);
  return useSyncExternalStore(subscribe, () => window.matchMedia(query).matches, () => false);
}
