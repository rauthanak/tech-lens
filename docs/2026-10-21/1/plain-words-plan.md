# Make the app readable for a newcomer (21 Oct 2026)

Written after the user's review on 21 Oct: "So hard to understand and interpret for a layman or newcomer", seven named
problems, Organize and Classify that "did nothing", and the Mechanisms page that "on click just collapses".

What went wrong: piece after piece was added to the same screens, each fully open, each with its own words, and checked
for "does it work", not read top to bottom as a newcomer. The Cloud tab of Agentic AI is about 5,900 px of open text: two
use cases × two levers × five boxes (20 boxes), a seven-row ladder with seven buttons, a full finance form. People's
names stand in for descriptions in 15 places ("Tri's seven steps", "Nick's ladder").

The fix is mostly fewer words and less on screen at once, not new features.

## A. Bugs found today

1. **Classify never clears its count.** It runs (44 of 44, 0 failed) but "40 technologies have new pages to classify"
   comes back every time. Two causes in the classifier's record of what it has read:
   - a page visited twice, whose content changed, has two versions; the classifier reads the newer one and records only
     that, while the count counts both, so the older one looks unread forever;
   - when there is nothing new to read, it records nothing at all, so the same technologies come back.
   Fix: record every version of a page it has seen, also when nothing new was read. A test with a page visited twice.
2. **Organize and Classify give no sign they ran.** Organize took 3 seconds (6 new names looked at, 3 model calls); the
   card said "last Oct 21" before and after. Fix: each card says when it last ran, to the minute, and what it did:
   "Last organized Oct 21, 2:12 AM · 6 new names looked at"; "Classified Oct 21, 2:12 AM · 5 updated, 39 had nothing new".
3. **Setup lists hide every definition when one is clicked** (Mechanisms, Path to scale, Assumptions, Domains, TRL,
   Classification: one shared list). Fix: the row you click opens into its edit form in place; every other row keeps its
   definition; the text box is tall enough to read the definition. The note under Save says what saving does on that page
   (on Mechanisms: "applies from the next assessment"), not the classification rule it shows now.

## B. The seven points

1. **Briefing: Before scoring, Before publishing, Publish the edition** become collapsible cards. Closed, each still says
   what waits: "Before scoring · 5 lists · 236 technologies". Open or closed is remembered in your browser. The
   "Gate 1 / Gate 2 / Ends Gate 2" chips go: the titles already say it.

2. **"Use cases · where the value lands in Cloud"**: the heading leads with Use cases. Each use case: its title in bold,
   then "Capital needed: light · …", then each lever as one plain line:
   - "Earns: Offer a managed, India-hosted runtime … · Earn additional contribution"
   - "Saves: Use machine-speed anomaly detection … · Reduce the cost of an equivalent outcome"

   The five boxes (operating change → metric → financial effect → evidence needed → next step) open under "Show how it
   makes money". Closed by default.

3. **"Execution bottlenecks in Cloud"** becomes **"What could stop it scaling in Cloud"**:
   - What it is: problems that commonly stop a technology growing into a real business in Cloud, for example customers'
     data being hard to move across. Cloud's list is kept in Setup › Fabrics.
   - What you do: tick the ones that apply to Agentic AI in Cloud, or write your own. Leave it if you don't know yet.
   - Where it shows: leaders see them on Frontier and in the Point of View; picking them is one of the things needed for
     the owner's plan to count as agreed (point 6).
   - Option (your call): the model suggests which apply, each with the page and quote it read it on, and a person ticks
     or dismisses them, as suggested use cases work now. It fits in the existing use-case call (no extra calls) but needs a
     skill change and a re-run before it shows.

4. **"Path to scale in Cloud"** becomes **"How far Tata has got with it in Cloud"**, with:
   "The seven steps a technology goes through at Tata, from a first look (Evaluation) to full investment. Each step says
   the proof needed to reach it and the decision it then lets Tata make. Record the step Tata has reached; the radar then
   shows what is still missing for the next one."
   - "Evidence it needs" → "Proof needed to reach it"; "Decision it supports" → "Then Tata can decide to".
   - Beta, Roadmap and Investment have no proof defined yet: one line instead of three rows of "For Tata to define".
   - Where the steps came from (Tri's process, Nick's value note) moves to "How to read this page" as a credit.

5. **The "Set at …" buttons.** Today: each records that Tata has reached that step with this technology in this fabric.
   A person's record (the model never sets it); it moves "Reached", changes what the radar says is needed next, and shows
   on Frontier and the Point of View. Seven identical buttons with no sentence is the problem. Proposed: one line on top:
   "Tata has reached **Evaluation** · set by a person on Oct 21, 2:08 AM · Change step". "Change step" turns the
   ladder into a choice (one per step) with Save and Cancel and the sentence "Pick the step Tata has actually reached.
   Only a person sets this." The ladder is read-only otherwise.

6. **"What a leader records in Cloud"** becomes **"Who owns it at Tata, and what's next"**:
   - What it is: the Tata person accountable for Agentic AI in Cloud, their next action and its date, and anything
     committed (people, budget, a trial). Typed in by people; it never changes a score.
   - Where it shows: Frontier, the leaders' view, puts one of four states next to the technology, so leaders see which
     bets have an owner and resources.
   - The four states shown with their meaning always beside them, not in a tooltip: no owner yet → owner and next
     action named → step and blockers agreed too → people, budget or a trial committed. Wording: your call (the deck's
     Undefined / Defined / Aligned / Integrated, or plain words).

7. **Findings vs pages.** A page is an article or report the radar collected that mentions the technology (121 for
   Agentic AI). A finding is one event the radar picked out of a page (a funding round, an acquisition, a launch), with
   a sentence on why it matters (134: one page can hold several events, many hold none). Fix: one heading, "Evidence",
   with that sentence, and two tabs: "Findings · events (134)" and "Pages · articles (121)".

## C. The same rules on every page

- A heading says what a thing is. People's names appear only in "How to read this page", as credit (15 places today).
- Each section on a technology's fabric tab has three short lines: what it is, what you do here, where it shows up.
  One shared section component carries them, replacing five copies of the same markup.
- Long detail is closed by default, with a one-line summary when closed: settled measures, the five-box chains, the
  finance form, steps with nothing defined.
- No bare button: each says what it does, in its label or a line beside it.
- Every action shows its result, or why it didn't happen.
- Internal words (Gate, mechanism, lever chain, stacked, compose, organize, classify) get plain words or a one-line meaning.
- Target: the Cloud tab of Agentic AI from about 5,900 px to about 2,000 px with everything closed.
- Check: screenshots of every page before and after, read top to bottom as a newcomer; a list of every heading and
  button with its one-line meaning, for you to scan.

## D. Held until this is settled

- Rewriting all Points of View (about 250 calls), publishing the first edition, the client document v5.
- The value-lever refresh finished: 498 of 516 technology-fabric pairs updated; 18 kept their earlier use cases, each
  with its reason in the log (mostly a missing lever).

## Signed off, 21 Oct

- All of it: A, B and C.
- Path steps: one line on top with "Change step" (the ladder turns into a pick-one list with Save and Cancel).
- Blockers: the model suggests which apply, each with its page and quote; a person ticks or dismisses. Needs the use-case
  skill changed and the use-case call re-run on every latest assessment (about 516 calls, as the lever refresh).
- Owner states: the deck's words (Undefined / Defined / Aligned / Integrated) with the meaning always beside each.

## Built, 21 Oct (live)

- A.1 Classify: every version of a page it has seen is recorded, also when nothing new is read (classifier/evidence.py,
  classify.py; test_classify). Run live: 40 technologies, 0 model calls, "new pages to classify" 40 → 0.
- A.2 Operations cards: when each step last ran (viewer's zone) and what it did (pipeline `technologies.new_names`,
  `classify.unchanged`); every confirm button says Started / Done, or why not (ConfirmAction).
- A.3 Setup lists edit in place; each page's own note under Save (ListItems).
- B.1 Briefing cards fold, closed by default, remembered per browser; Gate chips gone (GateList BriefingCard).
- B.2–B.7 Fabric tab on components/Section.tsx: plain titles; what it is / what you do / where it shows; lever chains
  folded; Change step; blockers with suggestions; owner states with meanings; finance form closed; Evidence tabs.
- Blocker suggestions: value_levers v3 (`fabric_blockers`, `blockers` → assessment `suggested_bottlenecks`); malformed
  ones dropped, never a retry. Two levers with miscopied ids are taken in the order asked for. Re-run on all 516 latest
  pairs: 514 updated (2 keep earlier use cases: capital missing), 301 with at least one suggestion.
- C: audit of 22 pages (scratchpad audit-pages.md, 121 rows + 12 cross-page) applied by two agents; "Crawl settings"
  is "Settings"; Domains' sub-domain lists fold; skill descriptions plain (seeds); Point of View skill v7 (verdict in
  words, codes with their place on the scale, "blockers").
- Held back, for a decision: "TCL" → "Tata" in measure definitions and fabric profiles (sent to the scoring model);
  the evidence-judging skill's reason (would mean re-classifying about 1,550 technologies).
