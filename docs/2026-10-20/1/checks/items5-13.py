"""Items 5–17 check, as a first-time admin on the live portal: combined calls,
Gate 2 on a technology's fabric tab, the organised list, classification,
possible nascent, Find evidence, import, the Point of View, and Frontier at
its own address. Writes nothing it doesn't undo.

    docker cp items5-13.py tech-radar-atlas-1:/tmp/ && docker exec tech-radar-atlas-1 python /tmp/items5-13.py
"""

import atexit
import json
import os
import re
import urllib.request

from playwright.sync_api import sync_playwright

BASE = "http://lens:3100"
FRONTIER = os.environ.get("FRONTIER", "http://frontier:3100")
API = "http://localhost:8100/api"
OUT = "/tmp/shots-after"
os.makedirs(OUT, exist_ok=True)
fails: list[str] = []


def check(ok: bool, what: str) -> None:
    print(("ok   " if ok else "FAIL ") + what)
    if not ok:
        fails.append(what)


# headings styled in capitals come back in capitals, so words are matched
# ignoring case


def settle(pg, ms: int = 1800) -> None:
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


# a tracked technology with a held fabric, and a classified thin one, from the live data
tracked = api("/technologies?view=tracked&limit=50")["technologies"]
tech = next((t for t in tracked if t["_id"] == "agentic-ai"), tracked[0])["_id"]
thin = api("/technologies?status=thin&limit=5")["technologies"][0]["_id"]
nascent = api("/technologies?view=nascent&limit=5")["technologies"]
povs = api("/scoring/povs")["povs"]
pov_row = next((r for r in povs if r["tech_id"] == tech), povs[0])

catalog_before = {d["_id"] for d in api(f"/decisions?tech_id={tech}")["decisions"] if d["kind"] == "catalog"}


@atexit.register
def undo_walk_choices() -> None:
    """The walk's override (reason "walk check") and its catalog take-out never
    outlive it, even if it stopped halfway."""
    for d in api(f"/decisions?tech_id={tech}")["decisions"]:
        if d.get("reason") == "walk check" or (d["kind"] == "catalog" and d["_id"] not in catalog_before):
            api(f"/decisions/{d['_id']}", method="DELETE")
            print("undid the walk's", d["kind"])


with sync_playwright() as p:
    browser = p.chromium.launch()
    for width in (1440, 1920, 400):
        ctx = browser.new_context(viewport={"width": width, "height": 1000}, timezone_id="America/Chicago")
        pg = ctx.new_page()
        errors: list[str] = []
        pg.on("pageerror", lambda e: errors.append(str(e)))
        shot = width == 1440
        print(f"\n── {width} px")

        # item 6 + 12: a technology's fabric tab
        pg.goto(f"{BASE}/admin/technologies/{tech}")
        settle(pg, 2500)
        body = pg.inner_text("body")
        check(pg.locator("nav[aria-label=Fabrics] button").count() >= 1, "Technology: a tab per fabric")
        check("Override priority…" in body or "Change the override…" in body, "Technology: override the priority")
        check(bool(re.search(r"Measures in \w+", body)), "Technology: the fabric's measures")
        check(all(w in body for w in ("Use cases: where the value lands in", "What could stop it scaling in",
                                      "How far Tata has got with it in", "Who owns it at Tata, and what's next in", "Finance in")),
              "Technology: use cases, blockers, path, owner and finance on the tab, by what they are")
        check(body.count("What it is") >= 6 and body.count("Where it shows") >= 5,
              "Technology: each part says what it is, what you do and where it shows")
        check("Tri's" not in body and "Nick's" not in body, "Technology: no people's names as labels")
        check(all(w.lower() in body.lower() for w in ("Commercial availability", "Readiness (TRL)", "Domain", "Evidence")),
              "Technology: the four answers")
        check("unscorable" not in body.lower(), "Technology: no 'unscorable' in the portal's words")
        no_sideways(pg, "Technology")
        if shot:
            pg.screenshot(path=f"{OUT}/item-8-answers.png")
            pg.locator("text=Measures in").first.scroll_into_view_if_needed()
            pg.screenshot(path=f"{OUT}/item-6-fabric-tab.png")
            pg.locator("text=Use cases: where the value lands in").first.scroll_into_view_if_needed()
            pg.screenshot(path=f"{OUT}/item-12-value-tab.png")

        # an override, with a reason, then undo (item 6)
        if width == 1440:
            pg.get_by_role("button", name=re.compile("Override priority…|Change the override…")).first.click()
            pg.locator("form select").first.select_option("P1")
            pg.get_by_placeholder("why this priority, not the computed one").fill("walk check")
            pg.get_by_role("button", name="Save").first.click()
            settle(pg)
            check("override in force" in pg.inner_text("body"), "Override: shows in force, with the computed one")
            # the Undo beside the walk's own override, not another choice's (imported values have one too)
            pg.locator("div", has_text="walk check").filter(has=pg.get_by_role("button", name="Undo")).last \
                .get_by_role("button", name="Undo").click()
            settle(pg)
            check("walk check" not in pg.inner_text("body"), "Override: undo restores the computed priority")

        # the old assessment address redirects to the fabric tab
        run_id = api(f"/technologies/{tech}/summary")["assessment"]["scoring_run_id"]
        fab = api(f"/technologies/{tech}/summary")["assessment"]["fabrics"][0]
        pg.goto(f"{BASE}/admin/scoring/assessments/{run_id}/{fab['assessment_id']}")
        settle(pg)
        check(f"/admin/technologies/{tech}" in pg.url and f"fabric={fab['fabric_id']}" in pg.url, "Old assessment links land on the fabric tab")

        # item 7: views, filters, status with its reason
        pg.goto(f"{BASE}/admin/technologies")
        settle(pg, 2500)
        pills = pg.get_by_role("group", name="Groups").inner_text()
        check(all(w in pills for w in ("Assessed", "Not assessed", "Emerging", "New to Tata", "Blind spots", "Possibly nascent",
                                       "In catalog, thin evidence", "Switched off")), "List: the groups, in the deck's words")
        check(pg.locator("thead th", has_text="Status").count() == 1, "List: where each one is, with its reason")
        main = pg.inner_text("main")
        check(bool(re.search(r"Research\s*[\d,]+.*Pilot\s*[\d,]+.*Early commercial\s*[\d,]+.*Mature\s*[\d,]+", main, re.S)),
              "List: Tata's buckets in order, with counts")
        check(pg.locator("tbody tr").first.locator("select").count() == 0, "List: rows have no menus; ticked rows move together")
        pg.get_by_role("button", name=re.compile("^Possibly nascent")).click()
        settle(pg)
        check("view=nascent" in pg.url, "List: a view is one click, kept in the address")
        check(pg.get_by_role("button", name="Yes, nascent").count() > 0, "List: possibly nascent settled from the list")
        no_sideways(pg, "Technologies")
        if shot:
            pg.goto(f"{BASE}/admin/technologies?view=emerging")
            settle(pg, 2500)
            pg.screenshot(path=f"{OUT}/item-7-technologies.png")

        # the leaders' screen is called the leaders' view, never Frontier
        for page in (f"/admin/technologies/{tech}", "/admin/assumptions", "/admin"):
            pg.goto(f"{BASE}{page}")
            settle(pg)
            # news text may say "Frontier AI" or "Frontier-model"; our own labels never say Frontier
            check(not re.search(r"Frontier(?![ -](AI|model))", pg.inner_text("body")), f"{page}: says the leaders' view, not Frontier")

        # item 15: the groups say how they work; Move to… moves between them, the catalog included
        pg.goto(f"{BASE}/admin/technologies")
        settle(pg, 2500)
        note = pg.locator("details", has=pg.locator("summary", has_text=re.compile("^How the groups work$")))
        words = note.inner_text() if note.count() == 1 else ""
        check(all(w in words for w in ("Emerging-technologies", "New to Tata", "Blind spots", "Move to")),
              "List: how the groups work, naming the catalog's file and how to move")
        check("Tata's list" not in pg.inner_text("main"), "List: says catalog, not Tata's list")
        if shot:
            note.screenshot(path=f"{OUT}/item-15-groups.png")
            pg.get_by_label("Search technologies").fill("agentic ai")
            settle(pg, 2500)
            first = pg.locator("tbody tr").first
            check(f"/admin/technologies/{tech}" in (first.get_by_role("link").first.get_attribute("href") or ""),
                  "List: the walk's technology found")
            first.get_by_role("checkbox").check()
            menu = pg.get_by_label("Move the selected to another group")
            opts = menu.evaluate("s => [...s.options].map(o => o.text)")
            check(all(o in opts for o in ("Mature", "Add to the catalog", "Take out of the catalog", "Yes, nascent", "No, not nascent")),
                  "List: Move to… offers availability, the catalog and nascent")
            pg.screenshot(path=f"{OUT}/item-15-bar.png")
            menu.select_option("catalog:no")
            settle(pg)
            check("taken out of the catalog" in pg.inner_text("body"), "List: Move to… says what it did")
            check(not api(f"/technologies/{tech}/summary")["technology"]["catalog"]["in"], "Catalog: taken out by a person")
            pg.goto(f"{BASE}/admin/technologies/{tech}")
            settle(pg)
            taken = pg.locator("p", has_text="Taken out of the catalog by a person")
            check(taken.count() == 1, "Technology page: who took it out, and when")
            pg.screenshot(path=f"{OUT}/item-15-technology.png", clip={"x": 0, "y": 0, "width": width, "height": 560})
            taken.get_by_role("button", name="Undo").click()
            settle(pg)
            check(api(f"/technologies/{tech}/summary")["technology"]["catalog"]["in"], "Catalog: Undo puts it back")
            check(pg.get_by_role("button", name="Take out of the catalog").count() == 1, "Technology page: Take out of the catalog")

        # item 9 + 10: a thin technology offers Find evidence
        pg.goto(f"{BASE}/admin/technologies/{thin}")
        settle(pg)
        body = pg.inner_text("body")
        check("Find evidence" in body and "Add a link" in body, "Thin technology: Find evidence and Add a link")
        if shot:
            pg.screenshot(path=f"{OUT}/item-10-find-evidence.png")
        if nascent:
            pg.goto(f"{BASE}/admin/technologies/{nascent[0]['_id']}")
            settle(pg)
            check("Possibly nascent:" in pg.inner_text("body") and pg.get_by_role("button", name="Yes, nascent").count() > 0,
                  "Nascent: the flag with Yes / No")
            if shot:
                pg.screenshot(path=f"{OUT}/item-9-nascent.png")

        # item 8: classification setup
        pg.goto(f"{BASE}/admin/classification/domains")
        settle(pg)
        check(pg.locator("h1").first.inner_text() == "Domains and sub-domains", "Classification: domains and sub-domains")
        no_sideways(pg, "Classification")
        if shot:
            pg.screenshot(path=f"{OUT}/item-8-classification.png")

        # item 11: import, waiting at review
        pg.goto(f"{BASE}/admin/import")
        settle(pg)
        check(pg.locator("h1").first.inner_text() == "Import technologies", "Import: the page")
        no_sideways(pg, "Import")
        if shot:
            imp = api("/imports")["imports"]
            if imp:
                pg.goto(f"{BASE}/admin/import?id={imp[0]['_id']}")
                settle(pg, 2500)
            pg.screenshot(path=f"{OUT}/item-11-import.png")

        # item 5: the engine choice, and a skill as it's sent stacked
        pg.goto(f"{BASE}/admin/scoring/config")
        settle(pg)
        stacked = pg.get_by_role("radio", name=re.compile("Combined calls"))
        stacked.wait_for(timeout=90000)  # the first calls after a backend restart can be slow
        check(stacked.get_attribute("aria-checked") == "true",
              "Weights & Grid: combined calls chosen")
        if shot:
            pg.get_by_text("How an assessment calls the model").scroll_into_view_if_needed()
            pg.screenshot(path=f"{OUT}/item-5-engine.png")
        pg.goto(f"{BASE}/admin/prompts/measure_scoring")
        settle(pg)
        pg.get_by_role("radio", name=re.compile("^Inside the fabric")).click()
        settle(pg, 3000)
        check("reused" in pg.inner_text("body").lower(), "Skill page: shown inside the combined call, its shared parts marked")
        if shot:
            pg.get_by_text("Show it", exact=True).scroll_into_view_if_needed()
            pg.screenshot(path=f"{OUT}/item-5-stacked.png")

        # item 3: skills map shows the stacked calls
        pg.goto(f"{BASE}/admin/prompts/map")
        settle(pg)
        check("One call: Technology call" in pg.inner_text("body"), "Skill map: the stacked calls as dashed boxes")

        # item 6/7: the Briefing's two lists
        pg.goto(f"{BASE}/admin")
        settle(pg, 2500)
        cards = [pg.get_by_role("group", name=n) for n in ("Before scoring", "Before publishing", "Publish the edition")]
        check(all(c.count() == 1 for c in cards), "Briefing: the two to-do lists and Publish the edition")
        check(all(not c.evaluate("e => e.open") for c in cards), "Briefing: the three cards start closed")
        check(bool(re.search(r"Before scoring\s*(·\s*)?(\d+ things? to settle|Nothing waits)", pg.inner_text("main"))),
              "Briefing: a closed card still says what waits")
        cards[0].locator("summary").click()
        check(cards[0].evaluate("e => e.open"), "Briefing: a card opens on its title")
        cards[0].locator("summary").click()  # as it was
        no_sideways(pg, "Briefing")
        if shot:
            pg.screenshot(path=f"{OUT}/item-6-briefing.png")

        # item 14: plain words (21 Oct): the fabric tab's parts, Change step, Evidence, blockers, Setup lists, Operations
        if shot:
            pg.goto(f"{BASE}/admin/technologies/{tech}")
            settle(pg, 3000)
            part = lambda title: pg.locator("details", has=pg.locator("h3", has_text=title)).first
            check("Suggested from the pages" in part("What could stop it scaling").inner_text(),
                  "Blockers: the model's suggestions, marked, for a person to tick")
            part("Use cases: where the value lands").screenshot(path=f"{OUT}/item-14-use-cases.png")
            part("What could stop it scaling").screenshot(path=f"{OUT}/item-14-blockers.png")
            path = part("How far Tata has got with it")
            check("isn't written yet" in path.inner_text(), "Path: steps without written proof share one line")
            path.get_by_role("button", name=re.compile("^(Change step|Record the step)$")).click()
            check(path.locator("input[type=radio]").count() >= 4 and path.get_by_role("button", name="Save").is_disabled(),
                  "Path: Change step turns the steps into a choice; Save waits for a different step")
            path.screenshot(path=f"{OUT}/item-14-change-step.png")
            path.get_by_role("button", name="Cancel").click()
            part("Who owns it at Tata").screenshot(path=f"{OUT}/item-14-owner.png")
            pg.get_by_role("tab", name=re.compile("^Pages")).click()
            settle(pg, 800)
            check(pg.get_by_role("tab", name=re.compile("^Pages")).get_attribute("aria-selected") == "true"
                  and "collected" in pg.get_by_role("tabpanel").inner_text(), "Evidence: findings and pages as two tabs")
            pg.goto(f"{BASE}/admin/mechanisms")
            settle(pg)
            pg.get_by_text("Earn additional contribution").first.click()
            settle(pg, 500)
            body = pg.inner_text("main")
            check("Keep contribution Tata already earns" in body and pg.locator("textarea").count() >= 1,
                  "Mechanisms: editing one keeps the others' definitions in view")
            pg.screenshot(path=f"{OUT}/item-14-mechanisms.png")
            pg.get_by_role("button", name="Cancel").click()
            pg.goto(f"{BASE}/admin/operations")
            settle(pg, 2500)
            body = pg.inner_text("main")
            check("Last organized" in body and "Classified" in body and "had nothing new" in body,
                  "Operations: each step says when it last ran and what it did")
            pg.locator("ol").first.screenshot(path=f"{OUT}/item-14-operations.png")
            pg.goto(f"{BASE}/admin")
            settle(pg, 2500)
            pg.screenshot(path=f"{OUT}/item-14-briefing.png")

        # item 12: the Point of View
        pg.goto(f"{BASE}/admin/scoring/pov/{pov_row['scoring_run_id']}/{pov_row['tech_id']}")
        settle(pg, 2500)
        body = pg.inner_text("body")
        check(all(w.lower() in body.lower() for w in ("Priority", "Maturity", "Commercial availability", "Evidence")),
              "Point of View: the answers row")
        check("score detail" in body.lower(), "Point of View: score detail folded")
        uc = pg.locator("section", has=pg.locator("h2", has_text=re.compile("^Use cases, fabric by fabric$", re.I)))
        words = uc.inner_text() if uc.count() == 1 else ""
        check(all(w.lower() in words.lower() for w in ("Investment needed", "How far Tata has got", "Does it pay?",
                                                        "path to scale", "entered under Finance")),
              "Point of View: use cases as a table, with what each column means")
        if shot:
            uc.screenshot(path=f"{OUT}/item-16-use-cases.png")
        # item 17: scores explained, Why opens the measures in place, no Details link away
        sc = pg.locator("section", has=pg.locator("h2", has_text=re.compile("^Scores$", re.I)))
        words = sc.inner_text().lower() if sc.count() == 1 else ""
        check(all(w in words for w in ("how big the prize could be", "how well it fits tata", "how ready it is to adopt now")),
              "Point of View: what each score asks")
        check(pg.get_by_role("link", name=re.compile("^Details")).count() == 0, "Point of View: no Details link away from it")
        if shot:
            sc.screenshot(path=f"{OUT}/item-17-scores.png")
        pg.locator(".score-row button").first.scroll_into_view_if_needed()  # the click would scroll it into view itself
        y0 = pg.evaluate("scrollY")
        pg.locator(".score-row button").first.click()
        pg.wait_for_timeout(600)
        panel = pg.get_by_role("dialog")
        check(panel.count() == 1 and "weighted mean" in panel.inner_text() and "Addressable market" in panel.inner_text(),
              "Point of View: Why opens the measures behind a fabric's scores in a panel on the right")
        if shot:
            pg.screenshot(path=f"{OUT}/item-17-why-panel.png")
        pg.keyboard.press("Escape")
        pg.wait_for_timeout(500)
        check(pg.get_by_role("dialog").count() == 0 and abs(pg.evaluate("scrollY") - y0) < 2,
              "Point of View: closing the panel puts the page back as it was")
        no_sideways(pg, "Point of View")
        if shot:
            pg.screenshot(path=f"{OUT}/item-12-pov.png")

        # item 13: Frontier at its own address, and nothing else reachable
        pg.goto(f"{FRONTIER}/")
        settle(pg, 2500)
        check("Leaders' view" in pg.inner_text("header"), "Leaders' view: its own address opens on it, called the leaders' view")
        no_sideways(pg, "Frontier")
        edition = api("/frontier")["edition"]
        names = pg.inner_text("main")
        if not edition:
            check("Nothing is published yet" in names, "Frontier: says plainly that nothing is published yet")
        else:
            check(edition.get("label", "") in names or (edition.get("name") or "") in names, "Frontier: names the edition shown")
            stage_nav = pg.get_by_role("navigation", name="Stage")
            check(stage_nav.locator("[aria-current=page]").inner_text() == "Emerging", "Frontier: opens on emerging stages")
            check("on the frontier" in names.lower(), "Frontier: the frontier and what's on it")
            check("Growth" in names and "Defence" in names, "Frontier: the Growth / Defence lens")
            check("Assumptions" in names or "assumptions" in names, "Frontier: the assumptions in force")
            if shot:
                pg.screenshot(path=f"{OUT}/item-13-frontier.png")
            stage_nav.get_by_role("link", name="All stages").click()
            settle(pg)
            check("stage=all" in pg.url, "Frontier: All stages is one click, kept in the address")
        pg.goto(f"{FRONTIER}/admin/technologies")
        settle(pg)
        check("/frontier" in pg.url, "Frontier: an admin address redirects to Frontier")
        r = pg.request.post(f"{FRONTIER}/api/technologies/bulk", data={"ids": ["x"], "action": "switch_off"})
        check(r.status == 403, f"Frontier: a write is refused ({r.status})")
        r = pg.request.get(f"{FRONTIER}/api/settings/radar")
        check(r.status == 403, f"Frontier: a GET outside its list is refused ({r.status})")

        check(not errors, f"no page errors at {width} px {errors[:2]}")
        ctx.close()
    browser.close()

print(f"\n{'ALL CHECKS PASSED' if not fails else f'{len(fails)} FAILED'}")
