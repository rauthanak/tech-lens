"""Changes 25–27 check, as a first-time admin on the live portal: Operations
(numbered steps saying who moves each on, tabs, grouped history, health only
when it matters, Redo scores that asks), Setup's structure (menu groups,
Import under Technologies, visible Edit, Delete behind Edit, developer details
behind Technical details, Changes in plain words) and its pages (Mark
settled, one plain overview line, one Path list, On/Off, unsaved edits, the
time-zone line, Tata not TCL). Writes nothing.

    docker cp items25-27.py tech-radar-atlas-1:/tmp/ && docker exec tech-radar-atlas-1 python /tmp/items25-27.py
"""

import json
import os
import re
import urllib.request

from playwright.sync_api import sync_playwright

BASE = "http://lens:3100"
API = "http://localhost:8100/api"
OUT = "/tmp/shots-after"
os.makedirs(OUT, exist_ok=True)
fails: list[str] = []
HOOD = "tech-lens:under-the-hood"


def check(ok: bool, what: str) -> None:
    print(("ok   " if ok else "FAIL ") + what)
    if not ok:
        fails.append(what)


def settle(pg, ms: int = 1800) -> None:
    pg.wait_for_load_state("networkidle")
    pg.wait_for_timeout(ms)


def no_sideways(pg, where: str) -> None:
    wide = pg.evaluate("document.documentElement.scrollWidth - window.innerWidth")
    check(wide <= 1, f"{where}: no sideways scroll at {pg.viewport_size['width']} px (over by {wide})")


def api(path):
    return json.loads(urllib.request.urlopen(API + path).read())


def hood(pg, on: bool) -> None:
    pg.evaluate(f"localStorage.{'setItem' if on else 'removeItem'}('{HOOD}'{', \"on\"' if on else ''})")
    pg.reload()
    settle(pg)


run_id = api("/scoring/runs")["scoring_runs"][0]["_id"]
source_id = api("/sources")["sources"][0]["_id"]

with sync_playwright() as p:
    browser = p.chromium.launch()
    for width in (1440, 400):
        shot = width == 1440
        ctx = browser.new_context(viewport={"width": width, "height": 900}, timezone_id="America/Chicago")
        pg = ctx.new_page()
        errors: list[str] = []
        pg.on("pageerror", lambda e: errors.append(str(e)))
        pg.goto(f"{BASE}/admin")
        pg.evaluate(f"localStorage.removeItem('{HOOD}')")

        # change 25: Operations
        pg.goto(f"{BASE}/admin/operations")
        settle(pg, 3000)
        main = pg.inner_text("main")
        # change 37 made the six cards the latest run's six steps (item37.py checks them in full)
        steps = pg.locator("section[aria-label='Steps of this run'] li h3").all_inner_texts()
        check(len(steps) == 6 and steps[0].startswith("Collect"), f"Operations: the six steps in order ({steps})")
        check(all(w in main for w in ("You start it", "Runs by itself")),
              "Operations: each step says who moves it on")
        check(pg.get_by_role("link", name="Collections", exact=True).count() >= 1
              and pg.get_by_role("link", name="Assessment runs", exact=True).count() >= 1, "Operations: tabs to its two lists")
        check("Service health" not in main and "port 8100" not in main, "Operations: service health hidden while it's healthy")
        check(pg.get_by_role("button", name="Cost by skill").count() > 0 and pg.get_by_role("button", name="By skill", exact=True).count() == 0,
              "Operations: 'Cost by skill', not 'By skill'")
        rows = pg.locator("main section:has(h2:text('History')) li").all_inner_texts()
        grouped = [r for r in rows if re.search(r"\d+ written", r)]
        check(bool(grouped) and "–" in grouped[0], f"Operations: single Points of View grouped into one row ({grouped[:1]})")
        if shot:
            pg.screenshot(path=f"{OUT}/item-25-operations.png", clip={"x": 0, "y": 0, "width": width, "height": 760})
        no_sideways(pg, "Operations")
        hood(pg, True)
        check("Service health" in pg.inner_text("main"), "Operations: Technical details shows service health")
        pg.evaluate(f"localStorage.removeItem('{HOOD}')")

        for path, title in (("/admin/runs", "Collections"), ("/admin/scoring/assessments", "Assessment runs")):
            pg.goto(f"{BASE}{path}")
            settle(pg)
            tabs = pg.locator("main a[href='/admin/operations']")
            check(tabs.count() >= 1 and "Overview" in tabs.first.inner_text(), f"{title}: a tab back to Operations")
            no_sideways(pg, title)
        pg.goto(f"{BASE}/admin/scoring/assessments/{run_id}")
        settle(pg, 2500)
        redo = pg.get_by_role("button", name=re.compile("^Redo scores"))
        if redo.count():
            redo.first.click()
            pg.wait_for_timeout(300)
            check("leaders see that only after the next publish" in pg.inner_text("main"),
                  "Assessment run: Redo scores asks first and says what it changes")
            pg.get_by_role("button", name="Cancel").first.click()

        # change 26: Setup's structure
        pg.goto(f"{BASE}/admin/sources")
        settle(pg)
        nav = pg.locator("main nav").first.inner_text()
        if width >= 1024:
            check(all(g in nav for g in ("What the radar reads", "How it judges", "Tata's frame", "System")),
                  "Setup: the menu in four groups")
        check("Import" not in nav and "Finance" not in nav, "Setup: Import and Finance aren't in the menu")
        if shot:
            pg.locator("main nav").first.screenshot(path=f"{OUT}/item-26-setup-menu.png")
        cells = pg.locator("main table tbody tr td:last-child").all_inner_texts()
        check(bool(cells) and all(c.strip() in ("On", "Off", "not collectable") for c in cells),
              "Sources: on or off said in words")
        pg.goto(f"{BASE}/admin/sources/{source_id}")
        settle(pg)
        check(bool(re.search(r"Switched (on|off):", pg.inner_text("main"))), "A source: on or off at the top of its page")

        pg.goto(f"{BASE}/admin/technologies")
        settle(pg, 2500)
        imp = pg.get_by_role("link", name=re.compile("Import a catalog file"))
        check(imp.count() >= 1, "Technologies: Import a catalog file")
        pg.goto(f"{BASE}/admin/import")
        settle(pg)
        check("Technologies" in pg.inner_text("main a:has-text('←')") if pg.locator("main a:has-text('←')").count() else False,
              "Import: a way back to Technologies")
        no_sideways(pg, "Import")

        pg.goto(f"{BASE}/admin/mechanisms")
        settle(pg)
        edits = pg.locator("main button:has-text('Edit')").count()
        check(edits >= 4, f"Mechanisms: each row shows Edit ({edits})")
        pg.goto(f"{BASE}/admin/scoring/fabrics")
        settle(pg)
        check(pg.locator("main button:has-text('Edit')").count() >= 6, "Fabrics: each card shows Edit")

        pg.goto(f"{BASE}/admin/signals/list")
        settle(pg)
        check(pg.get_by_role("button", name="Delete").count() == 0, "Signal list: no Delete on the rows")
        pg.get_by_role("button", name="Edit").first.click()
        pg.wait_for_timeout(500)
        check(pg.get_by_role("button", name="Delete").count() == 1, "Signal list: Delete sits in the Edit form")
        if shot:
            pg.locator("form").filter(has_text="Edit signal").screenshot(path=f"{OUT}/item-26-signal-form.png")
        pg.get_by_role("button", name="Cancel").first.click()

        pg.goto(f"{BASE}/admin/sources/settings")
        settle(pg)
        main = pg.inner_text("main")
        check("Page part size" not in main and "Most tokens one judging run" not in main,
              "Settings: crawler internals behind Technical details")
        check("in the zone of the person who did the thing" in main and "browser" not in main,
              "Settings: the time-zone line follows the rule")
        pg.get_by_label("First-run lookback (days)").fill("31")
        check("Edits here aren't saved yet" in pg.inner_text("main"), "Settings: unsaved edits are flagged")
        if shot:
            pg.screenshot(path=f"{OUT}/item-27-settings.png", clip={"x": 0, "y": 0, "width": width, "height": 900})
        pg.reload()
        settle(pg)
        hood(pg, True)
        check("Page part size" in pg.inner_text("main"), "Settings: Technical details shows them")
        pg.evaluate(f"localStorage.removeItem('{HOOD}')")

        pg.goto(f"{BASE}/admin/changes")
        settle(pg)
        main = pg.inner_text("main")
        check("starting files" not in main and "kept as the defaults" in main, "Changes: in plain words")
        check("new → seeded" not in main.replace("\n", " "), "Changes: a sub-domain's status in words")

        # change 27: the pages
        pg.goto(f"{BASE}/admin/scoring/pending")
        settle(pg)
        settled = pg.get_by_role("button", name="Mark settled").count()
        check(settled == len(api("/scoring/overview")["pending"]), f"Open questions: Mark settled on each ({settled})")
        if shot:
            pg.screenshot(path=f"{OUT}/item-27-open-questions.png", clip={"x": 0, "y": 0, "width": width, "height": 700})
        pg.goto(f"{BASE}/admin/scoring")
        settle(pg)
        check("setup decisions wait on Tata" in pg.inner_text("main"), "Scoring method: one plain line, not number tiles")
        pg.goto(f"{BASE}/admin/path")
        settle(pg)
        check("What the radar checks before it flags a step" not in pg.inner_text("main"), "Path to scale: one list")
        for path in ("/admin/scoring/fabrics", "/admin/scoring/measures", "/admin/scoring/pending", "/admin/sources"):
            pg.goto(f"{BASE}{path}")
            settle(pg)
            check(not re.search(r"\bTCL\b", pg.inner_text("main")), f"{path}: Tata, never TCL")
            no_sideways(pg, path)

        pg.goto(f"{BASE}/admin")
        settle(pg, 2500)
        if api("/gates")["gate1"] and any(i["kind"] == "subdomains" for i in api("/gates")["gate1"]):
            todo = pg.get_by_role("region", name="To do").inner_text()
            check("sub-domains the model proposed" in todo or "and " in todo, "Briefing: proposed sub-domains wait in To do")

        check(not errors, f"no page errors at {width} px {errors[:2]}")
        ctx.close()
    browser.close()

print(f"\n{'ALL CHECKS PASSED' if not fails else f'{len(fails)} FAILED'}")
