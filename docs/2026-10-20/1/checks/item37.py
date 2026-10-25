"""Change 37 check, as a first-time reader on the live portal: one run from
collecting to publishing in six steps, with a Now line, on the run page, on
Operations (in place of the six cards, every button kept), a line on the
Briefing and a link in the status panel; an older run shows what happened
until the next collection, with no buttons. Clicks nothing that costs.

    docker cp item37.py tech-radar-atlas-1:/tmp/ && docker exec tech-radar-atlas-1 python /tmp/item37.py <latest id> <older id>
"""

import os
import sys

from playwright.sync_api import sync_playwright

BASE = "http://lens:3100"
OUT = "/tmp/shots-after"
os.makedirs(OUT, exist_ok=True)
LATEST, OLDER = sys.argv[1], sys.argv[2]
STEPS = ["Collect: read pages", "Organize: merge and link names", "Classify: judge evidence", "Assess",
         "Write Points of View", "Publish to leaders"]
fails: list[str] = []


def check(ok: bool, what: str) -> None:
    print(("ok   " if ok else "FAIL ") + what)
    if not ok:
        fails.append(what)


def settle(pg, ms=3500):
    pg.wait_for_load_state("networkidle")
    pg.wait_for_timeout(ms)


def steps_of(pg):
    return pg.locator("section[aria-label='Steps of this run'] li h3").all_inner_texts()


def fits(pg):
    return pg.evaluate("document.documentElement.scrollWidth <= window.innerWidth + 1")


with sync_playwright() as p:
    browser = p.chromium.launch()
    for width in (1440, 400):
        shot = width == 1440
        ctx = browser.new_context(viewport={"width": width, "height": 1000}, timezone_id="America/Chicago")
        pg = ctx.new_page()
        errors: list[str] = []
        pg.on("pageerror", lambda e: errors.append(str(e)))

        # the run page: six steps, a Now line, the current step marked
        pg.goto(f"{BASE}/admin/runs/{LATEST}")
        settle(pg)
        sec = pg.locator("section[aria-label='Steps of this run']")
        text = sec.inner_text()
        check(steps_of(pg) == STEPS, f"{width} px run page: the six steps in order")
        check("Now: step " in text and " of 6, " in text, f"{width} px run page: a Now line says which step it's on")
        check(sec.locator("li[aria-current='step']").count() == 1, f"{width} px run page: the current step is marked")
        check(pg.locator("h1").inner_text().startswith("Run of "), f"{width} px run page: titled as a run")
        check(fits(pg), f"{width} px run page: no sideways scroll")
        print("     " + text.split("\n")[0][:160])
        if shot:
            pg.screenshot(path=f"{OUT}/item-37-run.png", full_page=False)
            sec.screenshot(path=f"{OUT}/item-37-run-steps.png")

        # Operations: the latest run in place of the six cards, with every button
        pg.goto(f"{BASE}/admin/operations")
        settle(pg)
        ops = pg.locator("section[aria-labelledby='latest-run']")
        otext = ops.inner_text()
        check(steps_of(pg) == STEPS, f"{width} px Operations: the latest run's six steps")
        check("Open the run →" in otext and "Start a collection" in otext, f"{width} px Operations: open the run, start a collection")
        buttons = ops.locator("button").all_inner_texts()
        print("     buttons: " + " | ".join(b.strip() for b in buttons))
        check(any(b.startswith("Organize now") for b in buttons), f"{width} px Operations: Organize now kept")
        check(any(b.startswith(("Classify", "Assess them", "Resume", "Write them")) for b in buttons) or "Every step is done" in otext,
              f"{width} px Operations: what waits has its button")
        check(fits(pg), f"{width} px Operations: no sideways scroll")
        if shot:
            pg.screenshot(path=f"{OUT}/item-37-operations.png", full_page=False)

        # an older run: what happened until the next collection, no buttons
        pg.goto(f"{BASE}/admin/runs/{OLDER}")
        settle(pg)
        old = pg.locator("section[aria-label='Steps of this run']")
        check("A newer collection started" in old.inner_text(), f"{width} px older run: says a newer collection started")
        check(old.locator("button").count() == 0, f"{width} px older run: no buttons on its steps")
        if shot:
            old.screenshot(path=f"{OUT}/item-37-older-run.png")

        # the Briefing's line and the status panel's link
        pg.goto(f"{BASE}/admin")
        settle(pg)
        line = pg.get_by_text("Latest run, started")
        check(line.count() == 1, f"{width} px Briefing: one line on where the latest run stands")
        check(pg.get_by_role("link", name="See every step →").count() == 1, f"{width} px Briefing: it links to the steps")
        check(fits(pg), f"{width} px Briefing: no sideways scroll")
        if shot:
            pg.screenshot(path=f"{OUT}/item-37-briefing.png", full_page=False)
            pg.locator("header button[aria-expanded]").first.click()
            pg.wait_for_timeout(500)
            check(pg.get_by_role("link", name="The latest run, step by step →").count() == 1, "status panel: links to the latest run")
            pg.screenshot(path=f"{OUT}/item-37-status.png", clip={"x": 900, "y": 0, "width": 540, "height": 420})
        check(not errors, f"{width} px: no page errors {errors[:2]}")
        ctx.close()
    browser.close()

print("\nall passed" if not fails else f"\n{len(fails)} failed")
sys.exit(1 if fails else 0)
