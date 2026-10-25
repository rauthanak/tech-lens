// A technology's one state (services/evidence on the backend). The
// Technologies list filters by it; the technology page leads with it.

export type TechState = "new_evidence" | "no_pov" | "not_assessed" | "stopped_partway" | "assessing" | "current" | "off";

/** How many of a technology's measures were scored. Under half reads amber:
 *  the priority and the Point of View rest on thin ground. */
// `waiting`: measures that wait for a figure Tata enters, not for evidence
export type Scored = { scored: number; of: number; waiting?: number };
/** Under half the measures that evidence can answer were scored. */
export const thinScoring = (m: Scored | null | undefined) => {
  const answerable = m ? m.of - (m.waiting ?? 0) : 0;
  return !!m && answerable > 0 && m.scored / answerable < 0.5;
};
