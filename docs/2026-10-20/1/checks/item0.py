"""Item 0 check: walk the quick fixes as a first-time admin, on the live portal.

Runs inside the API container (it has Playwright and Chromium):
    docker cp item0.py tech-radar-atlas-1:/tmp/ && docker exec tech-radar-atlas-1 python /tmp/item0.py
Screenshots land in /tmp/shots-after. Every failed check prints FAIL with why.
"""

import os
import re

from playwright.sync_api import sync_playwright

BASE = "http://lens:3100"
OUT = "/tmp/shots-after"
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


def active_menu(pg) -> str:
    return pg.locator("header nav a.border-azure").first.inner_text().strip()


with sync_playwright() as p:
    browser = p.chromium.launch()
    for width in (1440, 1920, 400):
        ctx = browser.new_context(viewport={"width": width, "height": 1000})
        pg = ctx.new_page()
        errors: list[str] = []
        pg.on("pageerror", lambda e: errors.append(str(e)))
        shot = width == 1440
        print(f"\n── {width} px")

        # 1–3 as they stand after items 6–8 replaced item 0's interim screens: no "Up to date",
        # every technology says where it is, and a fabric's result stays on the technology's page
        pg.goto(BASE + "/admin/technologies")
        settle(pg)
        body = pg.locator("main").inner_text()
        check("Up to date" not in body, "Technologies: no 'Up to date' anywhere")
        check(pg.get_by_role("button", name=re.compile(r"^Assessed")).count() == 1, "Technologies: an 'Assessed' view")
        no_sideways(pg, "Technologies")
        if shot:
            pg.screenshot(path=f"{OUT}/item-0-technologies.png")

        pg.goto(BASE + "/admin/technologies/agentic-ai?from=%2Fadmin%2Ftechnologies")
        settle(pg, 2500)
        body = pg.inner_text("body")
        check(bool(re.search(r"\d+ of \d+ measures had enough evidence to score", body)),
              "Technology: 'x of y measures had enough evidence to score'")
        check("Up to date" not in body, "Technology: no 'Up to date'")
        check(active_menu(pg) == "Technologies" if width != 400 else True, "Technology: the top bar keeps Technologies lit")
        pg.goto(BASE + "/admin/technologies/agentic-ai?tab=fabrics&from=%2Fadmin%2Ftechnologies")  # the Fabrics tab (change 18)
        settle(pg, 2500)
        body = pg.inner_text("body")
        check(pg.locator("nav[aria-label=Fabrics] button").count() >= 2, "Technology: a tab per fabric, on its own page")
        # the portal's own words; the model's justifications (leading-relaxed paragraphs) are skill output
        chrome = pg.evaluate("""() => { const c = document.body.cloneNode(true);
            c.querySelectorAll('p.leading-relaxed').forEach((e) => e.remove()); return c.innerText; }""")
        check("unscorable" not in chrome.lower(), "Technology: no 'unscorable' in the portal's labels")
        check(not re.search(r"\b[MSAX][1-3]\b", body.replace("P1", "").replace("H1", "")),
              "Technology: no measure codes (M1, X1…) without Technical details")
        pg.get_by_text(re.compile(r"^Settled · ")).first.click()  # settled measures fold closed (change 14)
        check(bool(re.search(r"Addressable market|Maturity \(TRL\)", pg.inner_text("body"))), "Technology: measures by name")
        check(not re.search(r"\b[0-9a-f]{12}\b", chrome), "Technology: no run or collection ids")
        no_sideways(pg, "Technology")
        if shot:
            pg.screenshot(path=f"{OUT}/item-0-technology.png")

        # 4. Skills by title, code names only under Technical details
        pg.goto(BASE + "/admin/prompts")
        settle(pg)
        body = pg.inner_text("body")
        check("Score one measure" in body and "measure_scoring" not in body, "Skills: titles, no code names")
        if shot:
            pg.screenshot(path=f"{OUT}/item-0-skills.png")
        pg.goto(BASE + "/admin/prompts/measure_scoring")
        settle(pg)
        check(pg.locator("h1").first.inner_text() == "Score one measure", "Skill: the title is its plain name")
        check("UTC" not in pg.inner_text("body"), "Skill: the saved time is in the reader's zone, not UTC")

        # 5. Every Scoring method tab has a title and a one-line purpose
        for path, title in [("/admin/scoring", "The scoring method, at a glance"), ("/admin/scoring/fabrics", "Fabrics"),
                            ("/admin/scoring/measures", "Measures"), ("/admin/scoring/config", "Weights and grid"),
                            ("/admin/scoring/pending", "Open questions")]:
            pg.goto(BASE + path)
            settle(pg, 800)
            got = pg.locator("h1").first.inner_text() if pg.locator("h1").count() else ""
            check(got == title, f"Scoring method {path}: title {got!r}")
            check(pg.get_by_text("How to read this page").count() == 1, f"Scoring method {path}: its help")
            no_sideways(pg, f"Scoring method {path}")
            if shot and path == "/admin/scoring/measures":
                pg.screenshot(path=f"{OUT}/item-0-scoring-tab.png")

        # 6. Sources open on the switched-on ones, the rest one click away
        pg.goto(BASE + "/admin/sources")
        settle(pg)
        count = pg.locator("text=/^\\d+ of \\d+$/").first.inner_text()
        on, total = map(int, count.split(" of "))
        check(on < total, f"Sources: opens on the switched-on ones ({count})")
        if shot:
            pg.screenshot(path=f"{OUT}/item-0-sources.png")
        pg.get_by_role("button", name=f"Show all {total}").click()
        pg.wait_for_timeout(500)
        check(pg.locator("text=/^\\d+ of \\d+$/").first.inner_text() == f"{total} of {total}", "Sources: Show all lists every one")
        no_sideways(pg, "Sources")

        check(not errors, f"no page errors at {width} px {errors[:2]}")
        ctx.close()
    browser.close()

print(f"\n{'ALL CHECKS PASSED' if not fails else f'{len(fails)} FAILED'}")
