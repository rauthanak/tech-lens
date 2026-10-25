"""Change 29 check, as a first-time reader: a Point of View opens with what the
technology is, for someone who has never heard of it, between the four answers
and the recommendation, saying it's from general knowledge; one written before
the section existed shows no empty heading. Writes nothing.

    docker cp item29.py tech-radar-atlas-1:/tmp/ && docker exec tech-radar-atlas-1 python /tmp/item29.py
"""

import os

from playwright.sync_api import sync_playwright

from app.services.db.mongo import get_collection

BASE = "http://lens:3100"
OUT = "/tmp/shots-after"
os.makedirs(OUT, exist_ok=True)
fails: list[str] = []


def check(ok: bool, what: str) -> None:
    print(("ok   " if ok else "FAIL ") + what)
    if not ok:
        fails.append(what)


new = get_collection("povs").find_one({"sections.background": {"$nin": [None, ""]}}, sort=[("composed_at", -1)])
old = get_collection("povs").find_one({"sections.background": None, "sections.headline": {"$ne": None}})

with sync_playwright() as p:
    browser = p.chromium.launch()
    for width in (1440, 400):
        ctx = browser.new_context(viewport={"width": width, "height": 1000}, timezone_id="America/Chicago")
        pg = ctx.new_page()
        errors: list[str] = []
        pg.on("pageerror", lambda e: errors.append(str(e)))
        pg.goto(f"{BASE}/admin/scoring/pov/{new['scoring_run_id']}/{new['tech_id']}")
        pg.wait_for_load_state("networkidle")
        pg.wait_for_timeout(2000)
        main = pg.inner_text("main")
        at, rec, prio = main.find("ABOUT THIS TECHNOLOGY"), main.find("RECOMMENDATION"), main.find("PRIORITY")
        if at < 0:
            at, rec, prio = main.find("About this technology"), main.find("Recommendation"), main.find("Priority")
        check(0 <= prio < at < rec, f"{width} px: About this technology sits after the four answers, before the recommendation")
        check("From general knowledge, not the pages reviewed" in main, f"{width} px: it says where it comes from")
        check(new["sections"]["background"][:60] in main, f"{width} px: its text is shown")
        pg.get_by_text("How to read this page").first.click()
        check("for readers new to it" in pg.inner_text("main"), f"{width} px: the help explains it")
        wide = pg.evaluate("document.documentElement.scrollWidth - window.innerWidth")
        check(wide <= 1, f"{width} px: no sideways scroll (over by {wide})")
        if width == 1440:
            pg.get_by_text("How to read this page").first.click()
            pg.wait_for_timeout(300)
            pg.screenshot(path=f"{OUT}/item-29-about-this-technology.png", clip={"x": 0, "y": 0, "width": width, "height": 1000})
        if old:
            pg.goto(f"{BASE}/admin/scoring/pov/{old['scoring_run_id']}/{old['tech_id']}")
            pg.wait_for_load_state("networkidle")
            pg.wait_for_timeout(1500)
            check("bout this technology" not in pg.inner_text("main").replace("ABOUT", "About"),
                  f"{width} px: one written before it shows no empty heading")
        check(not errors, f"{width} px: no page errors {errors[:2]}")
        ctx.close()
    browser.close()

print(f"\n{'ALL CHECKS PASSED' if not fails else f'{len(fails)} FAILED'}")
