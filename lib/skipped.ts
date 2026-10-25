import { plural } from "@/lib/format";

/** Pages and links a collection left out because they couldn't be read, by
 *  reason (the crawler's Outcome.skip), with up to 5 example addresses. */
export type Skipped = { what: "page" | "link"; reason: string; count: number; examples: string[] };

/** "2 pages skipped (the site answered 404); 1 link skipped (its address is malformed)". */
export const skippedWords = (skipped?: Skipped[] | null) =>
  (skipped ?? []).map((k) => `${plural(k.count, k.what)} skipped (${k.reason})`).join("; ");
