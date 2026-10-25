"""Plan 10 (23 Oct) phase 5, on the live portal at 1440 and 400 px: words,
phones, feedback. Every question it opens is cancelled, so it changes
nothing: a signal switch says what it marks first; Changes cards offer Put
back the default; Domains merges ask, several at once; Save the edges says
what would move; problems say who acts; settings switches show their cost;
To do lines and Import steps look like what they are; the classification
counts sit on their own rows with the ones not judged yet.

    docker cp plan10_phase5.py tech-radar-atlas-1:/tmp/ && docker exec tech-radar-atlas-1 python /tmp/plan10_phase5.py
"""

import os
import sys

from playwright.sync_api import sync_playwright

BASE, OUT, TECH = "http://lens:3100", "/tmp/shots-after", "agentic-ai"
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
        writes: list[str] = []  # any write would be a failure: the walk only asks and cancels
        pg.on("request", lambda r: writes.append(f"{r.method} {r.url}") if r.method in ("PUT", "DELETE") or (
            r.method == "POST" and "/preview" not in r.url) else None)
        fits = lambda: pg.evaluate("document.documentElement.scrollWidth <= window.innerWidth + 1")  # noqa: E731

        # B5: the journey line has no connector starting a wrapped line on a phone; fabric chips wrap
        pg.goto(f"{BASE}/admin/technologies/{TECH}")
        settle(pg)
        bars = pg.locator("ol[aria-label='Where it is on the radar'] span.h-px:visible").count()
        check(bars == 0 if width == 400 else bars > 0, f"{width} px technology: step connectors {'hidden' if width == 400 else 'shown'} ({bars})")
        check(fits(), f"{width} px technology: no sideways scroll")
        pg.goto(f"{BASE}/admin/technologies/{TECH}?tab=fabrics")
        settle(pg)
        nav = pg.locator("nav[aria-label='Fabrics']")
        if nav.count():
            check(nav.evaluate("n => n.scrollWidth <= n.clientWidth + 1"), f"{width} px Fabrics tab: every fabric chip in view")

        # B4: Why it matters wraps to 3 lines
        pg.goto(f"{BASE}/admin?days=7")
        settle(pg)
        why = pg.locator("p:has-text('Why it matters')")
        if why.count():
            check("line-clamp-3" in (why.first.get_attribute("class") or ""), f"{width} px Briefing: Why it matters up to 3 lines")
        # D9: To do lines that go somewhere look like links
        if width == 1440:
            lines = pg.locator("section[aria-label='To do'] ul li a, section[aria-label='To do'] ul li button")
            plain = pg.locator("section[aria-label='To do'] ul li a:not(.text-link)").count()
            check(lines.count() > 0 and plain == 0, f"1440 px To do: {lines.count()} lines, each a link or an opener")

        # D1: a signal switch asks first, with the count
        pg.goto(f"{BASE}/admin/signals/list")
        settle(pg)
        switch = pg.get_by_role("switch").first
        before = switch.get_attribute("aria-checked")
        switch.click()
        pg.wait_for_timeout(400)
        q = pg.locator("[role=group][aria-label^='Switch ']")
        text = q.inner_text() if q.count() else ""
        check("stored page" in text and ("model call" in text or "already marked" in text),
              f"{width} px Signal list: the switch asks first ({text[:110]!r})")
        if shot and q.count():
            box = q.bounding_box()
            pg.screenshot(path=f"{OUT}/plan10-5-signal.png", clip={"x": 240, "y": box["y"] - 90, "width": 1180, "height": box["height"] + 110})
        q.get_by_role("button", name="Cancel").click()
        pg.wait_for_timeout(300)
        check(switch.get_attribute("aria-checked") == before, f"{width} px Signal list: Cancel leaves it as it was")

        # D2: Changes cards offer Put back the default
        pg.goto(f"{BASE}/admin/changes")
        settle(pg)
        cards = pg.locator("text=Put back the default").count()
        empty = "Every setup edit is kept as a default" in pg.inner_text("main")
        check(cards > 0 or empty, f"{width} px Changes: Put back the default on each card ({cards})")

        # D2, F4: Domains asks before merging, several at once
        pg.goto(f"{BASE}/admin/classification/domains")
        settle(pg)
        pg.get_by_label("Only the new ones").check()
        pg.wait_for_timeout(500)
        ticks = pg.locator("input[aria-label^='Select ']")
        if ticks.count() >= 2:
            ticks.nth(0).check()
            ticks.nth(1).check()
            bar = pg.get_by_role("region", name="Selected sub-domains")
            check("2 selected" in bar.inner_text(), f"{width} px Domains: two ticked, a bar to act on them")
            pick = bar.get_by_label("Merge the selected into")
            target = pick.locator("option").nth(1).get_attribute("value")
            pick.select_option(target)
            pg.wait_for_timeout(300)
            ask = bar.inner_text()
            check("Merge 2 sub-domains into" in ask and "Undo puts them back" in ask, f"{width} px Domains: merge asks first ({ask[:90]!r})")
            if shot:
                box = bar.bounding_box()
                pg.screenshot(path=f"{OUT}/plan10-5-domains.png", clip={"x": 240, "y": box["y"] - 60, "width": 1180, "height": 420})
            bar.get_by_role("button", name="Cancel").click()
        else:
            check(False, f"{width} px Domains: proposed sub-domains to tick ({ticks.count()})")

        # D7: Save the edges says what would move
        pg.goto(f"{BASE}/admin/scoring/config")
        settle(pg)
        upper = pg.get_by_label("How soon: upper edge")
        if upper.count():
            upper.fill("6")
            pg.get_by_role("button", name="Save the edges").click()
            pg.wait_for_timeout(1500)
            box = pg.locator("[role=group][aria-label='Save the edges?']")
            said = box.inner_text() if box.count() else ""
            check("With these edges" in said and "no model calls" in said, f"{width} px Weights & Grid: the edges say what moves ({said[:120]!r})")
            if shot:
                box.screenshot(path=f"{OUT}/plan10-5-edges.png")
            box.get_by_role("button", name="Cancel").click()

        # D5: problems say who acts; none sends to the collection as its fix
        pg.goto(f"{BASE}/admin/operations")
        settle(pg)
        probs = pg.locator("#problems")
        if probs.count():
            body = probs.inner_text()
            check("Open collection" not in body, f"{width} px Problems: no Open collection button")
            if "can't run" in body:
                check("Ask whoever runs the server" in body, f"{width} px Problems: a missing key says who acts")

        # D6: the switches show their cost
        pg.goto(f"{BASE}/admin/sources/settings")
        settle(pg)
        body = pg.inner_text("main")
        check("wait to be judged" in body, f"{width} px Settings: Judge after each collection shows its cost")
        pg.goto(f"{BASE}/admin/prompts/pov")
        settle(pg)
        body = pg.inner_text("main")
        check("In the last 30 days" in body or "Not called in the last 30 days" in body, f"{width} px Skill: reasoning shows its use")

        # D8: Points of View not in the edition carry a chip, and the count filters
        pg.goto(f"{BASE}/admin/scoring/pov")
        settle(pg)
        body = pg.inner_text("main")
        if "written after it" in body:
            check(pg.locator("text=/^Not in /").count() > 0, f"{width} px Points of View: Not in the edition chips")

        # D9: Import steps are a strip, not pills
        pg.goto(f"{BASE}/admin/import")
        settle(pg)
        pills = pg.locator("ol[aria-label='Steps'] li.rounded-full").count()
        check(pills == 0, f"{width} px Import: steps as a flat strip ({pills} pills)")

        # F3: counts on their own rows, with the ones not judged yet
        pg.goto(f"{BASE}/admin/classification/trl")
        settle(pg)
        body = pg.inner_text("main")
        check("No level yet" in body, f"{width} px TRL: No level yet counted")
        if shot:
            pg.screenshot(path=f"{OUT}/plan10-5-trl.png", clip={"x": 0, "y": 0, "width": 1440, "height": 400})
        check(fits(), f"{width} px TRL: no sideways scroll")

        check(not writes, f"{width} px: nothing written {writes[:3]}")
        check(not errors, f"{width} px: no page errors {errors[:2]}")
        ctx.close()
    browser.close()

print("\nall passed" if not fails else f"\n{len(fails)} failed")
sys.exit(1 if fails else 0)
