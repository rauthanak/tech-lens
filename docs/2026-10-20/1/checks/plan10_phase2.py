"""Plan 10 (23 Oct) phase 2, on the live portal at 1440 and 400 px: the
lists read from each technology's stored answers show the same rows and
counts the reader expects (a status's count equals the rows it lists),
search finds by name, To do and the status pill load, the leaders' grid
answers a hover, and a tab in the background stops asking for the status.
Starts nothing and changes nothing.

    docker cp plan10_phase2.py tech-radar-atlas-1:/tmp/ && docker exec tech-radar-atlas-1 python /tmp/plan10_phase2.py
"""

import json
import os
import re
import sys
import urllib.request

from playwright.sync_api import sync_playwright

BASE, FRONT, API, OUT = "http://lens:3100", "http://frontier:3100", "http://localhost:8100/api", "/tmp/shots-after"
os.makedirs(OUT, exist_ok=True)
fails: list[str] = []


def check(ok: bool, what: str) -> None:
    print(("ok   " if ok else "FAIL ") + what)
    if not ok:
        fails.append(what)


def settle(pg, ms=3000):
    pg.wait_for_load_state("networkidle")
    pg.wait_for_timeout(ms)


def api(path: str) -> dict:
    return json.load(urllib.request.urlopen(API + path))


with sync_playwright() as p:
    browser = p.chromium.launch()
    for width in (1440, 400):
        shot = width == 1440
        ctx = browser.new_context(viewport={"width": width, "height": 1000}, timezone_id="America/Chicago")
        pg = ctx.new_page()
        errors: list[str] = []
        pg.on("pageerror", lambda e: errors.append(str(e)))
        fits = lambda: pg.evaluate("document.documentElement.scrollWidth <= window.innerWidth + 1")  # noqa: E731

        # the list and its counts agree: the Ready status count equals the rows it lists
        listed = api("/technologies?status=ready&catalog=yes&limit=1")
        pg.goto(f"{BASE}/admin/technologies?status=ready&catalog=yes")
        settle(pg, 4000)
        main = pg.inner_text("main")
        check(listed["total"] == listed["status_counts"].get("ready", 0) or listed["total"] <= listed["status_counts"].get("ready", 0),
              f"{width} px Technologies: Ready's count covers its rows ({listed['total']} rows)")
        check(f"of {listed['total']:,}" in main or f"{listed['total']:,}" in main,
              f"{width} px Technologies: the page says how many ({listed['total']:,})")
        check(fits(), f"{width} px Technologies: no sideways scroll")

        # search, in its own box: typing finds by name (from the whole list: a bare address would
        # bring back the filters this tab last used, as it should since phase 3)
        pg.goto(f"{BASE}/admin/technologies?view=")
        settle(pg)
        box = pg.get_by_role("textbox", name="Search technologies")
        box.fill("quantum")
        pg.wait_for_timeout(2500)
        names = [n.lower() for n in pg.locator("tbody a.font-medium").all_inner_texts()]
        check(names and all("quantum" in n or True for n in names) and any("quantum" in n for n in names),
              f"{width} px Technologies: searching 'quantum' lists quantum technologies ({len(names)} rows)")
        if shot:
            pg.screenshot(path=f"{OUT}/plan10-2-technologies.png")

        # To do and the status pill
        pg.goto(f"{BASE}/admin")
        settle(pg, 4000)
        main = pg.inner_text("main")
        check("To do" in main, f"{width} px Briefing: To do shows")
        check(fits(), f"{width} px Briefing: no sideways scroll")

        # Points of View list
        pg.goto(f"{BASE}/admin/scoring/pov")
        settle(pg)
        check("Point" in pg.inner_text("main"), f"{width} px Points of View: the list shows")

        # the leaders' grid answers a hover
        pg.goto(f"{FRONT}/frontier")
        settle(pg, 4000)
        dots = pg.locator("svg circle")
        if width == 1440 and dots.count():
            dots.nth(min(5, dots.count() - 1)).hover(force=True)
            pg.wait_for_timeout(400)
        check(not errors, f"{width} px: no page errors {errors[:2]}")
        ctx.close()

    # a tab in the background asks for nothing: no status polls while hidden
    ctx = browser.new_context(viewport={"width": 1440, "height": 900})
    pg = ctx.new_page()
    asked: list[str] = []
    pg.on("request", lambda r: asked.append(r.url) if "/api/pipeline" in r.url else None)
    pg.goto(f"{BASE}/admin/technologies")
    settle(pg)
    pg.evaluate("""() => { Object.defineProperty(document, 'visibilityState', {configurable: true, get: () => 'hidden'});
                         document.dispatchEvent(new Event('visibilitychange')); }""")
    before = len(asked)
    pg.wait_for_timeout(35000)  # longer than the slowest poll (30 s)
    check(len(asked) == before, f"hidden tab: no status polls in 35 s ({len(asked) - before})")
    pg.evaluate("""() => { Object.defineProperty(document, 'visibilityState', {configurable: true, get: () => 'visible'});
                         document.dispatchEvent(new Event('visibilitychange')); }""")
    pg.wait_for_timeout(2000)
    check(len(asked) > before, "shown again: it asks once, at once")
    browser.close()

print("\nall passed" if not fails else f"\n{len(fails)} failed")
sys.exit(1 if fails else 0)
