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
    stage: "Collection run · step 1",
    usedBy: "Orchestrator deep agent",
    when: "Once, at the start of every collection run",
    impacts:
      "Which H-categories get dispatched to supervisors. Planning only — it writes no data itself.",
    live: true,
  },
  supervisor: {
    stage: "Collection run · step 2",
    usedBy: "Supervisor deep agent — one per H-category",
    when: "Once per category, per run",
    impacts:
      "How the category's sources are read and batched out to scouts. The deterministic sweep guarantees every enabled source is crawled regardless.",
    live: true,
  },
  scout: {
    stage: "Collection run · step 3",
    usedBy: "Scout deep agent — one per batch of sources",
    when: "Once per scout, per run",
    impacts:
      "How collection is driven — which sources get collect_source calls (websites are crawled, data sources run their saved searches) and with what intent.",
    live: true,
  },
  link_selection: {
    stage: "Crawling",
    usedBy: "collect_source tool (websites), inside every scout",
    when: "On every crawled page that offers more links than the crawl width",
    impacts:
      "Which links are followed — and therefore which pages ever become documents. It now prefers links likely to carry never-miss signals (the Signal list's names are filled in at run time). Links it leaves out are counted in the source's \"didn't finish\" note.",
    live: true,
  },
  article_summary: {
    stage: "Crawling",
    usedBy: "collect_source tool, inside every scout — and Check again on Operations",
    when: "Once per new or changed page (a long page: once per part, plus one merge)",
    impacts:
      "The summary (assessment evidence), technologies (feed the resolver), the scout's take — and the signals from the Signal list, filled in at run time: never-miss signals are called out with their implication; a Can ignore match sets the page aside. Its output feeds the Briefing. It must keep {never_miss} and {can_ignore}.",
    live: true,
  },
  technology_resolve: {
    stage: "Organizing technologies",
    usedBy: "Resolver (src/agent/resolver) — after each collection, or Organize now on Operations",
    when: "A few large chunks per resolve; only never-seen strings after the first",
    impacts:
      "The canonical technology register — which raw strings merge decides what gets scored at all. Bad merges are repaired on the technology's page (Manage), no re-resolve needed.",
    live: true,
  },
  technology_label: {
    stage: "Organizing technologies",
    usedBy: "Resolver (src/agent/resolver), at the end of each organize",
    when: "Once per batch of new technology names; names that already have their capitals are skipped",
    impacts:
      "How each technology's name is shown: its usual capitals (\"ml-kem\" → \"ML-KEM\"). The stored name stays lowercase.",
    live: true,
  },
  analyzer: {
    stage: "Assessment run",
    usedBy: "Analyzer deep agent — one per assessment run",
    when: "Once, at the start of every assessment run",
    impacts:
      "How the analyzer works its technology list. Completion is guaranteed by the deterministic sweep regardless.",
    live: true,
  },
  fabric_relevance: {
    stage: "Assessment run",
    usedBy: "Analyzer engine, before the measure fan-out",
    when: "Once per technology per assessment run",
    impacts:
      "Which fabrics a technology is assessed in. Fails open to all enabled fabrics — a gate failure widens scoring, never narrows it.",
    live: true,
  },
  measure_scoring: {
    stage: "Assessment run",
    usedBy: "Analyzer engine — one call per enabled measure × relevant fabric",
    when: "The measure list comes from the Measures tab: 12 today, N tomorrow",
    impacts:
      "Every 0–10 score, justification, citations and counter-case — the direct input to the TORA roll-up and the priority grid. The per-measure substance (definition, anchors, evidence bar) is edited on the Measures tab; this template is the shared scaffolding.",
    live: true,
  },
  pov: {
    stage: "Point of View",
    usedBy: "Point of View writer — 'Write Point of View' on a technology's page and the Points of View list",
    when: "One call per technology, on demand; recompose any time",
    impacts:
      "The prose of the client-format Point of View. It narrates the stored assessment — every number comes verbatim from the scores; unscorables become explicit evidence-gap statements.",
    live: true,
  },
  watch_metrics: {
    stage: "Assessment run",
    usedBy: "Analyzer engine, after a technology's fabrics are scored",
    when: "Once per technology per assessment run (never re-spent on resume)",
    impacts:
      "The dated, checkable metrics-to-watch on every assessment and in the Point of View — each one verifiable by a later run.",
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
