export type PromptDoc = {
  _id: string;
  name: string;
  description: string;
  system: string | null;
  prompt: string;
  variables: string[];
  version: number;
  enabled: boolean;
  updated_at?: string;
};

export type PromptImpact = {
  stage: string;
  usedBy: string;
  when: string;
  impacts: string;
  live: boolean;
};

// Where each prompt acts in the pipeline. Purely descriptive — the pipeline
// itself reads prompts by name from the db, never from this map.
export const PROMPT_IMPACT: Record<string, PromptImpact> = {
  orchestrator: {
    stage: "Scout run · step 1",
    usedBy: "Orchestrator deep agent",
    when: "Once, at the start of every scout run",
    impacts:
      "Which H-categories get dispatched to supervisors. Planning only — it writes no data itself.",
    live: true,
  },
  supervisor: {
    stage: "Scout run · step 2",
    usedBy: "Supervisor deep agent — one per H-category",
    when: "Once per category, per run",
    impacts:
      "How the category's sources are read and batched out to scouts. The deterministic sweep guarantees every enabled source is crawled regardless.",
    live: true,
  },
  scout: {
    stage: "Scout run · step 3",
    usedBy: "Scout deep agent — one per batch of sources",
    when: "Once per scout, per run",
    impacts:
      "How crawling is driven — which sources get crawl_source calls and with what intent.",
    live: true,
  },
  link_selection: {
    stage: "Crawling",
    usedBy: "crawl_source tool, inside every scout",
    when: "On every crawled page that offers more links than the crawl width",
    impacts:
      "Which links are followed — and therefore which pages ever become documents. A bad edit here silently shrinks every future run.",
    live: true,
  },
  article_summary: {
    stage: "Crawling",
    usedBy: "crawl_source tool, inside every scout",
    when: "Once per extracted page",
    impacts:
      "Three document fields: summary (becomes the Phase C scoring evidence), technologies (feeds the Phase B resolver), and scout's take. This prompt shapes all downstream evidence.",
    live: true,
  },
  technology_resolve: {
    stage: "Technology resolve",
    usedBy: "Resolver (src/agent/resolver) — 'Run resolve' on the Technologies tab",
    when: "A few large chunks per resolve; only never-seen strings after the first",
    impacts:
      "The canonical technology register — which raw strings merge decides what gets scored at all. Bad merges are repaired on the Technologies tab, no re-resolve needed.",
    live: true,
  },
  analyzer: {
    stage: "Scoring run",
    usedBy: "Analyzer deep agent — one per scoring run",
    when: "Once, at the start of every scoring run",
    impacts:
      "How the analyzer works its technology list. Completion is guaranteed by the deterministic sweep regardless.",
    live: true,
  },
  fabric_relevance: {
    stage: "Scoring run",
    usedBy: "Analyzer engine, before the measure fan-out",
    when: "Once per technology per scoring run",
    impacts:
      "Which fabrics a technology is assessed in. Fails open to all enabled fabrics — a gate failure widens scoring, never narrows it.",
    live: true,
  },
  measure_scoring: {
    stage: "Scoring run",
    usedBy: "Analyzer engine — one call per enabled measure × relevant fabric",
    when: "The measure list comes from the Measures tab: 12 today, N tomorrow",
    impacts:
      "Every 0–10 score, justification, citations and counter-case — the direct input to the TORA roll-up and the priority grid. The per-measure substance (definition, anchors, evidence bar) is edited on the Measures tab; this template is the shared scaffolding.",
    live: true,
  },
  pov: {
    stage: "Point of View",
    usedBy: "PoV composer — 'Compose PoV' on a technology's PoV page",
    when: "One call per technology, on demand; recompose any time",
    impacts:
      "The prose of the client-format PoV document. It narrates the stored assessment — every number comes verbatim from the scores; unscorables become explicit evidence-gap statements.",
    live: true,
  },
  watch_metrics: {
    stage: "Scoring run",
    usedBy: "Analyzer engine, after a technology's fabrics are scored",
    when: "Once per technology per scoring run (never re-spent on resume)",
    impacts:
      "The dated, checkable metrics-to-watch on every assessment and in the PoV — each one verifiable by a later run.",
    live: true,
  },
};

export const UNKNOWN_IMPACT: PromptImpact = {
  stage: "Unmapped",
  usedBy: "No pipeline stage references this prompt yet",
  when: "—",
  impacts: "Not wired into any flow — editing it changes nothing until code reads it by name.",
  live: false,
};
