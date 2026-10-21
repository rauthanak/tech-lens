# UI suggestions: a more intuitive, free-flowing Tech Lens

**App:** tech-lens (portal) · **Date:** 2026-10-03 · **Status:** suggestions for discussion, revised after review. No code has changed yet.
**Builds on:** [implementation plan 1](../1/implementation-plan.md), which is built and running.

> **Revised 3 Oct after review:**
> - Findings now lead the Briefing.
> - "Last collected 3 Oct" replaces "Up to date".
> - New evidence counts pages, not only signals.
> - "Set aside" stays, and now says what it means.
> - The "Technologies moving" box is gone.
> - The process stays visible at every step of the rollout.
>
> Decisions are recorded in §13, including **Never miss / Can ignore**. A Tata Communications look is added in §7.

---

## 1. The problem

Today the portal is organized around how the radar works: collect, signals, organize, assess, write. It shows that machinery on every page.

- **Readers** come to learn what's new and what matters. They have to translate pipeline states into findings themselves.
- **Operators** get several things asking for attention at once, with no order.

The portal feels busy rather than guided.

**What we see in the current build:**
- **Two menus for one process.** The strip shows the five steps, and the sidebar lists them again. A setup page, Sources, lights up step 1.
- **The strip is on every page.** It takes the top of each screen, and up to three boxes can call for you at once, with no order between them.
- **Numbers have no label and no time frame.** "30 (30 new)", "22 · 10 other · 0 set aside" and "6/6" only make sense if you already know what each one counts.
- **Internal words.** Other, Re-check, Under the hood, incomplete. "Set aside" is the right term, but nothing says what it means.
- **The Overview is a wall of counts.** The product itself, the findings, is two clicks away.
- **No thread to follow.** To trace one technology from a signal to its Point of View, you cross five pages and go back to the menu each time.
- **The look isn't the client's.** The copper colour and serif titles came from an earlier prototype, not from Tata Communications.

---

## 2. Who uses it, and what for

| Person | Comes to | How often | Needs |
|---|---|---|---|
| **Reader** (business, leadership) | Learn what's new and what matters | Weekly, often less | Findings in plain words; Points of View |
| **Analyst** (owner of the radar) | Review signals, tidy technologies, assess, write Points of View | Weekly | One clear next step; one place per technology |
| **Operator** (admin) | Run collections; keep sources and settings healthy | When something needs it | Status, problems, settings |

One portal serves all three, with no separate reader view for now (§13). The design serves the reader first, guides the analyst, and keeps the operator's tools one level down.

---

## 3. Principles

1. **Findings first, machinery on demand.** The home page answers "what's new?". The pipeline appears where you run it.
2. **One home per question.** Each thing lives in one place. No two menus show the same list.
3. **Always one clear next step.** Things waiting for you appear in process order, one sentence each, with one button and the cost.
4. **Follow the thread.** Every item links forward and back: signal, technology, assessment, Point of View, source page. You never need the menu to continue.
5. **Quiet status.** Background work shows in one small place, not as a banner on every page.
6. **Plain words that claim no more than we know.** Every number has a label and a time frame, such as "in the last collection (3 Oct)". Say "Last collected 3 Oct", not "Up to date".
7. **Detail in layers.** Summary, then detail, then technical details. Each layer is a click away, never shown by default.

---

## 4. New structure

Four everyday places and two working areas:

```
Briefing            home: what's new, and what's waiting for the analyst
Signals             the feed: on the list, not on the list, set aside
Technologies        the hub: one page per technology, from signals to Point of View
Points of View      the deliverables
──────────────
Operations          the process: collections, checks, assessment runs, history, problems
Setup               sources, signal list, scoring method, skills, crawl settings, changes
```

A top bar with these four places and an "⋯" for Operations and Setup is simpler than today's 11-item sidebar. A short left sidebar with the same six entries works too.

**Where today's pages go:**

| Today | Becomes |
|---|---|
| Overview | **Briefing** |
| Process strip on every page | a **status pill** in the header, plus **the process view** on Operations |
| Collect evidence (runs list and run page) | Operations → Collections |
| Signals, with four tabs | **Signals**: one feed, with a switch for On the list / Not on the list / Set aside |
| Technologies, plus Assessments as a menu item | **Technologies**: each page shows its assessment and Point of View. Batch assessment runs move to Operations |
| Points of View | Points of View |
| Sources, Signal list, Scoring method, Skills, Changes | **Setup**: one page with its own side menu, and the Changes count on its entry |
| Under the hood switch | "Technical details", inside Operations and Setup only |

Nothing leaves the menu before its new home exists (§11).

---

## 5. Key screens

### 5.1 Briefing (home)

**Purpose:** know what's new within 10 seconds. If you run the radar, see next what's waiting for you.

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│ Tech Lens  Briefing  Signals  Technologies  Points of View  ⋯   ● Last collected 3 Oct │
├────────────────────────────────────────────────────────────────────────────────────────┤
│ Radar briefing                                              Collected 27 Sep – 3 Oct ▾ │
│ Last collected 3 Oct from 6 sources · 30 new pages · 3 problems →                      │
│                                                                                        │
│ What's new, by technology                                                              │
│ Open-weight language models · 3 new pages · 2 signals · assessed 7 Sep          Open → │
│   ● Product launch   Aleph Alpha releases Kolibri, a sovereign open model              │
│     Why it matters: on-premises AI for regulated sectors · aleph-alpha.com             │
│   ● Open-source milestone   Kolibri weights published under Apache 2.0                 │
│     and 1 more new page                                                                │
│ Post-quantum cryptography · 1 new page · 1 signal · not assessed yet            Open → │
│   ● Standard milestone   IETF working group adopts …                                   │
│ No technology yet · 1 signal                                                           │
│   ● Funding round   …                                                                  │
│ …                                                                                      │
│                                                                   See all 22 signals → │
│                                                                                        │
│ ┌ For the analyst ─────────────────────┐   New Points of View                          │
│ │ 1  216 older pages not yet checked   │   PQC in carrier networks · P2 · 3 Oct        │
│ │    against the signal list           │   …                                           │
│ │    [ Check · ~216 model calls ]      │                                               │
│ │ 2  6 technologies have new pages     │                                               │
│ │    since their assessment            │                                               │
│ │    [ Assess · ~230 model calls ]     │                                               │
│ └──────────────────────────────────────┘                                               │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

- **Freshness line first.** One line of fact says:
  - when the last collection ran, and from how many sources;
  - how many new pages it brought;
  - how many problems there are, linked to Operations.

  It tells you how far to trust what follows, so it comes first. It has no buttons.
- **A fixed, labelled time window.** The Briefing shows what was collected in the last 7 days, and says so: "Collected 27 Sep – 3 Oct". The selector also offers 30 days. If nothing was collected in the window, it says when the last collection ran and offers to show that one.
- **What's new, grouped by technology:**
  - Each heading gives counts and the technology's state, and opens its page.
  - Signals come first.
  - Pages without a signal are counted too ("and 1 more new page"), because the assessment reads them.
  - Signals on pages not yet linked to a technology come last, under "No technology yet".
  - Clicking a signal opens the side panel (5.2), so you never lose your place.
  - "See all" opens Signals for the same window.
- **For the analyst:** at most three items, in process order. Each has one sentence, one button and its cost. The box sits below the findings, or beside them on wide screens, and is hidden when nothing is waiting.
- **New Points of View:** the latest ones written.
- **Left out on purpose:**
  - the process line, because the status pill and Operations carry it;
  - a "Technologies moving" box, because the grouping already lists those technologies, and more signals don't mean a technology is maturing.

### 5.2 Signal detail (side panel)

```
┌ Product launch · 3 Oct ─────────────────── × ┐
│ Aleph Alpha releases Kolibri, an open-weight │
│ English-German model (78B, 3B active).       │
│ Who: Aleph Alpha · When: 2026-10-03          │
│ Why it matters: European, sovereign,         │
│ on-premises AI for regulated workloads.      │
│ “Kolibri is an English-German Mixture-of-    │
│  Experts Transformer with 78B total …”       │
│ Source: aleph-alpha.com ↗ · via Hacker News  │
│ Technologies: open-weight language models    │
│ [ Open technology ]   [ Open the page ↗ ]    │
└──────────────────────────────────────────────┘
```

- The same panel opens from every list: Briefing, Signals and the technology page.
- It has its own address, so it can be shared, and Esc closes it.
- A "Not on the list" item also offers **Make it a signal**.

### 5.3 Signals (the feed)

```
Signals                   [ On the list 22 ]  [ Not on the list 10 ]  [ Set aside 32 ]
Collected 27 Sep – 3 Oct ▾                                             Tune the list →
┌ Filter ─────────────┐  ┌──────────────────────────────────────────────────────────┐
│ Signal type         │  │ ● Product launch · 3 Oct                                 │
│ ☑ Product launch  6 │  │   Aleph Alpha releases Kolibri …                         │
│ ☐ Research        6 │  │   open-weight language models · aleph-alpha.com          │
│ ☐ Standard        6 │  │ ● Standard milestone · 3 Oct                             │
│ Technology [_____]  │  │   IETF working group adopts …                            │
│ Source     [ ▾ ]    │  │ ● Research breakthrough · 1 Oct                          │
│                     │  │   Calibration estimator 40× faster than EM …             │
└─────────────────────┘  └──────────────────────────────────────────────────────────┘
```

- **The switch replaces today's four tabs.** "Not on the list" groups similar developments, each with Make it a signal.
- **Set aside** lists each page with the rule that set it aside, and says what that means: *kept, but not used for technologies or assessments*.
  - A Can ignore rule sets a page aside only when the whole page is that kind of content and carries no signal.
  - Never miss always wins.
  - This is how it works today; only the name changes.
- **The filter shows counts,** so you can see where the signals are before clicking.
- **Editing the signal list belongs in Setup.** A "Tune the list →" link sits at the top of the feed.

### 5.4 Technology: the hub

This page is what makes the portal free-flowing. Everything about one technology sits on one page, in the order of the story.

```
← Signals
Open-weight language models                                   [ Assess now ]  Manage ▾
Assessed 7 Sep · P2 · H1 (near) · read 9 pages from 2 collections · 3 new pages since

What's happening                                                          newest first
  3 Oct  Product launch          Aleph Alpha releases Kolibri …        ↗
  3 Oct  Open-source milestone   weights published under Apache 2.0    ↗
  2 Oct  New page                Kolibri model card on Hugging Face    ↗
                                                               All signals and pages →

Assessment · 7 Sep                            Point of View
  Market potential    ███████░░  7.0          “Open-weight models move into
  Strategic fit       ████████░  8.0           regulated, on-premises use …”
  Adoption readiness  ████░░░░░  4.5          Written 8 Sep · version 2
  Priority P2 · horizon H1 (near)             New since written: 3 pages
  Evidence from collections 7 Sep, 11 Aug     [ Open ]   [ Rewrite ]

Evidence pages (12 · 3 new)                                                     show ▾
```

- **The main button changes with the state:**
  - "Assess now" when the technology has new pages since its assessment, or has never been assessed;
  - "Write Point of View" when it's assessed but has none;
  - "Open Point of View" when one exists and nothing new has arrived.
- **New evidence, defined once:** a page counts as new for a technology when all of these hold:
  - it is linked to the technology;
  - it wasn't set aside;
  - it is new or changed since the technology's latest assessment.

  Pages without a signal count, because the assessment reads every linked page. Pages collected again but unchanged don't count.
- **"New since written: 3 pages"** on the Point of View says what arrived after it was written. It states the fact and leaves the judgement to the analyst.
- **Manage ▾** holds rename, merge and aliases. These are curation tools, so they stay out of the way.
- **The Assessments menu item goes in phase 3.** Each technology then shows its own latest assessment, and batch runs live in Operations.

### 5.5 Points of View (library)

- Cards show the headline, priority, horizon, fabric and date. The fabric label uses its brand colour (§7). Filters cover priority, horizon and fabric.
- A **"New since written: N pages"** badge appears when new evidence arrived after writing.
- Opening a card shows the client document, as today, with a "← technology" link back.

### 5.6 Operations (the process)

This is the one place that shows the whole process, for whoever runs the radar. It exists from phase 1, holding today's strip, collections list and assessment runs. Phase 4 turns it into the board below.

```
Operations                                                         Technical details ○
Collect ───────▶ Check signals ──▶ Organize ──────▶ Assess ────────▶ Points of View
✓ 3 Oct          216 pages not     ✓ automatic,     6 technologies   1 to write
30 new pages     yet checked       after collect    have new pages
[ Collect now ]  [ Check again ]                    [ Assess ]       [ Write ]

Problems (3)
  IETF didn't finish: 1,081 links left. Raise the page budget or narrow it.    [ Fix ]
  SEC filings not configured: add CONTACT_EMAIL to .env.                       [ How ]
  EPO patents not configured: add the EPO keys to .env.                        [ How ]

History
  3 Oct  Collection   30 new pages · 22 signals · 1 source didn't finish             →
  3 Oct  Assessment   1 technology · 38 model calls                                  →
```

- **The board replaces today's process strip.** It appears here only.
- **Problems gather what is scattered across run pages today:** sources that didn't finish, data sources without keys, failed pages. Each has one fix.
- **History lists collections and assessment runs together,** newest first. A row opens today's run page.
- **Technical details** (agents, stages, model calls) appear only with that switch on.

### 5.7 Setup

- **One page with a side menu:** Sources, Signal list (Never miss / Can ignore), Scoring method, Skills, Crawl settings, and Changes with its count.
- **The same edit pattern everywhere:** the list on the left, the editor on the right, and a note after saving: "Saved. Applies from the next run. Listed in Changes."
- **Changes stays as built.** Edits apply at once; "Update seeding data" writes the ticked ones.

---

## 6. Patterns used everywhere

- **Status pill (top right):** replaces the strip on every page.

  ```
  ● Last collected 3 Oct                 nothing running
  ● Collecting · 12 of 40 pages          while a job runs
  ● Last collected 3 Oct · 3 problems    something to fix

  Opened:
  ┌──────────────────────────────────────────────────┐
  │ Running          Collecting 12/40   ███░░░       │
  │ For the analyst  2 things           → Briefing   │
  │ Problems         3                  → Operations │
  └──────────────────────────────────────────────────┘
  ```

- **Next step after every action** (from phase 2, once the count per technology exists): when something finishes, a line proposes the next step, so the weekly loop flows without the menu.
  ```
  ✓ Checked 216 pages: 40 signals found, 32 set aside.
    Next: 6 technologies have new pages since their assessment.
    [ Assess them · ~230 model calls ]   [ Later ]
  ```
- **Cost before spending:** any button that uses the model shows its estimate, such as "~216 model calls".
- **Side panels for detail:** signals, pages and sources open over the list, never in a new page that loses your place.
- **Back to where you came from:** each detail page starts with "← Signals", "← Technology" and so on.
- **One main button per view.** Secondary actions are links.
- **Colour never stands alone, and each colour has one job:**
  - azure for focus: what's selected, and what's waiting for you;
  - red for failures;
  - grey for done or switched off;
  - the four fabric colours for the fabrics.

  A colour always comes with a word or a name. Details are in §7.
- **Empty states that teach.** The first visit says "Start your first collection" and explains, in one sentence, what will happen.

---

## 7. Look and feel: Tata Communications

These colours and fonts were read from tatacommunications.com's stylesheets on 3 Oct 2026. Confirm them against the client's brand guidelines before building. The logo files and the font licence should come from their brand team, not the website.

**What their site does**
- **It's dark.** The ground is near-black (#040A0E) with light text. The header fades from near-black through deep indigo (#080F37) to an azure glow (#00A4FF).
- **Azure** (#00A4FF / #00AFFD) is the brand's action colour. On light pages, buttons and headings use **navy** (#041A4A).
- **Gotham** is used throughout. Headings use Gotham Book at regular weight with slightly tight letter-spacing (−0.02em); Gotham Medium is for emphasis.
- **Shapes:** pill-shaped buttons (28px radius), cards with 10px corners, thin borders, flat surfaces with little shadow.
- **One colour per business line:** Network teal (#3CC3C2), Cloud orange (#FF8437) and IoT green (#59CA80), plus Kaleyra red, Media violet and Commotion purple.

**For Tech Lens**
- **Light pages under a dark brand header.** Long summaries, tables and printed Points of View read better on a light ground. The dark gradient bar carries the brand on every page.
- **Our four fabrics are the client's own.** Network, Cloud, Interaction and IoT are the names of the client's Digital Fabric, so each fabric label takes its business line's colour.
  - The site has no colour for Interaction.
  - Commotion purple is the nearest one that won't read as an error. To be confirmed.

| Use | Colour | Notes |
|---|---|---|
| Header bar | #040A0E → #080F37, azure glow #00A4FF | White text and the white logo |
| Page ground | #F4F6F9 | Not from the site: a cool off-white that sits with navy |
| Cards and panels | #FFFFFF | |
| Text | #040A0E | Their own light-mode text colour |
| Secondary text | #494A52 | Labels, dates |
| Lines | #D1D6DC | Borders and dividers |
| Main button | #041A4A with white text, pill-shaped | One per view |
| Links | #0270E0 | Their link colour; readable on white |
| Focus | #00A4FF | Status pill dot, "For the analyst" marker, focus ring, active tab |
| Failed | #F0424C dot, #B60F17 text | Red means failed and nothing else |
| Done, off, didn't finish | grey ✓, grey ○, dark ◐, each with its word | Status stays quiet. Orange and green belong to the fabrics |
| Fabrics | Network #3CC3C2 · Cloud #FF8437 · IoT #59CA80 · Interaction #9E4AFF | On fabric labels only, always with the name |

- **Contrast:**
  - Text on a coloured fill is dark (#040A0E). It reads well on azure, teal, orange, green and purple.
  - White text is used only on navy and on the header.
  - Azure text on white is too faint (2.7:1). Azure is used as a fill, a dot or a line, never as text on white.
- **Type:**
  - Gotham, if the client's licence covers this tool. Otherwise Montserrat, the usual free match, bundled with the portal.
  - Headings at regular weight with −0.02em letter-spacing; body text at 16px with a 1.6 line height.
  - This replaces today's Georgia page titles.
- **Shapes:** pill buttons, 10px card corners, 1px lines, no heavy shadows.
- **Points of View** print with the same colours, type and fabric labels, so the deliverable looks like Tata Communications.
- **A dark theme can follow later.** Their own dark palette (#040A0E ground, #E0E0E0 text, azure accents) maps onto the same named colours.
- **Effort:** the copper colour is typed in directly about 50 times across 22 files. Phase 1 replaces those with named colours, so any later change is one edit.

---

## 8. Words

| Today | Suggested | Why |
|---|---|---|
| Collect evidence / Identify signals / Organize technologies / Assess opportunities | Collect / Signals / Technologies / Assess | Shorter; the place names carry the meaning |
| Never miss / Always ignore | **Never miss / Can ignore** | Decided 3 Oct. "Always" was never true: a never-miss signal wins, and set-aside pages stay visible |
| Other | Not on the list | Says what it is |
| Set aside | keep, with "kept, but not used for technologies or assessments" | Those pages were collected and summarized; "Skipped" would say they weren't |
| Re-check | Check again | Plain verb |
| incomplete / page budget reached | didn't finish: N links left | Says what happened and what is left |
| Up to date | Last collected 3 Oct | Says what we know, no more |
| Needs updating | New since written: N pages | A fact; the judgement stays with the analyst |
| Technologies moving | dropped | The Briefing's grouping lists them; signal counts don't measure maturity |
| Needs you | For the analyst | Tells readers they can skip it |
| Under the hood | Technical details | Plain |
| Seeding data, Update seeding data | keep | Agreed on 3 Oct |
| TORA, P1–P6, H1–H3 | keep, with the meaning on hover | The client's framework |

---

## 9. Three journeys

1. **A reader, Monday morning:** Briefing, then a signal (side panel), then Open technology, then its Point of View. Three clicks, no menu.
2. **The analyst's weekly loop:**
   1. Briefing → For the analyst → Check 216 pages.
   2. When that finishes, a prompt offers "Assess 6 technologies with new pages". Assess them.
   3. When that finishes, a prompt offers "Write 6 Points of View". Write them.

   Each step proposes the next; nothing to remember.
3. **The operator:** the status pill says "Last collected 3 Oct · 1 problem". Operations → Problems → Fix opens that source in Setup. Raise its budget, and the note says it's saved for the next collection.

---

## 10. What we keep, and what we add

Most of the work is moving and regrouping, not rebuilding.

- **APIs we keep:**
  - `/api/pipeline` feeds the status pill, Operations, and the "For the analyst" items about collecting and checking. It only knows timing for the workspace as a whole ("a collection finished after the last assessment run"), so it never makes a claim about one technology.
  - The signals endpoints feed Briefing, Signals and the technology page.
  - Changes, sources and settings stay as they are.
- **Components we keep:** SignalChip, ListEditor, EvidenceLine, the Changes page, the source editor, and the run page's recorded facts (opened from Operations → History).
- **Small backend additions:**
  - **New evidence per technology,** as defined in 5.4. `GET /api/technologies/{id}/summary` returns:
    - the latest assessment;
    - the Point of View's state;
    - the new pages since the assessment, and since the Point of View was written.

    A list form tells the Briefing and "For the analyst" which technologies have new pages. It's one query over pages already stored.
  - **Signals by collection date and technology:** one extra filter on `/api/signals/found`, for the Briefing's window and grouping.
- **Never miss / Can ignore, end to end.** One name runs from the seeding data to the screen. It is used:
  - on screen;
  - in the summarizing prompt;
  - in the stored data, where `always_ignore` becomes `can_ignore`.

  The behaviour doesn't change. Renaming the stored value does change the signal list's fingerprint, so every page would show as not yet checked. On the deployed stack that costs nothing today, because all 240 pages there are still unchecked. The rename can go ahead of phase 1 as a small change, but it must land before those pages are first checked.

---

## 11. Phasing: small steps, each one demoable

1. **Look and words.** No new pages except Operations:
   - the Tata Communications look (§7);
   - plain words (§8), including Never miss / Can ignore;
   - a label and time frame on every number, and the cost on every model button;
   - one menu in the new order;
   - **Operations added,** reusing today's strip, collections list and assessment runs. The strip then leaves the other pages, and the status pill arrives.
2. **Briefing replaces the Overview.** This phase also adds the count of new evidence per technology, and the next-step prompts, which need that count to be truthful.
3. **Technology hub.** The Assessments menu entry goes, because single assessments now live on each technology and batch runs on Operations. Points of View show "New since written".
4. **Operations board and Setup.** Operations becomes the board with Problems and History, Setup is regrouped, and Technical details moves there.

**One rule throughout:** nothing leaves the menu before its new home exists, so the process view the business asked for stays visible at every step.

---

## 12. How we'll know it works

- A first-time reader can say what's new within 10 seconds of landing.
- Any signal leads to its Point of View in three clicks or fewer, without the menu.
- Outside the Briefing, at most one call to action is visible at a time.
- In the business demo, nobody asks "where do I see …?".

---

## 13. Decisions and open points

**Decided on 3 Oct:**
- One portal for readers, analysts and operators; no separate reader view for now.
- The Briefing groups by technology and covers a fixed, labelled window: the last 7 days, by collection date.
- **Never miss / Can ignore**, applied end to end (§10).
- "Set aside" stays, with its meaning shown: kept, but not used for technologies or assessments.
- The look follows Tata Communications (§7).

**For the client's brand team:**
1. Is Gotham licensed for internal tools, or should we use Montserrat?
2. Logo files for a dark header.
3. A colour for the Interaction fabric: Commotion purple is suggested.
