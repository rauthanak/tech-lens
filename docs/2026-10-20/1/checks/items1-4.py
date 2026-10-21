"""Items 1–4 check, as a first-time admin on the live portal: switch technologies
off from the list, written times in the writer's zone, where each skill is
used, and model use on Operations and the run pages.

    docker cp items1-4.py tech-radar-atlas-1:/tmp/ && docker exec tech-radar-atlas-1 python /tmp/items1-4.py
"""

import atexit
import json
import os
import re
import urllib.request

from playwright.sync_api import sync_playwright

BASE = "http://lens:3100"
OUT = "/tmp/shots-after"
API = "http://localhost:8100/api"
os.makedirs(OUT, exist_ok=True)
fails: list[str] = []


def check(ok: bool, what: str) -> None:
    print(("ok   " if ok else "FAIL ") + what)
    if not ok:
        fails.append(what)


def settle(pg, ms: int = 1500) -> None:
    pg.wait_for_load_state("networkidle")
    pg.wait_for_timeout(ms)


def no_sideways(pg, where: str) -> None:
    wide = pg.evaluate("document.documentElement.scrollWidth - window.innerWidth")
    check(wide <= 1, f"{where}: no sideways scroll at {pg.viewport_size['width']} px (over by {wide})")


def api(path, body=None, method=None):
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(API + path, data=data, method=method or ("POST" if data else "GET"),
                                 headers={"Content-Type": "application/json"})
    return json.loads(urllib.request.urlopen(req).read())


off_before = {t["_id"] for t in api("/technologies?view=off&limit=500")["technologies"]}


@atexit.register
def put_back() -> None:
    """Whatever the walk switched off goes back on, even if it stopped halfway."""
    back = [t["_id"] for t in api("/technologies?view=off&limit=500")["technologies"] if t["_id"] not in off_before]
    if back:
        api("/technologies/bulk", {"ids": back, "action": "switch_on"})
        print("switched back on:", back)


with sync_playwright() as p:
    browser = p.chromium.launch()
    for width in (1440, 1920, 400):
        ctx = browser.new_context(viewport={"width": width, "height": 1000}, timezone_id="America/Chicago")
        pg = ctx.new_page()
        errors: list[str] = []
        pg.on("pageerror", lambda e: errors.append(str(e)))
        shot = width == 1440
        print(f"\n── {width} px")

        # item 1: tick two rows, switch them off, see when, switch them back on
        pg.goto(BASE + "/admin/technologies?view=not_assessed")
        settle(pg)
        boxes = pg.locator("tbody input[type=checkbox]")
        names = [pg.locator("tbody tr").nth(i).locator("td").nth(1).inner_text().strip().split("\n")[0] for i in range(2)]
        boxes.nth(0).check()
        boxes.nth(1).check()
        bar = pg.get_by_role("region", name="Selected technologies")
        check(bar.is_visible() and "2 technologies selected" in bar.inner_text(), "List: ticking rows shows the bulk bar")
        if shot:
            pg.screenshot(path=f"{OUT}/item-1-bulk-bar.png")
        bar.get_by_role("button", name="Switch off").click()
        settle(pg)
        check("2 technologies switched off" in pg.inner_text("body"), "List: bulk switch-off says what it did")
        pg.goto(BASE + "/admin/technologies?view=off")
        settle(pg)
        body = pg.inner_text("body")
        check(all(n in body for n in names), f"List: the two are under Switched off ({names})")
        check(bool(re.search(r"on \w{3} \d{1,2}, \d{4}, \d{1,2}:\d{2} [AP]M C[DS]T", body)),
              "List: a switched-off row says when, with its zone")
        if shot:
            pg.screenshot(path=f"{OUT}/item-1-switched-off.png")
        switches = pg.get_by_role("switch")
        for _ in range(2):  # put them back
            name_cell = pg.locator("td:nth-child(2)", has_text=re.compile("^" + re.escape(names[_]) + r"(\s|$)"))
            row = pg.locator("tbody tr").filter(has=name_cell)
            row.get_by_role("switch").click()
            settle(pg, 800)
        pg.goto(BASE + "/admin/technologies?view=off")
        settle(pg)
        check(not any(n in pg.inner_text("body") for n in names), "List: a row's switch turns it back on")
        no_sideways(pg, "Technologies")

        # item 2: written times in the writer's zone
        pg.goto(BASE + "/admin/scoring/pov/6d0c41a2d13d/5g")
        settle(pg)
        check("GMT+5:30" in pg.inner_text("body"), "Point of View: written from India shows India's time")
        if shot:
            pg.screenshot(path=f"{OUT}/item-2-written-time.png")
        pg.goto(BASE + "/admin/scoring/pov/6d0c41a2d13d/agentic-ai")
        settle(pg)
        check(bool(re.search(r"Written \w{3} \d{1,2}, \d{4}, \d{1,2}:\d{2} [AP]M CDT", pg.inner_text("body"))),
              "Point of View: an older one shows US Central")

        # item 3: where each skill is used
        pg.goto(BASE + "/admin/prompts")
        settle(pg)
        pg.get_by_role("link", name="Where each skill is used →").click()
        settle(pg)
        check(pg.locator("h1").first.inner_text() == "Where each skill is used", "Skill map: reached from Skills")
        cards = pg.locator("ol > li a[href^='/admin/prompts/']")
        titles = [c.inner_text().split("\n")[0].strip() for c in cards.all()]
        # a skill shows in its step, and again inside each stacked call that carries it (item 5)
        check(len(set(titles)) >= 12, f"Skill map: every skill shown ({len(set(titles))} skills, {len(titles)} places)")
        check(pg.locator("ol > li h2").all_inner_texts() == ["Collect", "Organize", "Classify", "Assess", "Point of View"],
              "Skill map: the five steps in order")
        check("Read a page" in pg.inner_text("body"), "Skill map: skills by plain name")
        no_sideways(pg, "Skill map")
        if shot:
            pg.screenshot(path=f"{OUT}/item-3-skill-map.png", full_page=True)

        # item 4: model use
        pg.goto(BASE + "/admin/operations")
        settle(pg)
        check(bool(re.search(r"\d[\d.]*[kM]? tokens", pg.inner_text("body"))), "Operations: history rows show tokens")
        if shot:
            pg.screenshot(path=f"{OUT}/item-4-operations.png", full_page=True)
        newest = pg.request.get("http://localhost:8100/api/runs").json()["runs"][0]["id"]
        pg.goto(BASE + f"/admin/runs/{newest}")
        settle(pg, 3000)
        check(bool(re.search(r"[\d,]+ model calls", pg.inner_text("body"))), "Collection page: model use for the run")
        check(pg.locator("h1").first.inner_text().startswith("Collection · "), "Collection page: titled by date, not id")
        if shot:
            pg.screenshot(path=f"{OUT}/item-4-collection.png")
        pg.goto(BASE + "/admin/prompts/measure_scoring")
        settle(pg)
        check(pg.get_by_text("Let the model reason before it answers").count() == 1, "Skill page: the reasoning switch")

        check(not errors, f"no page errors at {width} px {errors[:2]}")
        ctx.close()
    browser.close()

print(f"\n{'ALL CHECKS PASSED' if not fails else f'{len(fails)} FAILED'}")
