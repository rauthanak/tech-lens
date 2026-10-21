# Plan 8: What a skill turns into, in the portal (tech-lens)

**Date:** 2026-10-06 · **Folder:** 2026-10-06/1 · **Status:** approved on 6 Oct; built and live the same day, including phase 3. Build notes in §7.

**Backend, the per-skill content and the API contract:** [tech-atlas plan 8](../../../../tech-atlas/docs/2026-10-06/1/implementation-plan.md). Its §2 lists what each of the 12 skills turns into, and its §4 defines the API this page reads.

---

## 1. Where it goes

**Page:** Setup › Skills › a skill (`app/admin/(setup)/prompts/[name]/page.tsx`).
- The page keeps its card as it is, with the text on the left and "Where it acts" on the right.
- The new section, **What it turns into**, sits below the card at full width.
- On a phone, everything stacks.

**Skills list:** it doesn't change, apart from one more line in its help: "Click a skill to see what it turns into when it runs."

Sketch for Measure scoring:

```
┌ card: Description · System · Skill text   │  Where it acts ────────────────┐
└────────────────────────────────────────────────────────────────────────────┘

WHAT IT TURNS INTO
Built from today's settings and the pages collected so far. No model calls.

How many versions
  Used once per measure, for each fabric Fabric relevance picks, for each technology.
  12 measures × up to 6 fabrics = up to 72 versions per technology
  ‾‾‾‾‾‾‾‾‾‾‾   ‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾  (each links to where it's set)
  Last assessment run, 6 Oct: 4,224 prompts

Where the blanks are filled from
  {measure_name} {definition} {anchors} {required_evidence}   Scoring method › Measures
  {fabric_name} {fabric_definition} {tcl_today}               Scoring method › Fabrics
  {technology}                                                the technology chosen below
  {evidence}                                                  its collected pages, capped by
                                                              Scoring method › Weights & Grid

A real one
  Technology [API security · 4 pages ▾]  Fabric [Security ▾]  Measure [M1 Addressable market ▾]
  The last run scored API security in Network, Cloud, Interaction and Security: 48 prompts.
  ┌──────────────────────────────────────────────────────────────────────────┐
  │ You score one measure for one technology in one fabric …                 │
  │ Measure: ▌from Measures▐ M1 Addressable market                           │
  │ Fabric:  ▌from Fabrics▐ Security — TCL's Security Fabric: managed SASE … │
  │ Evidence:▌from collected pages▐ - [article] … (first 600 characters)      │
  │          Show all 7,425 characters                                       │
  └──────────────────────────────────────────────────────────────────────────┘
  About 2,700 tokens · 10,671 characters
```

---

## 2. The three parts

### 2.1 How many versions

- **When it's used:** one line in words, from the API's `fires` field.
- **The multiplication:** "12 measures × up to 6 fabrics = up to 72 versions per technology". Each factor links to the page where it's set, from `versions.factors[].href`.
- **The last run:** "Last assessment run, 6 Oct: 4,224 prompts".
  - When a count isn't recorded, the line says so and gives the reason, for example "Not counted: the crawler doesn't record link-selection calls."
  - Counts are written in full, with thousands separators. They're never rounded to "4.2k".
- **Agent skills** (`agent: true`) get one extra line: "An agent's standing instructions: it carries them on every step it takes, at most 20." The step limit comes from the `fires` text.

### 2.2 Where the blanks are filled from

- **One row per group of blanks** that share an origin. Each row shows the blank chips, which are the same chips as today, then "from" and the origin as a link.
- **Server settings** (`SCRAPE_MAX_DEPTH`, `SOURCES_PER_SCOUT` and the like) say "server setting, not editable here" and have no link.
- **A skill with no blanks:** "None: the text is sent as it is."
- **This replaces the bare chips list** in "Where it acts". The chips move here, now with where they come from, so they aren't shown twice.

### 2.3 A real one

**Switches.**
- The switches sit above the example, using the portal's usual select field.
- Only the switches the skill has are shown: Technology, Fabric, Measure, Source, Page or Horizon.
- A switch's `note` shows under it, for example which fabrics the last run scored.
- The choices are kept in the page address (`?technology=api-security&fabric=security&measure=m1`). A copied link then opens the same example, as the portal's other filters already do.

**The example.**
- It's shown in a monospace box, in the same font as the editor above it.
- The skill's own text is in normal ink.
- Each filled-in part has a light tint and a small tag at its start, such as "from Measures". The tag links to that part's page, and hovering over it shows the blank's name, such as `{definition}`. Every part uses the same tint, and the tag tells you where it came from.
- Parts longer than 600 characters are folded to their first 600, with a "Show all 7,425 characters" link to open them.
- If the API cut a part for display (`cut > 0`), the opened part ends with "… and 12,345 more characters, which the model gets but which aren't shown here".

**Under the box.**
- The size: "About 2,700 tokens · 10,671 characters".
- What it was built from, from `built_from`.

**Notes above the box,** in plain words, when they apply:
- **Stand-in data** (`stand_in`), for example: "The crawler doesn't keep the links it was offered, so this example uses this source's pages from the last collection."
- **A switched-off skill:** "Switched off: its step fails or is skipped when it runs. This is what it would send if it were on."
- **Nothing to show** (`why_missing`): the reason, for example "No collected pages yet: run a collection first."

### 2.4 Phase 3: your unsaved edit (decision D3)

- **While the skill text has unsaved changes,** the section rebuilds from the draft, 600 ms after typing stops. A badge says "Showing your unsaved edit".
- **Discard changes** goes back to the saved text.
- **A draft with a blank that doesn't match** shows Save's own message inside the section, in place of the example. The Save button behaves as it does today.

---

## 3. Words

| Where | Text |
|---|---|
| Section title | What it turns into |
| Under the title | Built from today's settings and the pages collected so far. No model calls. |
| Part titles | How many versions · Where the blanks are filled from · A real one |
| Last run, counted | Last {collection / assessment} run, {date}: {n} prompts |
| Last run, not counted | Not counted: {reason} |
| No blanks | None: the text is sent as it is. |
| Server setting | server setting, not editable here |
| Folded part | Show all {n} characters |
| Cut part | … and {n} more characters, which the model gets but which aren't shown here |
| Size | About {n} tokens · {n} characters |
| Phase 3 badge | Showing your unsaved edit |
| Page help, new bullet | What it turns into shows how many versions of this skill the radar sends, where each blank is filled from, and a real example built from today's settings. Building it costs no model calls. |

---

## 4. Files

| File | Change |
|---|---|
| `components/SkillPreview.tsx` | **New.** The section. Props: `{ name, draft? }`, where `draft` is used in phase 3 only. It reads `GET /api/prompts/{name}/preview` with the switch values from the page address |
| `lib/prompts.ts` | The types for the preview response |
| `app/admin/(setup)/prompts/[name]/page.tsx` | Renders `<SkillPreview>` below the card, removes the Variables block from "Where it acts" (§2.2), and adds the new help bullet. In phase 3 it passes the draft when there are unsaved changes |
| `app/admin/(setup)/prompts/page.tsx` | One more help line |

No new packages.

---

## 5. States

- **Loading:** "Building the example…", shown under the switches. The rest of the page stays usable.
- **Backend down or erroring:** the existing `BackendError` component.
- **A switch value the API refuses:** the API's reason. The page shouldn't send one, but an old copied link might.
- **Switching:** only the example and the switch notes reload. The parts above stay put.

---

## 6. Checks

- **Clean build:** lint, type check and build all pass.
- **Headless Chromium, on all 12 skill pages:**
  - the section renders;
  - changing technology, fabric and measure changes the example and the address;
  - long parts fold and unfold;
  - every "from" link opens the right Setup page;
  - nothing scrolls sideways at 400 px wide.
- **Phase 3:**
  - typing changes the example after the pause;
  - a mismatched blank shows Save's message;
  - Discard changes goes back to the saved version.

---

## 7. Build notes

Built and put live on 6 Oct.

**Changes:**
- **New:** `components/SkillPreview.tsx`.
- **`lib/prompts.ts`:** the response types.
- **The skill page:**
  - the section sits below the card, inside `Suspense`, which is what Next.js 16 asks for when a component reads the page address;
  - the Variables block left "Where it acts";
  - there's one new help bullet.
- **The Skills list:** one more help line.

**Built as planned, with one addition:** "Building the example…" now also shows before the first answer arrives. The first browser check found the section blank for that moment.

**Checks:**
- Lint, type check and production build are clean.
- 38 headless-Chromium checks pass on the live portal:
  - all 12 skill pages show the three parts, an example and the last run;
  - changing the technology rebuilds the example and the address;
  - long parts fold, and Show all opens them;
  - the links to Measures, Fabrics and Weights & Grid work;
  - a copied address opens the same example;
  - nothing scrolls sideways at 400 px;
  - typing an unsaved edit rebuilds the example;
  - a missing blank shows Save's own message;
  - Discard changes goes back to the saved text;
  - there are no page errors.
- The unsaved-edit check never pressed Save.
- Two failures in the first browser run were faults in my check script: it read the card titles case-sensitively, though they're shown in capitals, and it checked before the first answer arrived. The portal itself was fine.
