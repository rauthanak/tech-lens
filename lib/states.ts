// A technology's one state (services/evidence on the backend). The
// Technologies list filters by it; the technology page leads with it.

export type TechState = "new_evidence" | "no_pov" | "not_assessed" | "stopped_partway" | "assessing" | "current" | "off";

/** How many of a technology's measures were scored. Under half reads amber:
 *  the priority and the Point of View rest on thin ground. */
export type Scored = { scored: number; of: number };
export const thinScoring = (m: Scored | null | undefined) => !!m && m.of > 0 && m.scored / m.of < 0.5;
