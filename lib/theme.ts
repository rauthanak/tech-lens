// The Tata Communications look in one place. Colours are tokens in
// app/globals.css; these tables map states and values onto them.

/** A small pulsing azure dot: something is running right now. */
export const LIVE_DOT = "inline-block h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-azure";

/** Status chips: azure while running, grey once over, red only for failures.
 * StatusChip puts LIVE_DOT before a live status and `mark` before the others. */
export const STATUS: Record<string, { style: string; live?: boolean; mark?: string; word?: string }> = {
  running: { style: "bg-azure/10 text-ink", live: true, word: "Running" },
  terminating: { style: "bg-azure/10 text-ink", live: true, word: "Stopping" },
  completed: { style: "bg-neutral-100 text-muted", mark: "✓", word: "Done" },
  failed: { style: "bg-failed/10 text-failed", word: "Failed" },
  terminated: { style: "bg-neutral-100 text-muted", word: "Stopped" },
  stopped: { style: "bg-neutral-100 text-muted", word: "Stopped" },
  interrupted: { style: "bg-neutral-100 text-muted", word: "Interrupted" },
  incomplete: { style: "bg-neutral-100 text-ink", mark: "◐", word: "Not finished" }, // didn't finish
  confirmed: { style: "bg-neutral-100 text-muted", mark: "✓", word: "Confirmed" },
  discarded: { style: "bg-neutral-100 text-muted", word: "Discarded" },
  reviewing: { style: "bg-azure/10 text-ink", word: "To review" },
  ready: { style: "bg-azure/10 text-ink", word: "Ready to confirm" },
};

/** P1–P6 on a navy ramp, darkest for the most urgent; white text on the first three. */
export const PRIORITY: Record<string, string> = {
  P1: "bg-navy text-white",
  P2: "bg-[#1d3b73] text-white",
  P3: "bg-[#3f5f99] text-white",
  P4: "bg-[#8fa6cc] text-ink",
  P5: "bg-[#c9d5ea] text-ink",
  P6: "bg-[#eef2f8] text-ink",
};

/** A 0–10 score on the same ramp: 7 and up darkest, below 4 lightest. */
export function scoreShade(score: number | null): string {
  if (score == null) return "bg-neutral-100 text-neutral-400";
  if (score >= 7) return PRIORITY.P1;
  if (score >= 4) return PRIORITY.P4;
  return PRIORITY.P6;
}

/** Horizon bars, three steps of the ramp: the nearer the horizon, the lighter. */
export const HORIZON: Record<string, string> = {
  H1: "bg-[#8fa6cc]",
  H2: "bg-[#3f5f99]",
  H3: "bg-navy",
};

/** Each fabric's business-line colour, by fabric id. */
export const FABRIC: Record<string, string> = {
  network: "bg-network",
  cloud: "bg-cloud",
  security: "bg-security",
  iot: "bg-iot",
  interaction: "bg-interaction",
  media: "bg-media",
};

/** A section's small capital heading (a Point of View's parts, the leaders' commitments). */
export const heading = "font-mono text-[11px] uppercase tracking-[0.25em] text-neutral-500";
