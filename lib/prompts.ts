import { formatTokens, plural } from "@/lib/format";

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
  title?: string;  // the plain name, from the seeds; PROMPT_IMPACT's title is the fallback
  stage?: string;
  agent?: boolean;
  reasoning?: "on" | "off"; // "on": the model reasons before answering — better judgment, more tokens
};

export type PromptImpact = {
  title: string; // the skill's name on screen; the code name shows only under Technical details
  stage: string; // the step that uses it, named as on Operations and the skill map
  usedBy: string;
  code?: string; // what the code calls the part that uses it, shown only under Technical details
  when: string;
  impacts: string;
  live: boolean;
};

// Where each prompt acts in the pipeline, in the pipeline's order (the Skills
// list follows it). Purely descriptive — the pipeline
// itself reads prompts by name from the db, never from this map.
export const PROMPT_IMPACT: Record<string, PromptImpact> = {
  orchestrator: {
    title: "Plan a collection",
    stage: "Collect",
    usedBy: "The collection's planner, an agent that plans its own calls",
    code: "Orchestrator deep agent",
    when: "Once, at the start of every collection",
    impacts: "Which groups of sources (H1, H2, H3) are handed out to be read. Planning only: it saves nothing itself.",
    live: true,
  },
  supervisor: {
    title: "Run a group of sources",
    stage: "Collect",
    usedBy: "One agent per group of sources (H1, H2, H3)",
    code: "Supervisor deep agent",
    when: "Once per group, per collection",
    impacts:
      "How a group's sources are split into batches for reading. Every switched-on source is collected whatever it decides.",
    live: true,
  },
  scout: {
    title: "Collect from sources",
    stage: "Collect",
    usedBy: "One agent per batch of sources",
    code: "Scout deep agent",
    when: "Once per batch, per collection",
    impacts:
      "Which sources it collects and with what aim: websites are crawled page by page, data sources run their saved searches.",
    live: true,
  },
  link_selection: {
    title: "Choose which links to follow",
    stage: "Collect",
    usedBy: "The website crawler, inside every batch",
    code: "collect_source tool (websites)",
    when: "On every crawled page with more links than the crawl may follow from it",
    impacts:
      "Which links are followed, and so which pages are ever read. It prefers links likely to carry the events on the Signal list (filled in when it runs). Links it leaves out are counted as not visited on the collection's page.",
    live: true,
  },
  article_summary: {
    title: "Read a page",
    stage: "Collect",
    usedBy: "The page reader, inside every batch, and Check again on Operations",
    code: "collect_source tool",
    when: "Once per new or changed page (a long page: once per part, plus one to join them)",
    impacts:
      "Each page's summary (the evidence assessments read), the technologies it names (which Organize then merges), the reader's take, and the findings from the Signal list, filled in when it runs: an event on the list is reported with what it means; a page that is only something on the Can ignore list is set aside. Its output feeds the Briefing. It must keep {never_miss} and {can_ignore}.",
    live: true,
  },
  technology_resolve: {
    title: "Organize technology names",
    stage: "Organize",
    usedBy: "The Organize step, after each collection or with Organize now on Operations",
    code: "Resolver (src/agent/resolver)",
    when: "A few large batches per run; after the first, only names it hasn't seen before",
    impacts:
      "Which names are merged into one technology, and so what gets assessed at all. A bad merge is undone on the technology's page (Manage); nothing needs running again.",
    live: true,
  },
  technology_label: {
    title: "Capitalize technology names",
    stage: "Organize",
    usedBy: "The Organize step, at its end",
    code: "Resolver (src/agent/resolver)",
    when: "Once per batch of new technology names; names that already have their capitals are skipped",
    impacts:
      "How each technology's name is shown: its usual capitals (\"ml-kem\" → \"ML-KEM\"). The stored name stays lowercase.",
    live: true,
  },
  technology_names: {
    title: "Names to look for",
    stage: "Organize",
    usedBy: "Linking known names, after each collection or the catch-up on Operations",
    code: "Tagger (src/agent/tagger)",
    when: "Once per batch of 40 catalog technologies that have no names yet; a person can edit them on the technology's page",
    impacts:
      "The names each catalog technology is found by on pages (spellings, short forms); and the note on an entry that reads as an industry application or use case.",
    live: true,
  },
  name_check: {
    title: "Check a name on a page",
    stage: "Organize",
    usedBy: "Linking known names, after each collection or the catch-up on Operations",
    code: "Tagger (src/agent/tagger)",
    when: "Once per 10 pages that name a catalog technology and haven't been checked for it",
    impacts:
      "Which pages are filed under a catalog technology as its evidence (about it), and which only name it in passing (counted apart, never evidence).",
    live: true,
  },
  analyzer: {
    title: "Plan an assessment run",
    stage: "Assess",
    usedBy: "The assessment run's planner, an agent, one per run",
    code: "Analyzer deep agent",
    when: "Once, at the start of every assessment run",
    impacts:
      "How the run works through its list of technologies. Every technology on the list is assessed whatever it plans.",
    live: true,
  },
  fabric_relevance: {
    title: "Choose the fabrics to assess",
    stage: "Assess",
    usedBy: "The assessment's technology call, sent with the measures judged for the technology as a whole, the metrics to watch, domain, TRL and commercial availability",
    when: "Once per technology per assessment run",
    impacts:
      "Which fabrics a technology is assessed in, and so which fabric calls follow. If the choice fails, every switched-on fabric is assessed: a failure widens the assessment, never narrows it.",
    live: true,
  },
  measure_scoring: {
    title: "Score one measure",
    stage: "Assess",
    usedBy: "The assessment's calls: one block per measure judged for the technology as a whole in its technology call, and one per measure judged per fabric in each fabric call",
    when: "Each measure is scored per technology, per fabric, or entered by Tata, as set on the Measures tab; the ones Tata enters aren't sent to the model",
    impacts:
      "Every 0–10 score, its reasons, its pages and what argues against it: the input to the three scores and the priority grid. What each measure means (its definition, what a low, middle and high score look like, the evidence it needs) is edited on the Measures tab; this text is the shared frame around it.",
    live: true,
  },
  watch_metrics: {
    title: "Suggest metrics to watch",
    stage: "Assess",
    usedBy: "The assessment's technology call, sent with the fabric choice and the measures judged for the technology as a whole",
    when: "Once per technology per assessment run (not asked again when a run is resumed)",
    impacts:
      "The dated metrics to watch on every assessment and in the Point of View, each one checkable by a later run.",
    live: true,
  },
  evidence_strength: {
    title: "Judge how solid the evidence is",
    stage: "Classify",
    usedBy: "The Classify call, sent with the other skills that judge a technology",
    when: "Once per technology with new pages, after each collection, or when asked",
    impacts: "Each technology's evidence verdict (strong, enough, thin, not credible), which decides whether it's ready to assess.",
    live: true,
  },
  domain_subdomain: {
    title: "File it under a domain",
    stage: "Classify",
    usedBy: "The Classify call, and the assessment's technology call",
    when: "Once per technology judged or assessed",
    impacts: "The domain and sub-domain on Technologies; proposes new sub-domains for Setup › Classification.",
    live: true,
  },
  commercial_availability: {
    title: "Judge how available it is to buy",
    stage: "Classify",
    usedBy: "The Classify call, and the assessment's technology call",
    when: "Once per technology judged or assessed",
    impacts: "Commercial availability (Research, Pilot, Early commercial, Mature) and so the Emerging views.",
    live: true,
  },
  trl_level: {
    title: "Judge its readiness (TRL)",
    stage: "Classify",
    usedBy: "The Classify call, and the assessment's technology call",
    when: "Once per technology judged or assessed",
    impacts: "The TRL on Technologies and in the Point of View; checked against the Maturity score on the Before publishing list.",
    live: true,
  },
  possible_nascent: {
    title: "Spot a possibly nascent technology",
    stage: "Classify",
    usedBy: "The Classify call",
    when: "Once per technology judged",
    impacts: "Flags for the Before assessing list; a person confirms or dismisses each.",
    live: true,
  },
  value_levers: {
    title: "Map where the value lands",
    stage: "Assess",
    usedBy: "The assessment's fabric call, sent with that fabric's measures; Find use cases",
    when: "Once per technology per fabric it's assessed in",
    impacts: "Use cases, how each one earns or saves money, and the capital it needs, on the fabric tab and in the Point of View. Never writes a figure.",
    live: true,
  },
  pov: {
    title: "Write the Point of View",
    stage: "Point of View",
    usedBy: "Write Point of View on a technology's page, and the Points of View list",
    code: "Point of View writer",
    when: "One call per technology, when asked; rewrite any time",
    impacts:
      "The text of the Point of View, in Tata Communications' house format. It retells the stored assessment: every number comes word for word from the scores, and measures the evidence couldn't score become plain statements of the gap.",
    live: true,
  },
};

export const UNKNOWN_IMPACT: PromptImpact = {
  title: "",
  stage: "Not used yet",
  usedBy: "No step uses this skill yet",
  when: "—",
  impacts: "Editing it changes nothing until a step reads it.",
  live: false,
};

/** One line per step for each skill tag: what the step does, for a newcomer. */
export const STAGE_MEANING: Record<string, string> = {
  Collect: "reads the sources and their new pages",
  Organize: "merges different spellings of the same technology",
  Classify: "judges each technology's evidence and sets its domain, availability and maturity",
  Assess: "scores each technology in each fabric",
  "Point of View": "writes the conclusion on each technology",
};

/** A skill's name on screen: its title, else its code name. */
export const skillTitle = (name: string) => PROMPT_IMPACT[name]?.title || name;

// Where each skill is used (GET /api/skills/map): the steps, each with the
// run its numbers come from (its last full run), its combined calls with
// what each used, and its skills, with the calls they asked alone.
export type Used = { calls: number; tokens_in: number; tokens_out: number; reused: number } | null;
export type MapSkill = { name: string; title: string; agent: boolean; enabled: boolean; description: string | null;
  recipes: { recipe_id: string; name: string }[]; alone: Used };
export type MapRecipe = { recipe_id: string; name: string; skills: string[]; used: Used; alone: Record<string, Used> };
export type MapStage = { id: string; name: string; run: { run_id: string; at: string; calls: number } | null;
  skills: MapSkill[]; recipes: MapRecipe[] };
export type SkillMap = { stages: MapStage[]; unplaced: string[] };

/** "95k tokens in (11k reused) · 4.6k out", for Technical details. */
export const tokensUsed = (u: NonNullable<Used>) =>
  `${formatTokens(u.tokens_in)} tokens in${u.reused ? ` (${formatTokens(u.reused)} reused)` : ""} · ${formatTokens(u.tokens_out)} out`;

/** "3 calls", and with `tokens` (Technical details) "3 calls · 95k tokens in (11k reused) · 4.6k out". */
export const usedLine = (u: NonNullable<Used>, tokens = false) =>
  `${plural(u.calls, "call")}${tokens ? ` · ${tokensUsed(u)}` : ""}`;

// What a skill turns into (GET/POST /api/prompts/{name}/preview): how many
// versions of it a run sends, where its blanks are filled from, and one real
// example, built by the backend with the same code a run uses.
export type PreviewBlank = { name: string; what: string; tag: string; from: string; href: string | null };
export type PreviewPart = { text: string; blank?: string; cut?: number };
export type PreviewSwitch = {
  key: string;
  label: string;
  value: string | null;
  note: string | null;
  options: { value: string; label: string; scored_last_run?: boolean }[];
};
export type SkillPreviewDoc = {
  skill: string;
  version: number;
  enabled: boolean;
  draft: boolean;
  agent: boolean;
  fires: string;
  versions: {
    sentence: string;
    count: number | null;
    up_to: boolean;
    per: string;
    set_in: { from: string; href: string | null }[];
  };
  last_run: {
    kind: string;
    run_id: string | null;
    at: string | null;
    status: string | null;
    prompts: number | null;
    why_missing: string | null;
    note: string | null;
  };
  blanks: PreviewBlank[];
  switches: PreviewSwitch[];
  example: {
    parts: PreviewPart[];
    characters: number;
    tokens_about: number;
    built_from: string | null;
    stand_in: string | null;
    note: string | null;
    why_missing: string | null;
  };
};
