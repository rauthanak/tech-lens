"""Change 40 check, as a first-time reader on the live portal: a catalog
technology says the names it's looked for by (Edit names), an industry
application says so, pages naming it in passing are counted apart; the
run's Organize step says what linking found, with the catch-up button; the
Skills page lists the two new skills; a Point of View's introduction fills a
page in one column, its full width; Add evidence's file button is a button. Starts
nothing that costs.

    docker cp item40.py tech-radar-atlas-1:/tmp/ && docker exec tech-radar-atlas-1 python /tmp/item40.py <tech id> <application id> <pov path>
"""

import os
import sys

from playwright.sync_api import sync_playwright

BASE, OUT = "http://lens:3100", "/tmp/shots-after"
os.makedirs(OUT, exist_ok=True)
TECH, APP, POV = sys.argv[1], sys.argv[2], sys.argv[3]
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
        fits = lambda: pg.evaluate("document.documentElement.scrollWidth <= window.innerWidth + 1")

        pg.goto(f"{BASE}/admin/technologies/{TECH}")
        settle(pg)
        main = pg.inner_text("main")
        check("Looked for on pages as" in main, f"{width} px: the technology says the names it's looked for by")
        pg.get_by_role("button", name="Edit names").click()
        check(pg.locator("textarea").count() >= 1, f"{width} px: Edit names opens a box, one name per line")
        pg.get_by_role("button", name="Cancel").first.click()
        pg.get_by_role("button", name="Add evidence: links or files").click()
        check(pg.get_by_text("Choose files…").is_visible(), f"{width} px: the file picker reads as a button")
        check(fits(), f"{width} px technology: no sideways scroll")
        if shot:
            pg.screenshot(path=f"{OUT}/item-40-technology.png", full_page=False)

        pg.goto(f"{BASE}/admin/technologies/{APP}")
        settle(pg)
        check("Reads as an industry application rather than a technology" in pg.inner_text("main"),
              f"{width} px: an industry application says so")

        pg.goto(f"{BASE}/admin/operations")
        settle(pg)
        step = pg.locator("section[aria-label='Steps of this run'] li").nth(1)
        text = step.inner_text()
        check("Organize: merge and link names" in text, f"{width} px Operations: step 2 merges and links names")
        check("Link known names on all pages" in text or "Catch-up over every stored page" in text,
              f"{width} px Operations: the catch-up, or what it found")
        if shot:
            step.screenshot(path=f"{OUT}/item-40-organize-step.png")

        pg.goto(f"{BASE}/admin/prompts")
        settle(pg)
        body = pg.inner_text("main")
        check("Names to look for" in body and "Check a name on a page" in body, f"{width} px Skills: the two new skills")
        check(not errors, f"{width} px: no page errors {errors[:2]}")
        ctx.close()

    for width in (2000, 400):
        ctx = browser.new_context(viewport={"width": width, "height": 1300}, timezone_id="America/Chicago")
        pg = ctx.new_page()
        pg.goto(f"{BASE}{POV}")
        settle(pg)
        cols, share = pg.evaluate("""() => { const h = [...document.querySelectorAll('h2')].find(e => e.textContent === 'About this technology');
          const p = h && h.closest('section').querySelector(':scope > p');
          return p ? [getComputedStyle(p).columnCount, p.getBoundingClientRect().width / document.querySelector('main').getBoundingClientRect().width] : [null, 0] }""")
        check(cols == "auto" and share > 0.85,
              f"{width} px Point of View: the introduction is one column across the page ({cols}, {share:.0%} of its width)")
        ctx.close()
    browser.close()

print("\nall passed" if not fails else f"\n{len(fails)} failed")
sys.exit(1 if fails else 0)
