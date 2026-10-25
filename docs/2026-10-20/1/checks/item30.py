"""Change 30 check: Rewrite on a Point of View's page, clicked as a person would,
waits for the model (about a minute, past the old 30-second cut-off), says
what it's doing, then shows the new version on the same page: its written
time, which version leaders see, and About this technology. Rewrites one
Point of View (about 1 model call).

    docker cp item30.py tech-radar-atlas-1:/tmp/ && docker exec tech-radar-atlas-1 python /tmp/item30.py [run tech]
"""

import os
import sys
import time

from playwright.sync_api import sync_playwright

from app.services.db.mongo import get_collection

BASE = "http://lens:3100"
OUT = "/tmp/shots-after"
os.makedirs(OUT, exist_ok=True)
fails: list[str] = []
run, tech = sys.argv[1:3] if len(sys.argv) > 2 else ("c1d0d08c9f43", "ai-infrastructure")


def check(ok: bool, what: str) -> None:
    print(("ok   " if ok else "FAIL ") + what)
    if not ok:
        fails.append(what)


before = get_collection("povs").find_one({"_id": f"{run}:{tech}"})
with sync_playwright() as p:
    browser = p.chromium.launch()
    ctx = browser.new_context(viewport={"width": 1440, "height": 1000}, timezone_id="America/Chicago")
    pg = ctx.new_page()
    pg.goto(f"{BASE}/admin/scoring/pov/{run}/{tech}")
    pg.wait_for_load_state("networkidle")
    pg.wait_for_timeout(1500)
    shown = pg.inner_text("main")
    pg.get_by_role("button", name="Rewrite · about 1 model call").click()
    pg.get_by_role("button", name="Rewrite", exact=True).click()
    pg.wait_for_timeout(500)
    check("Writing… about a minute" in pg.inner_text("main"), "while it writes, the button says so")
    start = time.time()
    pg.get_by_text("Rewritten: the page shows the new version").wait_for(timeout=300_000)
    took = time.time() - start
    after = get_collection("povs").find_one({"_id": f"{run}:{tech}"})
    main = pg.inner_text("main")
    check(after["version"] == before["version"] + 1, f"a new version was saved ({before['version']} → {after['version']}, {took:.0f} s)")
    check(main != shown and after["sections"]["headline"][:50] in main, "the page shows the new text without leaving it")
    check(after["sections"].get("background", "")[:50] in main, "About this technology is on the page")
    check("this one was written after it" in main or "Leaders see this version" in main, "which version leaders see is shown for the new one")
    check("Not done" not in main, "no error")
    pg.screenshot(path=f"{OUT}/item-30-rewritten.png", clip={"x": 0, "y": 0, "width": 1440, "height": 700})
    ctx.close()
    browser.close()

print(f"\n{'ALL CHECKS PASSED' if not fails else f'{len(fails)} FAILED'}")
