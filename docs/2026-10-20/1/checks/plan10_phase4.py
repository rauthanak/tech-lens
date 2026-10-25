"""Plan 10 (23 Oct) phase 4, on the live portal at 1440 and 400 px: a shorter
Briefing (signs as closed lines with what a threshold is, Kind of finding
as a dropdown instead of a rail, 15 findings a page, To do folded on a
phone); signs to watch on the Fabrics tab as labelled lines, with Edit
threshold; the technology Overview in two columns at 1440. Changes nothing.

    docker cp plan10_phase4.py tech-radar-atlas-1:/tmp/ && docker exec tech-radar-atlas-1 python /tmp/plan10_phase4.py
"""

import os
import sys

from playwright.sync_api import sync_playwright

BASE, OUT, TECH = "http://lens:3100", "/tmp/shots-after", "agentic-ai"
os.makedirs(OUT, exist_ok=True)
fails: list[str] = []
LIMIT = {1440: 2600, 400: 5300}  # the Briefing's height: was 3,450 and 6,723 px; 15 findings take about 1,400 of it
# (400 px raised from 4,600 in phase 5: "Why it matters" now wraps to 3 lines on a phone, about 4,970 px)


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

        pg.goto(f"{BASE}/admin?days=7")
        settle(pg, 5000)
        main = pg.inner_text("main")
        height = pg.evaluate("document.documentElement.scrollHeight")
        check(height < LIMIT[width], f"{width} px Briefing: {height:,} px tall (under {LIMIT[width]:,})")
        check(pg.get_by_role("navigation", name="Signal types").count() == 0
              and pg.get_by_role("combobox", name="Kind of finding").count() == 1,
              f"{width} px Briefing: Kind of finding is a dropdown, not a rail")
        signs = pg.locator("section[aria-label='Signs that crossed']")
        if signs.count():
            check("threshold, the point at which the answer changes" in signs.inner_text(),
                  f"{width} px Briefing: says what a threshold is")
            closed = signs.locator("details:not([open])").count()
            check(closed >= 1 and closed <= 3, f"{width} px Briefing: signs as closed lines, the newest 3 ({closed})")
            signs.locator("summary").first.click()
            pg.wait_for_timeout(400)
            check("Threshold" in signs.inner_text() and "Means" in signs.inner_text(),
                  f"{width} px Briefing: an opened sign shows labelled lines")
        check(pg.locator("[data-row], section[aria-label='Findings'] > section > div").count() <= 40,
              f"{width} px Briefing: a page of findings, not all of them")
        if width == 400:
            peek = pg.locator("section[aria-label='To do'] ul").first
            check(not peek.is_visible(), "400 px Briefing: To do columns fold to one line each")
        check(fits(), f"{width} px Briefing: no sideways scroll")
        if shot:
            pg.screenshot(path=f"{OUT}/plan10-4-briefing.png", full_page=True)

        pg.goto(f"{BASE}/admin/technologies/{TECH}")
        settle(pg)
        if width == 1440:
            boxes = pg.evaluate("""() => {
              const aside = document.querySelector('aside[aria-label="What it is"]');
              const pov = [...document.querySelectorAll('h2')].find(h => h.textContent === 'Point of View');
              if (!aside || !pov) return null;
              const a = aside.getBoundingClientRect(), b = pov.closest('section').getBoundingClientRect();
              return {beside: a.left > b.right - 5, top: Math.abs(a.top - b.top) < 80}; }""")
            check(bool(boxes and boxes["beside"] and boxes["top"]), f"1440 px technology: facts beside the Point of View ({boxes})")
            pg.screenshot(path=f"{OUT}/plan10-4-overview.png")
        check(fits(), f"{width} px technology: no sideways scroll")

        pg.goto(f"{BASE}/admin/technologies/{TECH}?tab=fabrics")
        settle(pg)
        box = pg.locator("summary", has_text="Signs to watch")
        if box.count():
            box.first.click()
            pg.wait_for_timeout(500)
            body = pg.inner_text("main")
            check("Edit threshold" in body and "Threshold" in body, f"{width} px Fabrics tab: signs as labelled lines, with Edit threshold")
        else:
            check(False, f"{width} px Fabrics tab: a Signs to watch box")
        check(not errors, f"{width} px: no page errors {errors[:2]}")
        ctx.close()
    browser.close()

print("\nall passed" if not fails else f"\n{len(fails)} failed")
sys.exit(1 if fails else 0)
