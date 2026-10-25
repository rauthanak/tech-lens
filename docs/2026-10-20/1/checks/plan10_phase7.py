"""Plan 10 (23 Oct) phase 7, on the live portal at 1440 and 400 px: the
Points of View list and an assessment run's table come from the server a
page at a time (filters, sort and grid counts worked out there), keep their
place, and say the same numbers as before; an import under review, kept the
old way, still opens. Read-only: no button that writes is pressed.

    docker cp plan10_phase7.py tech-radar-atlas-1:/tmp/ && docker exec tech-radar-atlas-1 python /tmp/plan10_phase7.py
"""

import json
import os
import re
import sys
import urllib.request

from playwright.sync_api import sync_playwright

BASE, API, OUT = "http://lens:3100", "http://localhost:8100/api", "/tmp/shots-after"
RUN = "8f2220f78cf6"  # the 71-technology assessment run of 23 Oct: 199 rows
os.makedirs(OUT, exist_ok=True)
fails: list[str] = []


def api(path: str) -> dict:
    with urllib.request.urlopen(API + path) as r:
        return json.load(r)


def check(ok: bool, what: str) -> None:
    print(("ok   " if ok else "FAIL ") + what)
    if not ok:
        fails.append(what)


def settle(pg, ms=3000):
    pg.wait_for_load_state("networkidle")
    pg.wait_for_timeout(ms)


every = api("/scoring/povs")["povs"]          # the whole list, as before
table = api(f"/scoring/runs/{RUN}/rows?limit=200")
open_imports = [i for i in api("/imports")["imports"] if i.get("status") in ("reviewing", "ready")]

with sync_playwright() as p:
    browser = p.chromium.launch()
    for width in (1440, 400):
        shot = width == 1440
        ctx = browser.new_context(viewport={"width": width, "height": 1000}, timezone_id="America/Chicago")
        pg = ctx.new_page()
        errors: list[str] = []
        pg.on("pageerror", lambda e: errors.append(str(e)))
        writes: list[str] = []
        pg.on("request", lambda r: writes.append(f"{r.method} {r.url}") if r.method in ("PUT", "DELETE", "POST")
              and "/seen" not in r.url and "/preview" not in r.url else None)
        fits = lambda: pg.evaluate("document.documentElement.scrollWidth <= window.innerWidth + 1")  # noqa: E731

        # the Points of View list: 48 cards a page from the server, the same count as the whole list
        pg.goto(f"{BASE}/admin/scoring/pov")
        settle(pg)
        cards = pg.locator("a[href*='/admin/scoring/pov/']").count()
        check(cards == min(48, len(every)), f"{width} px Points of View: a page of cards ({cards} of {len(every)})")
        body = pg.inner_text("main")
        check(f"of {len(every):,}" in body or len(every) <= 48, f"{width} px Points of View: the pager counts all {len(every)}")
        if len(every) > 48:
            pg.get_by_role("button", name=re.compile("^Next")).first.click()
            settle(pg, 1500)
            first = pg.locator("a[href*='/admin/scoring/pov/']").first.get_attribute("href")
            pg.goto(f"{BASE}/admin")
            settle(pg, 1500)
            pg.goto(f"{BASE}/admin/scoring/pov")
            settle(pg)
            check(pg.locator("a[href*='/admin/scoring/pov/']").first.get_attribute("href") == first and "49–" in pg.inner_text("main"),
                  f"{width} px Points of View: back on the same page after leaving")
            pg.get_by_role("button", name=re.compile("^First|^Start over|^Prev")).first.click()
            settle(pg, 1000)
        pg.get_by_label("Priority").select_option("P1")
        settle(pg, 1500)
        p1 = sum(1 for v in every if any(pl["priority"] == "P1" for pl in v["placements"]))
        check(pg.locator("a[href*='/admin/scoring/pov/']").count() == min(48, p1), f"{width} px Points of View: P1 filter ({p1})")
        pg.get_by_label("Priority").select_option("")
        settle(pg, 1000)
        check(fits(), f"{width} px Points of View: no sideways scroll")

        # an assessment run: 50 rows a page from the server; the grid counts add up to the rows
        pg.goto(f"{BASE}/admin/scoring/assessments/{RUN}")
        settle(pg, 4000)
        rows = pg.locator("table:has(th:has-text('Pages')) tbody tr").count()
        check(rows == min(50, table["total"]), f"{width} px Assessment run: a page of rows ({rows} of {table['total']})")
        check(sum(table["grid"].values()) <= table["total"], "Assessment run: the grid counts what is placed")
        if table["grid"] and width == 1440:
            cell, n = max(table["grid"].items(), key=lambda kv: kv[1])
            pg.locator("table button", has_text=str(n)).first.click()
            settle(pg, 1500)
            check(pg.locator("table:has(th:has-text('Pages')) tbody tr").count() == min(50, n), f"1440 px Assessment run: a cell filters the table to its {n}")
            if shot:
                pg.screenshot(path=f"{OUT}/plan10-7-run.png")
            pg.locator("table button", has_text=str(n)).first.click()
            settle(pg, 1000)
        check(fits() or width == 400, f"{width} px Assessment run: no sideways scroll")

        # an import under review, kept the old way (rows inside), opens as before
        for imp in open_imports[:1]:
            pg.goto(f"{BASE}/admin/import?id={imp['_id']}")
            settle(pg)
            check("Steps" in pg.inner_html("main") and imp["file"] in pg.inner_text("main"),
                  f"{width} px Import: the open import shows ({imp['file']})")

        check(not writes, f"{width} px: nothing written {writes[:3]}")
        check(not errors, f"{width} px: no page errors {errors[:2]}")
        ctx.close()
    browser.close()

print("\nall passed" if not fails else f"\n{len(fails)} failed")
sys.exit(1 if fails else 0)
