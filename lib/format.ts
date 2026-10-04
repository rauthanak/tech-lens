export function formatTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit",
  });
}

export function duration(start?: string | null, end?: string | null): string {
  if (!start) return "—";
  const ms = (end ? new Date(end).getTime() : Date.now()) - new Date(start).getTime();
  if (ms < 0) return "—";
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  return m < 60 ? `${m}m ${s % 60}s` : `${Math.floor(m / 60)}h ${m % 60}m`;
}

/** A date as "3 Oct" (in the browser's own order). */
export function formatDay(iso: string | null | undefined): string {
  return iso ? new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" }) : "—";
}

/** "1 page", "3 pages". */
export const plural = (n: number, one: string, many = `${one}s`) => `${n.toLocaleString()} ${n === 1 ? one : many}`;

/** "IoT", "Interaction or IoT", "Cloud, Interaction or IoT". */
export const orList = (items: string[]) =>
  items.length < 2 ? items.join("") : `${items.slice(0, -1).join(", ")} or ${items[items.length - 1]}`;

/** A stored day ("2026-10-01") as "Oct 1", or "Oct 1, 2026" with the year. */
export function formatDate(ymd: string, year = false): string {
  return new Date(`${ymd.slice(0, 10)}T00:00:00Z`).toLocaleDateString(undefined, {
    month: "short", day: "numeric", ...(year ? { year: "numeric" } : {}), timeZone: "UTC" });
}
