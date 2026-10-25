"""Plan 10 (23 Oct) phase 1, as a first-time reader on the live portal, at
1440 and 400 px: Classify finished in two parts says so plainly; History
says why a Classify stopped; websites not read to the end, counted one way;
the priority grid counts each cell; the leaders' Act corner is exactly P1,
with an Act now card; weights show their real share; Changes lists people's
edits, not the model's proposals; measures say which wait for Tata's
figures; the catalog note lists each file once; regulators have their own
group. Starts nothing that costs.

    docker cp plan10_phase1.py tech-radar-atlas-1:/tmp/ && docker exec tech-radar-atlas-1 python /tmp/plan10_phase1.py
"""

import os
import re
import sys

from playwright.sync_api import sync_playwright

BASE, FRONT, OUT = "http://lens:3100", "http://frontier:3100", "/tmp/shots-after"
RUN, SCORING, TECH = "3ba3d120703a", "88d8dfb82df9", "agentic-ai"
os.makedirs(OUT, exist_ok=True)
fails: list[str] = []


def check(ok: bool, what: str) -> None:
    print(("ok   " if ok else "FAIL ") + what)
    if not ok:
        fails.append(what)


def settle(pg, ms=3000):
    pg.wait_for_load_state("networkidle")
    pg.wait_for_timeout(ms)


with sync_playwright() as p:
    browser = p.chromium.launch()
    for width in (1440, 400):
        shot = width == 1440
        ctx = browser.new_context(viewport={"width": width, "height": 1000}, timezone_id="America/Chicago")
        pg = ctx.new_page()
        errors: list[str] = []
        pg.on("pageerror", lambda e: errors.append(str(e)))
        fits = lambda: pg.evaluate("document.documentElement.scrollWidth <= window.innerWidth + 1")  # noqa: E731

        # §1: the collection's Classify, finished in two parts
        pg.goto(f"{BASE}/admin/runs/{RUN}")
        settle(pg)
        main = pg.inner_text("main")
        check("technologies with new pages judged: 2,908 during" in main and "the rest by a later Classify" in main,
              f"{width} px run: Classify says it finished in two parts")
        check("spending limit that was removed on Oct 22" in main and "token limit" not in main,
              f"{width} px run: why the first part stopped, in plain words")
        check("weren't read to the end" in main, f"{width} px run: websites not read to the end, one wording")
        check(fits(), f"{width} px run: no sideways scroll")
        if shot:
            step = pg.locator("li, section, div").filter(has_text="Classify: judge evidence").last
            step.screenshot(path=f"{OUT}/plan10-1-classify.png")

        # Operations: Coverage's wording; History (its own tab since phase 3) says why Classify stopped
        pg.goto(f"{BASE}/admin/operations")
        settle(pg)
        check("reached the page limit in the latest collection" not in pg.inner_text("main"),
              f"{width} px Operations: no older page-limit wording")
        pg.goto(f"{BASE}/admin/operations/history")
        settle(pg)
        said = False
        for _ in range(6):  # newest first, 50 a page: the Oct 22 Classify may be a page or two in
            if "stopped at the spending limit removed on Oct 22" in pg.inner_text("main"):
                said = True
                break
            nxt = pg.get_by_role("button", name="Next ›").first
            if not nxt.count() or nxt.is_disabled():
                break
            nxt.click()
            settle(pg, 1000)
        check(said, f"{width} px History: says why Classify stopped")

        # A1: the priority grid counts each cell
        pg.goto(f"{BASE}/admin/scoring/assessments/{SCORING}")
        settle(pg, 4000)
        cells = pg.locator("table button[title*=': click to']")
        numbers = [int(n) for n in re.findall(r"\b(\d+)\b", " ".join(cells.all_inner_texts()).replace("P", "x"))]
        priorities = [t.split("\n")[0] for t in cells.all_inner_texts()]
        counts = [t.split("\n")[1] for t in cells.all_inner_texts()]
        twins = {}
        for pr, n in zip(priorities, counts):
            twins.setdefault(pr, []).append(n)
        check(cells.count() == 9, f"{width} px assessment run: nine cells ({cells.count()})")
        check(any(len(set(v)) > 1 for v in twins.values() if len(v) > 1),
              f"{width} px assessment run: cells sharing a priority count their own rows ({twins})")
        if shot:
            pg.locator("table").first.screenshot(path=f"{OUT}/plan10-1-grid.png")

        # A3: weights show their real share; per score they add up to about 100%
        pg.goto(f"{BASE}/admin/scoring/config")
        settle(pg)
        check("should be 1.0" not in pg.inner_text("main"), f"{width} px Weights: no 'should be 1.0' warning wording")

        # A4: Changes lists people's edits; the model's proposals are one line
        pg.goto(f"{BASE}/admin/changes")
        settle(pg)
        main = pg.inner_text("main")
        check("sub-domains the model proposed" in main and "wait for review" in main,
              f"{width} px Changes: the model's proposals are one line, linked to Domains")
        height = pg.evaluate("document.documentElement.scrollHeight")
        check(height < 5000, f"{width} px Changes: a page, not 432,000 px ({height} px)")
        check(not re.search(r"Setup\s*1,?981", pg.inner_text("header")), f"{width} px: the Setup badge no longer says 1,981")
        if shot:
            pg.screenshot(path=f"{OUT}/plan10-1-changes.png")

        # A5: measures say which wait for Tata's figures
        pg.goto(f"{BASE}/admin/technologies/{TECH}")
        settle(pg)
        main = pg.inner_text("main")
        check("measures scored" in main and "wait for your figures" in main and "had enough evidence to score" not in main,
              f"{width} px technology: measures waiting for Tata's figures say so")

        # A7: each catalog file once
        pg.goto(f"{BASE}/admin/technologies")
        settle(pg, 4000)
        check(pg.inner_text("main").count("Emerging-technologies October 2026.xlsx") <= 1,
              f"{width} px Technologies: the catalog file is listed once")

        # A8: regulators have their own group
        pg.goto(f"{BASE}/admin/sources")
        settle(pg)
        check("Regulators and agencies" in pg.inner_text("main"), f"{width} px Sources: regulators have their own group")

        # A2: leaders' Act corner is P1, with its own card
        pg.goto(f"{FRONT}/frontier")
        settle(pg, 4000)
        main = pg.inner_text("main")
        check("Act now: P1" in main, f"{width} px leaders' view: an Act now: P1 card")
        check(fits(), f"{width} px leaders' view: no sideways scroll")
        if shot:
            pg.locator("section[aria-label='Act now: P1']").screenshot(path=f"{OUT}/plan10-1-act-now.png")

        check(not errors, f"{width} px: no page errors {errors[:2]}")
        ctx.close()
    browser.close()

print("\nall passed" if not fails else f"\n{len(fails)} failed")
sys.exit(1 if fails else 0)
