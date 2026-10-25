"""Change 39 check, as a first-time reader on the live portal: the
Technologies list's Status filter (held = "Assessed, not placed") and its
counts that read as links; Add evidence on a technology page (links and
files, what happens next, the cost before it starts, a refusal that says
why). Starts nothing that costs.

    docker cp item39.py tech-radar-atlas-1:/tmp/ && docker exec tech-radar-atlas-1 python /tmp/item39.py <technology id>
"""

import os
import sys

from playwright.sync_api import sync_playwright

BASE = "http://lens:3100"
OUT = "/tmp/shots-after"
os.makedirs(OUT, exist_ok=True)
TECH = sys.argv[1]
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

        # the Status filter, beside the others
        pg.goto(f"{BASE}/admin/technologies")
        settle(pg, 5000)
        status = pg.get_by_label("Status", exact=True)
        options = status.locator("option").all_inner_texts()
        check(any(o.startswith("Assessed, not placed") for o in options), f"{width} px: Status filter offers Assessed, not placed ({options[:3]})")
        held = next(o for o in options if o.startswith("Assessed, not placed"))
        status.select_option(label=held)
        settle(pg, 4000)
        check("status=held" in pg.url and pg.locator("tbody tr").count() > 0, f"{width} px: choosing it lists them")
        count = int(held.split("·")[-1].strip().replace(",", ""))
        check(f"{count} technologies" in pg.inner_text("main").replace(",", ""), f"{width} px: the list says how many ({count})")
        check(fits(), f"{width} px Technologies: no sideways scroll")
        if shot:
            pg.screenshot(path=f"{OUT}/item-39-held.png", full_page=False)

        # Add evidence on a technology page
        pg.goto(f"{BASE}/admin/technologies/{TECH}")
        settle(pg)
        pg.get_by_role("button", name="Add evidence: links or files").click()
        form = pg.locator("form[aria-label='Add evidence']")
        check(form.count() == 1, f"{width} px: Add evidence opens a form")
        start = form.get_by_role("button", name="Start")
        check(start.is_disabled(), f"{width} px: Start waits for a link or a file")
        form.locator("textarea").fill("https://example.org/a\nhttps://example.org/b")
        text = form.inner_text()
        check("about " in start.inner_text() and "model calls" in start.inner_text(), f"{width} px: the cost shows on Start ({start.inner_text()})")
        check("2 pages to read" in text and "to assess" in text, f"{width} px: the cost is broken down")
        check("Judge its evidence, assess it and write its Point of View" in text, f"{width} px: it says what happens next")
        form.locator("textarea").fill("example.org/a")
        start.click()
        pg.wait_for_timeout(1500)
        check("starting with http" in form.inner_text(), f"{width} px: a bad link is refused, saying why")
        check(fits(), f"{width} px technology page: no sideways scroll")
        if shot:
            form.locator("textarea").fill("https://www.oiforum.com/technical-work/hot-topics/flex-ethernet/")
            pg.wait_for_timeout(300)
            form.screenshot(path=f"{OUT}/item-39-add-evidence.png")
        check(not errors, f"{width} px: no page errors {errors[:2]}")
        ctx.close()
    browser.close()

print("\nall passed" if not fails else f"\n{len(fails)} failed")
sys.exit(1 if fails else 0)
