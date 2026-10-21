// The two to-do lists' items (GET /api/gates), in words: one sentence each,
// with the technologies behind it, each opening where it's settled.

import { plural } from "@/lib/format";

type Tech = {
  tech_id: string;
  name: string;
  best?: string;
  fabrics?: string[];
  measures?: number;
  blocking?: { fabric_id: string; fabric: string }[];
  moves?: { fabric_id: string; fabric: string; override: string; was: string | null; now: string | null }[];
  reason?: string;
  note?: string;
  href?: string;
  trl?: number;
  maturity?: number;
  cases?: { fabric_id: string; fabric: string; title: string }[];
  gaps?: { fabric_id: string; fabric: string; missing: string[] }[];
  steps?: { fabric_id: string; fabric: string; at: string; next: string }[];
};

export type GateItem = {
  kind: string;
  count: number;
  technologies?: Tech[];
  calls?: number;
  sentence?: string;
  sub?: string;
  href?: string;
};

export type GateRow = {
  key: string;
  count: number;
  sentence: string;
  sub?: string;
  href?: string;
  list?: { label: string; href: string; note?: string }[];
};

const techs = (n: number, verb?: [string, string]) =>
  `${plural(n, "technology", "technologies")}${verb ? ` ${n === 1 ? verb[0] : verb[1]}` : ""}`;
const page = (t: Tech, fabric?: string) =>
  `/admin/technologies/${t.tech_id}${fabric ? `?fabric=${encodeURIComponent(fabric)}` : ""}`;

/** One item of either list as a row. */
export function gateRow(item: GateItem): GateRow {
  const list = item.technologies ?? [];
  switch (item.kind) {
    case "unscored": {
      const blocking = list.filter((t) => (t.blocking?.length ?? 0) > 0).length;
      return {
        key: item.kind, count: item.count,
        sentence: `${techs(item.count, ["has", "have"])} measures the pages couldn't score`,
        sub: blocking ? `${blocking} of them ${blocking === 1 ? "has" : "have"} no priority because of it: start there. Score a measure by hand or accept its gap.`
          : "Score a measure by hand, or accept its gap.",
        list: list.map((t) => ({
          label: t.name, href: page(t, t.blocking?.[0]?.fabric_id),
          note: `${plural(t.measures ?? 0, "unscored measure")}${t.blocking?.length ? ` · no priority in ${t.blocking.map((b) => b.fabric).join(", ")}` : ""}`,
        })),
      };
    }
    case "waiting_for_tata":
      return {
        key: item.kind, count: item.count,
        sentence: `${techs(item.count, ["waits", "wait"])} for Tata's entries`,
        sub: "Disruption threat and serviceable capture are entered by Tata Communications, on each technology's page.",
        list: list.map((t) => ({ label: t.name, href: page(t, t.fabrics?.[0]), note: `${t.measures} to enter` })),
      };
    case "override_moved":
      return {
        key: item.kind, count: item.count,
        sentence: `${plural(item.count, "override")} where the computed priority has moved since`,
        sub: "Check each one still holds.",
        list: list.flatMap((t) => (t.moves ?? []).map((m) => ({
          label: `${t.name} in ${m.fabric}`, href: page(t, m.fabric_id),
          note: `set to ${m.override}; computed ${m.was ?? "none"} then, ${m.now ?? "none"} now`,
        }))),
      };
    case "maturity_mismatch":
      return {
        key: item.kind, count: item.count,
        sentence: `${techs(item.count, ["has", "have"])} a readiness level (TRL) and a Maturity score that disagree`,
        sub: "TRL 1–3 should go with Maturity 0–3, TRL 4–6 with about 5, TRL 7–9 with 7–10. Change one, or say why both stand.",
        list: list.map((t) => ({ label: t.name, href: page(t, t.fabrics?.[0]),
          note: `TRL ${t.trl}, Maturity ${t.maturity}` })),
      };
    case "suggested_use_cases":
      return {
        key: item.kind, count: item.count,
        sentence: `${techs(item.count, ["has", "have"])} suggested use cases to accept or reject`,
        sub: "Proposed by the model where the pages showed none, without citations. Only accepted ones reach the Point of View.",
        list: list.flatMap((t) => (t.cases ?? []).map((c) => ({ label: `${t.name} in ${c.fabric}`, href: page(t, c.fabric_id), note: c.title }))),
      };
    case "finance_missing":
      return {
        key: item.kind, count: item.count,
        sentence: `${techs(item.count, ["is", "are"])} at Proof of concept or later without finance inputs`,
        sub: "Payback and break-even are worked out once the inputs are entered on the fabric tab or in Setup › Finance.",
        href: "/admin/finance?missing=true",
        list: list.flatMap((t) => (t.gaps ?? []).map((g) => ({ label: `${t.name} in ${g.fabric}`, href: page(t, g.fabric_id),
          note: `needs ${g.missing.join(", ")}` }))),
      };
    case "ready_next_step":
      return {
        key: item.kind, count: item.count,
        sentence: `${techs(item.count, ["has", "have"])} the proof in hand for its next step on the path to scale`,
        sub: "Act when the proof for the next step is in hand, not when the market looks large. Move it up on its fabric tab once Tata commits.",
        list: list.flatMap((t) => (t.steps ?? []).map((st) => ({ label: `${t.name} in ${st.fabric}`, href: page(t, st.fabric_id),
          note: `at ${st.at}; proof for ${st.next} in hand` }))),
      };
    default:
      return {
        key: item.kind, count: item.count, sentence: item.sentence ?? item.kind, sub: item.sub, href: item.href,
        list: list.map((t) => ({ label: t.name, href: t.href ?? page(t), note: t.note ?? t.reason })),
      };
  }
}
