"""Changes 31–34 check, as a first-time reader on the live portal: the
collection page (problems first in words, its steps saying where they
stand (six since change 37), times in a zone, sources by state, a stop that asks), the market-size
card, crossed metrics on the Briefing, and the leaders' address counting
opens and prints. Writes nothing: the leaders' count is caught before it
reaches the radar.

    docker cp items31-34.py tech-radar-atlas-1:/tmp/ && docker exec tech-radar-atlas-1 python /tmp/items31-34.py <collection id>
"""

import json
import os
import re
import sys
import urllib.request

from playwright.sync_api import sync_playwright

BASE, FRONT, API = "http://lens:3100", "http://frontier:3100", "http://localhost:8100/api"
OUT = "/tmp/shots-after"
os.makedirs(OUT, exist_ok=True)
fails: list[str] = []
RUN = sys.argv[1]


def check(ok: bool, what: str) -> None:
    print(("ok   " if ok else "FAIL ") + what)
    if not ok:
        fails.append(what)


def api(path):
    return json.loads(urllib.request.urlopen(API + path).read())


def settle(pg, ms=2500):
    pg.wait_for_load_state("networkidle")
    pg.wait_for_timeout(ms)


run = api(f"/runs/{RUN}")
pov = api("/scoring/povs")["povs"][0]
with sync_playwright() as p:
    browser = p.chromium.launch()
    for width in (1440, 400):
        shot = width == 1440
        ctx = browser.new_context(viewport={"width": width, "height": 1000}, timezone_id="America/Chicago")
        pg = ctx.new_page()
        errors: list[str] = []
        pg.on("pageerror", lambda e: errors.append(str(e)))

        # change 31: the collection page
        pg.goto(f"{BASE}/admin/runs/{RUN}")
        settle(pg, 3500)
        main = pg.inner_text("main")
        failed = [s for s in run["sources"] if s.get("error")]
        probs = pg.locator("section[aria-label='Problems']")
        check(probs.count() == 1 and all(s["source_name"] in probs.inner_text() for s in failed),
              f"{width} px: problems first, naming each source that couldn't finish ({len(failed)})")
        check("OpenAlex refused its searches: it now needs its free key" in main, f"{width} px: a failure says why in words")
        check("401 Unauthorized" not in main, f"{width} px: the raw error only under Technical details")
        # change 37 made the four steps six, from collecting to publishing (item37.py checks them)
        steps = pg.locator("section[aria-label='Steps of this run'] li h3").all_inner_texts()
        check(steps[:3] == ["Collect: read pages", "Organize: merge and link names", "Classify: judge evidence"],
              f"{width} px: the collection's steps, each saying where it stands ({steps})")
        if run.get("classify"):
            c = run["classify"]
            # plan 10 phase 1: a Classify finished in two parts says so, and the removed limit by name
            check(f"{c['done']:,} during this collection" in main and "spending limit that was removed" in main,
                  f"{width} px: judging evidence says how far it got and why it stopped")
        check("took " in main and "ended " in main and not re.search(r"\bUTC\b", main), f"{width} px: times not in UTC")
        check("Stopped at its page budget" not in main and "page budget" not in main.split("Sources")[0],
              f"{width} px: the page budget said once, not per row")
        check(bool(re.search(r"model calls? \(\d+ failed: ", main)) or "failed)" not in main,
              f"{width} px: failed model calls say why")
        check(pg.get_by_role("button", name=re.compile("Stop the collection")).count() == 0,
              f"{width} px: no stop button on a finished collection")
        rows = pg.locator("main table tbody tr").count()
        check(rows < len(run["sources"]), f"{width} px: the done sources folded while problems need attention ({rows} rows)")
        if shot:
            pg.screenshot(path=f"{OUT}/item-31-collection.png", clip={"x": 0, "y": 0, "width": width, "height": 1000})
        wide = pg.evaluate("document.documentElement.scrollWidth - window.innerWidth")
        check(wide <= 1, f"{width} px: no sideways scroll on the collection page (over by {wide})")

        # change 32: market size on a Point of View
        pg.goto(f"{BASE}/admin/scoring/pov/{pov['scoring_run_id']}/{pov['tech_id']}")
        settle(pg)
        main = pg.inner_text("main")
        check(re.search(r"market size", main, re.I) is not None and
              any(w in main for w in ("Not assessed yet", "No figure found", "under $1B", "$1–5B", "$5–20B", "$20–100B", "over $100B")),
              f"{width} px: the Point of View has a market-size card")
        pg.get_by_text("How to read this page").first.click()
        check("under $1B, $1–5B, $5–20B, $20–100B, over $100B" in pg.inner_text("main"), f"{width} px: the help names the bands")
        check("Leaders opened it" in main or "Leaders haven't opened it yet" in main, f"{width} px: the page says how often leaders opened it")

        # change 33: the Briefing lists crossings only when there are some
        pg.goto(f"{BASE}/admin")
        settle(pg, 3000)
        crossed = api("/scoring/crossed")["crossed"]
        has = pg.locator("section[aria-label='Signs that crossed']").count() == 1
        check(has == bool(crossed), f"{width} px: crossed signs shown only when some crossed ({len(crossed)})")

        # change 34: the leaders' address counts an open (caught here, so nothing is written)
        seen: list[str] = []
        fctx = browser.new_context(viewport={"width": width, "height": 1000})
        fp = fctx.new_page()
        fp.route("**/api/frontier/pov/*/seen", lambda r: (seen.append(r.request.post_data or ""), r.fulfill(status=204)))
        fp.goto(f"{FRONT}/frontier/pov/x/{pov['tech_id']}")
        settle(fp)
        check(any('"opened"' in s for s in seen), f"{width} px: opening a Point of View on the leaders' address is counted")
        fp.evaluate("window.dispatchEvent(new Event('beforeprint'))")
        fp.wait_for_timeout(500)
        check(any('"printed"' in s for s in seen), f"{width} px: printing it is counted")
        fctx.close()

        check(not errors, f"{width} px: no page errors {errors[:2]}")
        ctx.close()
    browser.close()

# the leaders' address passes on that one write and no other
req = urllib.request.Request(f"{FRONT}/api/frontier/pov/walk-check/other", data=b"{}", method="POST",
                             headers={"content-type": "application/json"})
try:
    urllib.request.urlopen(req)
    check(False, "the leaders' address refuses other writes")
except urllib.error.HTTPError as e:
    check(e.code == 403, f"the leaders' address refuses other writes ({e.code})")
print(f"\n{'ALL CHECKS PASSED' if not fails else f'{len(fails)} FAILED'}")
