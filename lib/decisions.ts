// People's choices (the API's decisions): kept apart from what the model
// wrote, and never overwritten by a run.

import { sendJson } from "@/lib/api";

export type Decision = {
  _id: string;
  kind: string;
  value: unknown;
  reason: string | null;
  at: string;
  tz: string | null;
  computed?: string | null;
};

export type DecisionIn = {
  kind: "move" | "override" | "hand_score" | "accept_gap" | "tata_entry" | "nascent" | "catalog" | "use_case" | "path_step"
    | "finance" | "bottlenecks" | "commitment" | "watch_threshold" | "watch_crossed";
  tech_id: string;
  fabric_id?: string | null;
  measure_id?: string | null;
  field?: string | null;
  key?: string | null;
  value?: unknown;
  reason?: string | null;
};

export const decide = (d: DecisionIn) => sendJson<{ decision: Decision }>("/api/decisions", "POST", d);
export const undo = (id: string) => sendJson<{ decision: Decision }>(`/api/decisions/${id}`, "DELETE");
