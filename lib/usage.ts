// What model calls cost, from the API's usage endpoints (llm_calls).
import { formatTokens } from "@/lib/format";

export type Tokens = {
  calls: number;
  failed: number;
  input_tokens: number;       // sent and paid in full
  output_tokens: number;      // written back
  cache_read_tokens: number;  // reused from an earlier call, at a fraction of the price
  cache_write_tokens: number; // stored for reuse
};

/** One call's kind in a run: `skill` is its code name (a recipe, or skills),
 *  `name` its name on screen. */
export type UsageRow = Tokens & { skill: string; name: string };

/** One run and kind that called the model (GET /api/usage/recent). */
export type RunUsage = Tokens & {
  run_id: string;
  run_kind: string | null;
  first_at: string;
  last_at: string;
  part_of: { kind: string; id: string } | null;  // the run it belongs to
  about: Record<string, unknown> | null;         // what its own record says
};

/** The kinds of run that call the model, in plain words. */
// named by the step they belong to (RunSteps), so History reads like the steps
export const RUN_KIND: Record<string, string> = {
  collection: "Collect", resolve: "Organize · merge names", classify: "Classify", scoring: "Assess",
  pov: "Write Points of View", find_evidence: "Find evidence", import: "Import technologies",
  recheck: "Collect · check again", diagnose: "Diagnostic call", value_refresh: "Assess · use cases again",
  tag: "Organize · link known names",
};

/** Every token sent, reused ones included. */
export const tokensIn = (u: Tokens) => u.input_tokens + u.cache_read_tokens + u.cache_write_tokens;

/** "15.4M tokens in (13.1M reused) · 525k out". */
export const tokenLine = (u: Tokens) =>
  `${formatTokens(tokensIn(u))} tokens in${u.cache_read_tokens ? ` (${formatTokens(u.cache_read_tokens)} reused)` : ""}`
  + ` · ${formatTokens(u.output_tokens)} out`;

/** Several sets of calls added together. */
export const addTokens = (us: Tokens[]): Tokens => ({
  calls: us.reduce((n, u) => n + u.calls, 0), failed: us.reduce((n, u) => n + u.failed, 0),
  input_tokens: us.reduce((n, u) => n + u.input_tokens, 0), output_tokens: us.reduce((n, u) => n + u.output_tokens, 0),
  cache_read_tokens: us.reduce((n, u) => n + u.cache_read_tokens, 0),
  cache_write_tokens: us.reduce((n, u) => n + u.cache_write_tokens, 0),
});

/** Whether a run started before tokens were recorded (`since`), so its
 *  tokens are missing, or only partly there. */
export const beforeRecording = (startedAt: string | null | undefined, since: string | null | undefined) =>
  !!startedAt && (!since || startedAt < since);
