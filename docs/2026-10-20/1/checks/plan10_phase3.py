"""Plan 10 (23 Oct) phase 3, on the live portal at 1440 and 400 px: long
lists come in pages of 50 ("51–100 of …") with Next and Prev, and coming
back by the top menu (a bare address) shows the same rows; filters are one
kind (group buttons, labelled dropdowns, removable chips with Clear all);
search is in the address; History is its own Operations tab, in pages; no
"Show more" is left. Starts nothing and changes nothing.

    docker cp plan10_phase3.py tech-radar-atlas-1:/tmp/ && docker exec tech-radar-atlas-1 python /tmp/plan10_phase3.py
"""

import os
import re
import sys

from playwright.sync_api import sync_playwright

BASE, OUT = "http://lens:3100", "/tmp/shots-after"
os.makedirs(OUT, exist_ok=True)
fails: list[str] = []


def check(ok: bool, what: str) -> None:
    print(("ok   " if ok else "FAIL ") + what)
    if not ok:
        fails.append(what)


def settle(pg, ms=3000):
    pg.wait_for_load_state("networkidle")
    pg.wait_for_timeout(ms)


def first_row(pg) -> str:
    return pg.locator("tbody a.font-medium").first.inner_text()


with sync_playwright() as p:
    browser = p.chromium.launch()
    for width in (1440, 400):
        shot = width == 1440
        ctx = browser.new_context(viewport={"width": width, "height": 1000}, timezone_id="America/Chicago")
        pg = ctx.new_page()
        errors: list[str] = []
        pg.on("pageerror", lambda e: errors.append(str(e)))
        fits = lambda: pg.evaluate("document.documentElement.scrollWidth <= window.innerWidth + 1")  # noqa: E731

        # Technologies: pages of 50, Next, and back to the same rows from the top menu
        pg.goto(f"{BASE}/admin/technologies")
        settle(pg, 4000)
        main = pg.inner_text("main")
        check(bool(re.search(r"1–50 of [\d,]+", main)), f"{width} px Technologies: '1–50 of …'")
        check(pg.locator("tbody[data-row]").count() == 50, f"{width} px Technologies: 50 rows on the page")
        pg.get_by_role("button", name="Next ›").first.click()
        settle(pg)
        second = first_row(pg)
        check("at=51" in pg.url and bool(re.search(r"51–100 of", pg.inner_text("main"))),
              f"{width} px Technologies: Next shows 51–100 and keeps it in the address")
        pg.goto(f"{BASE}/admin/operations")
        settle(pg)
        pg.goto(f"{BASE}/admin/technologies")  # as the top menu does: a bare address
        settle(pg, 4000)
        check("at=51" in pg.url and first_row(pg) == second,
              f"{width} px Technologies: back from another page, the same rows (51–100)")
        check(fits(), f"{width} px Technologies: no sideways scroll")

        # one kind of filter: labelled dropdowns, removable chips, Clear all; search in the address
        check(pg.get_by_role("combobox", name="Status").count() == 1
              and pg.get_by_role("combobox", name="Commercial availability").count() == 1,
              f"{width} px Technologies: Status and Commercial availability are dropdowns")
        check("In this view:" not in pg.inner_text("main"), f"{width} px Technologies: no status links")
        pg.get_by_role("combobox", name="Status").select_option(index=1)
        settle(pg)
        check("at=" not in pg.url and pg.get_by_role("button", name=re.compile("^Remove ")).count() >= 1,
              f"{width} px Technologies: a filter starts at the first rows and shows as a removable chip")
        if shot:
            pg.screenshot(path=f"{OUT}/plan10-3-filters.png")
        pg.get_by_role("button", name="Clear all").click()
        settle(pg)
        check("status=" not in pg.url, f"{width} px Technologies: Clear all clears it")
        pg.get_by_role("textbox", name="Search technologies").fill("quantum")
        pg.wait_for_timeout(2500)
        check("q=quantum" in pg.url, f"{width} px Technologies: the search is in the address")
        pg.get_by_role("button", name="Clear all").click()
        settle(pg)

        # History: its own tab, in pages
        pg.goto(f"{BASE}/admin/operations")
        settle(pg)
        check(pg.get_by_role("link", name="History", exact=True).count() >= 1, f"{width} px Operations: a History tab")
        check("Cost by skill" not in pg.inner_text("main"), f"{width} px Operations overview: History isn't on it")
        pg.goto(f"{BASE}/admin/operations/history")
        settle(pg)
        main = pg.inner_text("main")
        check("History" in main and ("Cost by skill" in main or "Nothing has run yet" in main),
              f"{width} px History: its runs, with Cost by skill")
        check(fits(), f"{width} px History: no sideways scroll")
        if shot:
            pg.screenshot(path=f"{OUT}/plan10-3-history.png")

        # no "Show more" left on the long lists
        for path in ("/admin", "/admin/scoring/pov", "/admin/technologies/agentic-ai", "/admin/signals/list"):
            pg.goto(f"{BASE}{path}")
            settle(pg)
            text = pg.inner_text("main")
            check(not re.search(r"Show \d* ?more|Load more", text), f"{width} px {path}: no Show more")
        check(not errors, f"{width} px: no page errors {errors[:2]}")
        ctx.close()
    browser.close()

print("\nall passed" if not fails else f"\n{len(fails)} failed")
sys.exit(1 if fails else 0)
