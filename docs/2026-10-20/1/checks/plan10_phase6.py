"""Plan 10 (23 Oct) phase 6, the leaders' site at 1440 and 400 px: each pick on
the Overview carries its Point of View's headline; Moved since shows the 8
biggest moves first, each with the score that moved; a Point of View leads
with the answer, then the five answers, then what Tata has committed as
labelled lines, "No owner yet" once; priorities said in the grid's words,
the catalog as Tata's list. Read-only.

    docker cp plan10_phase6.py tech-radar-atlas-1:/tmp/ && docker exec tech-radar-atlas-1 python /tmp/plan10_phase6.py
"""

import os
import re
import sys

from playwright.sync_api import sync_playwright

BASE, OUT, TECH = "http://frontier:3100", "/tmp/shots-after", "agentic-ai"
os.makedirs(OUT, exist_ok=True)
fails: list[str] = []


def check(ok: bool, what: str) -> None:
    print(("ok   " if ok else "FAIL ") + what)
    if not ok:
        fails.append(what)


def settle(pg, ms=3500):
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

        pg.goto(f"{BASE}/frontier")
        settle(pg)
        act = pg.locator("section[aria-label='Act now: P1']")
        if act.count() and act.locator("li").count():
            heads = act.locator("li span.line-clamp-2").count()
            check(heads > 0, f"{width} px Act now: each pick carries its headline ({heads} of {act.locator('li').count()})")
        moved = pg.locator("section[aria-label='Moved since the last edition']")
        if moved.count():
            rows = moved.locator("li").count()
            text = moved.inner_text()
            total = re.search(r"· (\d+)", text)
            n = int(total.group(1)) if total else 0
            check(rows == min(n, 8), f"{width} px Moved since: the {min(n, 8)} biggest first ({rows} of {n})")
            check("how soon" in text or "how big" in text, f"{width} px Moved since: says which score moved")
            if n > 8:
                check(f"Show all {n}" in text, f"{width} px Moved since: Show all {n}")
            if shot:
                moved.screenshot(path=f"{OUT}/plan10-6-moved.png")
                pg.locator("section[aria-label='Act now: P1']").screenshot(path=f"{OUT}/plan10-6-act.png")
        check(fits(), f"{width} px Overview: no sideways scroll")
        height = pg.evaluate("document.documentElement.scrollHeight")
        if width == 400:  # a phone opens on the table: 50 placements a page (it was 33,922 px with all of them)
            check(height < 10000 and pg.locator("text=/of [\\d,]+ placements/").count() > 0,
                  f"400 px Overview: the table in pages of 50 ({height:,} px)")

        pg.goto(f"{BASE}/frontier/pov/x/{TECH}")
        settle(pg)
        main = pg.inner_text("main")
        headline = main.find("Agentic AI is")
        answers = main.find("PRIORITY")
        committed = main.find("WHAT TATA HAS COMMITTED")
        check(0 < headline < answers < committed, f"{width} px Point of View: headline, then answers, then commitments ({headline}, {answers}, {committed})")
        box = pg.locator("section[aria-label='What Tata has committed']").inner_text()
        check(box.count("No owner yet") == 1, f"{width} px Point of View: No owner yet said once ({box.count('No owner yet')})")
        check("Owner" in box and "Next" in box and "By" in box, f"{width} px Point of View: commitments as labelled lines")
        check(". by" not in box and "next, " not in box, f"{width} px Point of View: no run-on glitches")
        why = pg.locator("ul[aria-label='Why each priority']")
        check(why.count() == 1 and "because it arrives" in why.inner_text() and "how big" in why.inner_text(),
              f"{width} px Point of View: each priority said in the grid's words")
        check("xlsx" not in main and "From Tata's technology list" in main, f"{width} px Point of View: the catalog as Tata's list")
        check("Market Potential" not in pg.locator("section:has(h2:text-is('Scores'))").inner_text(),
              f"{width} px Point of View: score names in sentence case")
        if shot:
            pg.locator("section[aria-label='What Tata has committed']").screenshot(path=f"{OUT}/plan10-6-committed.png")
            pg.locator("section:has(h2:text-is('Scores'))").screenshot(path=f"{OUT}/plan10-6-scores.png")
        check(fits(), f"{width} px Point of View: no sideways scroll")
        check(not errors, f"{width} px: no page errors {errors[:2]}")
        ctx.close()
    browser.close()

print("\nall passed" if not fails else f"\n{len(fails)} failed")
sys.exit(1 if fails else 0)
