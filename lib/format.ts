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

/** A date as "3 Oct" (in the browser's own order), in the zone it was done in when given. */
export function formatDay(iso: string | null | undefined, tz?: string | null): string {
  if (!iso) return "—";
  try { return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", timeZone: tz ?? undefined }); }
  catch { return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" }); }
}

// spelled out: dateStyle/timeStyle can't be combined with timeZoneName
const AT: Intl.DateTimeFormatOptions = { year: "numeric", month: "short", day: "numeric",
  hour: "numeric", minute: "2-digit", timeZoneName: "short" };

/** A moment as "Oct 6, 2026, 2:35 AM CDT", in the zone it was done in
 *  (`tz`, stored with it: a Point of View written from India shows India's
 *  time), never UTC; the viewer's own zone when none was stored. Where a
 *  zone has no short name, the GMT offset. */
export function formatAt(iso: string | null | undefined, tz?: string | null): string {
  if (!iso) return "—";
  try {
    return new Intl.DateTimeFormat("en-US", { ...AT, timeZone: tz ?? undefined }).format(new Date(iso));
  } catch {
    return new Intl.DateTimeFormat("en-US", AT).format(new Date(iso)); // an unknown zone: the viewer's
  }
}

/** Just the clock time, "10:24 AM CDT", in the zone it was done in (as formatAt). */
export function formatClock(iso: string, tz?: string | null): string {
  const o: Intl.DateTimeFormatOptions = { hour: "numeric", minute: "2-digit", timeZoneName: "short" };
  try { return new Intl.DateTimeFormat("en-US", { ...o, timeZone: tz ?? undefined }).format(new Date(iso)); }
  catch { return new Intl.DateTimeFormat("en-US", o).format(new Date(iso)); }
}

/** A title tooltip for a moment shown as a short day: "Written Oct 21, 2026,
 *  10:13 AM GMT+5:30", in the zone it was done in. */
export function timeTitle(verb: string, iso: string | null | undefined, tz?: string | null): string | undefined {
  return iso ? `${verb} ${formatAt(iso, tz)}` : undefined;
}

/** A token count, short: "950", "12.4k", "1.24M". */
export function formatTokens(n: number): string {
  if (n < 1000) return String(n);
  if (n < 1_000_000) return `${(n / 1000).toFixed(n < 10_000 ? 1 : 0)}k`;
  return `${(n / 1_000_000).toFixed(2)}M`;
}

/** "1 page", "3 pages". */
export const plural = (n: number, one: string, many = `${one}s`) => `${n.toLocaleString()} ${n === 1 ? one : many}`;

const listed = (word: string) => (items: string[]) =>
  items.length < 2 ? items.join("") : `${items.slice(0, -1).join(", ")} ${word} ${items[items.length - 1]}`;
/** "IoT", "Interaction or IoT", "Cloud, Interaction or IoT". */
export const orList = listed("or");
/** "Research", "Research and Pilot", "Research, Pilot and Early commercial". */
export const andList = listed("and");

/** A stored day ("2026-10-01") as "Oct 1", or "Oct 1, 2026" with the year. */
export function formatDate(ymd: string, year = false): string {
  return new Date(`${ymd.slice(0, 10)}T00:00:00Z`).toLocaleDateString(undefined, {
    month: "short", day: "numeric", ...(year ? { year: "numeric" } : {}), timeZone: "UTC" });
}
