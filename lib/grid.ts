// The 2×2 as Tata draws it (its reference radar): impact timeline down the
// side, now at the top; impact potential across, bigger to the right. Every
// grid and table of priority cells reads its layout from here.

export type Cutpoints = { how_soon: [number, number]; how_big: [number, number] };

/** The four corners, split on the upper band edges: Act is exactly P1's cell. */
export const QUADRANTS = [
  { name: "Act", top: true, right: true, tint: 0.075 },
  { name: "Plan", top: false, right: true, tint: 0.035 },
  { name: "Watch", top: true, right: false, tint: 0.035 },
  { name: "Wait", top: false, right: false, tint: 0 },
] as const;

/** Rows and columns of a table of priority cells (`grid[`${row}_${col}`]`). */
export const TIMELINE_ROWS = ["near", "mid", "far"] as const; // now at the top
export const POTENTIAL_COLS = ["low", "mid", "high"] as const; // bigger to the right
export const TABLE_CORNER = "How soon ↓ · How big →";

export const SOON_AXIS = { title: "How soon (impact timeline)", low: "Later", high: "Now" };

/** The corner a placement sits in: now when how soon is past its upper edge,
 *  right when how big (or the threat) is past its. */
export function quadrantOf(soon: number | null, up: number | null, cut: Cutpoints): string | null {
  if (soon == null || up == null) return null;
  const top = soon > cut.how_soon[1], right = up > cut.how_big[1];
  return QUADRANTS.find((q) => q.top === top && q.right === right)!.name;
}
