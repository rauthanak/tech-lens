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
        if d.get("reason") == "walk check" or (d["kind"] == "catalog" and d["_id"] not in catalog_before) \
                or (d["kind"] == "finance" and "walk check" in json.dumps(d.get("value"))):
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

        # item 8: the four answers, on the technology's Overview (change 18)
        pg.goto(f"{BASE}/admin/technologies/{tech}")
        settle(pg, 2500)
        body = pg.inner_text("body")
        check(all(w.lower() in body.lower() for w in ("Commercial availability", "Readiness (TRL)", "Domain", "Evidence")),
              "Technology: the four answers")
        if shot:
            pg.screenshot(path=f"{OUT}/item-8-answers.png")
        # item 6 + 12: a technology's fabric tab
        pg.goto(f"{BASE}/admin/technologies/{tech}?tab=fabrics")
        settle(pg, 2500)
        body = pg.inner_text("body")
        check(pg.locator("nav[aria-label=Fabrics] button").count() >= 1, "Technology: a tab per fabric")
        check("Override priority…" in body or "Change the override…" in body, "Technology: override the priority")
        check(bool(re.search(r"Measures in \w+", body)), "Technology: the fabric's measures")
        check(all(w in body for w in ("Use cases: where the value lands in", "Tata's plan for it in", "Where Tata is", "What's recorded",
                                      "Owner and next action", "What could stop it scaling")),
              "Technology: use cases and Tata's plan (where Tata is, what's recorded) on the tab, by what they are")
        check("Finance in" not in body and pg.locator("#finance").count() == 0, "Technology: no Finance part (set aside, change 21)")
        mores = pg.locator("details[id] > p button", has_text="More")
        check(mores.count() >= 3, "Technology: each part says in one line what it is, with More")
        mores.first.click()
        more = pg.locator("details[id]").first.inner_text()
        check("What you do" in more and "Where it shows" in more, "Technology: More says what you do and where it shows")
        mores.first.click()
        check("Tri's" not in body and "Nick's" not in body, "Technology: no people's names as labels")
        check("unscorable" not in body.lower(), "Technology: no 'unscorable' in the portal's words")
        no_sideways(pg, "Technology")
        if shot:
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
            pg.locator("div.max-w-4xl", has=taken).first.screenshot(path=f"{OUT}/item-15-technology.png")
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
        check(pg.get_by_role("radio", name=re.compile("Combined calls")).count() == 0,
              "Weights & Grid: how the model is called sits behind Technical details (change 26)")
        pg.evaluate("localStorage.setItem('tech-lens:under-the-hood', 'on')")
        pg.reload()
        settle(pg)
        stacked = pg.get_by_role("radio", name=re.compile("Combined calls"))
        stacked.wait_for(timeout=90000)  # the first calls after a backend restart can be slow
        check(stacked.get_attribute("aria-checked") == "true",
              "Weights & Grid: combined calls chosen")
        if shot:
            pg.get_by_role("heading", name="How an assessment calls the model").scroll_into_view_if_needed()
            pg.screenshot(path=f"{OUT}/item-5-engine.png")
        pg.get_by_role("radio", name=re.compile("One call per measure")).click()
        check("Switch to one call per measure? From the next assessment run, about 30" in pg.inner_text("main"),
              "Weights & Grid: switching how the model is called asks first, with its cost (change 26)")
        pg.get_by_role("button", name="Cancel").click()
        pg.evaluate("localStorage.removeItem('tech-lens:under-the-hood')")
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
        todo = pg.get_by_role("region", name="To do")
        titles = todo.locator("h3 button:first-child").all_inner_texts()
        check(titles == ["Before scoring", "Before publishing", "Publish to leaders"],
              f"Briefing: the To do strip's three columns ({titles})")
        first_col = todo.locator("div.px-5").first.inner_text()
        check(bool(re.search(r"\d[\d,]* (technolog|possibly|proposed|older)", first_col)) or "Nothing waits" in first_col,
              "Briefing: each column lists what waits first (change 23)")
        opened_before = pg.evaluate("localStorage.getItem('tech-lens:briefing-todo')")
        todo.get_by_role("button", name="Before scoring").click()
        pg.wait_for_timeout(500)
        check(todo.locator("#todo-before-scoring").count() == 1 or opened_before == "before-scoring",
              "Briefing: a column's title opens its full list below the strip")
        if todo.locator("#todo-before-scoring").count() == 1:
            todo.get_by_role("button", name="Before scoring").click()  # as it was
        no_sideways(pg, "Briefing")
        if shot:
            pg.screenshot(path=f"{OUT}/item-6-briefing.png")

        # change 24: the open list as cards, examples folded; Publish says what it sends
        todo.get_by_role("button", name="Before publishing").click()
        pg.wait_for_timeout(800)
        panel = todo.locator("#todo-before-publishing")
        cards = panel.locator("li.rounded-card")
        check(cards.count() >= 1 and "Advice, not a gate" in panel.inner_text(),
              f"Briefing: Before publishing opens as {cards.count()} cards, advice not a gate (change 24)")
        h = panel.bounding_box()["height"]
        check(width < 700 or h < 450, f"Briefing: the open list stays short ({h:.0f} px) (change 24)")
        if shot:
            box = todo.bounding_box()
            pg.screenshot(path=f"{OUT}/item-24-todo.png", clip={"x": 0, "y": max(0, box["y"] - 16), "width": width, "height": box["height"] + 32})
        which = panel.get_by_role("button", name=re.compile("^Which ones")).first
        if which.count():
            which.click()
            pg.wait_for_timeout(300)
            check(panel.get_by_role("button", name="Hide ▴").count() == 1, "Briefing: Which ones lists the technologies in place")
        todo.get_by_role("button", name="Publish to leaders").click()
        pg.wait_for_timeout(800)
        pub_panel = todo.locator("#todo-publish").inner_text()
        check("Publishing now sends" in pub_panel or "Nothing is published yet" in pub_panel,
              "Briefing: Publish says what it sends (change 24)")
        check("never your work in progress" in pub_panel, "Briefing: Publish says leaders see only what's published")
        if shot:
            box = todo.bounding_box()
            pg.screenshot(path=f"{OUT}/item-24-publish.png", clip={"x": 0, "y": max(0, box["y"] - 16), "width": width, "height": box["height"] + 32})
        pg.evaluate("v => v ? localStorage.setItem('tech-lens:briefing-todo', v) : localStorage.removeItem('tech-lens:briefing-todo')", opened_before)

        # item 14: plain words (21 Oct): the fabric tab's parts, Change step, Evidence, blockers, Setup lists, Operations
        if shot:
            pg.goto(f"{BASE}/admin/technologies/{tech}?tab=fabrics")
            settle(pg, 3000)
            part = lambda title: pg.locator("details", has=pg.locator("h3", has_text=title)).first
            pg.locator("#blockers").get_by_role("button", name="Pick blockers…").click()  # opens in place (change 20)
            check("Suggested from the pages" in pg.locator("#blockers").inner_text(),
                  "Blockers: the model's suggestions, marked, for a person to tick")
            part("Use cases: where the value lands").screenshot(path=f"{OUT}/item-14-use-cases.png")
            pg.locator("#blockers").screenshot(path=f"{OUT}/item-14-blockers.png")
            path = pg.locator("#path")
            path.get_by_role("button", name="Show every step's proof").click()  # the step reached and the next show first (change 18)
            check("isn't written yet" in path.inner_text(), "Path: steps without written proof share one line")
            path.get_by_role("button", name=re.compile("^(Change step|Record the step)$")).click()
            check(path.locator("input[type=radio]").count() >= 4 and path.get_by_role("button", name="Save").is_disabled(),
                  "Path: Change step turns the steps into a choice; Save waits for a different step")
            path.screenshot(path=f"{OUT}/item-14-change-step.png")
            path.get_by_role("button", name="Cancel").click()
            pg.locator("#plan").screenshot(path=f"{OUT}/item-14-owner.png")
            pg.goto(f"{BASE}/admin/technologies/{tech}?tab=evidence")
            settle(pg, 2000)
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
        check(all(w.lower() in words.lower() for w in ("Investment needed", "How far Tata has got", "path to scale"))
              and "does it pay" not in words.lower(),
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

        # change 18: the technology page, read first-time: Overview leads with the verdict and what waits on you
        summary = api(f"/technologies/{tech}/summary")
        pg.goto(f"{BASE}/admin/technologies/{tech}")
        settle(pg, 2500)
        main = pg.inner_text("main")
        headline = (summary["pov"] or {}).get("headline") or ""
        tabs = [re.sub(r"[\d,\s]+$", "", t) for t in pg.locator("nav[aria-label='Parts of this page'] a").all_inner_texts()]
        check(tabs == ["Overview", "Fabrics", "Evidence", "History"], f"Technology: four tabs, Overview first {tabs}")
        check(bool(headline) and main.index(headline[:40]) < main.index("Waiting on you") < main.index("Commercial availability".upper())
              if "Waiting on you" in main and headline else False, "Overview: the verdict, then Waiting on you, then what the radar judged")
        if width == 1440:
            check(pg.evaluate("document.documentElement.scrollHeight") < 2000, "Overview: fits in under 2,000 px at 1440")
        check("Tata's figure" not in main and "Undefined" not in main and not re.search(r"\b1 pages\b", main),
              "Overview: your figure, no 'Undefined', no '1 pages'")
        if shot:
            pg.screenshot(path=f"{OUT}/item-18-overview.png", full_page=True)
        first = next(o for o in summary["open"] if o["waiting_for_tata"] or o["unscored"])
        waiting = pg.locator("section", has=pg.locator("h2", has_text="Waiting on you"))
        if shot:
            waiting.screenshot(path=f"{OUT}/item-18-waiting.png")
        waiting.locator("li", has_text=first["fabric"]).get_by_role("link").first.click()
        settle(pg, 2500)
        check("tab=fabrics" in pg.url and f"fabric={first['fabric_id']}" in pg.url and "#measures" in pg.url,
              "Waiting on you: an item opens its fabric's tab at the part")
        box = pg.locator("#measures").bounding_box()
        check(box is not None and 0 <= box["y"] < pg.viewport_size["height"], "Waiting on you: the part is on screen")
        settle_n = first["unscored"] + first["waiting_for_tata"] + len(first["suggested_use_cases"]) \
            + (1 if first["override_moved"] else 0) + (1 if first["finance_missing"] else 0)
        badge = pg.locator("nav[aria-label=Fabrics] button", has_text=first["fabric"]).locator("span[title^='Before publishing']")
        check(badge.count() == 1 and badge.inner_text() == str(settle_n), f"Fabric tab: its number counts what to settle ({settle_n})")
        prio = pg.locator("#priority").inner_text()
        check(" because it arrives" in prio and "the prize is" in prio and all(w in prio for w in ("Market potential", "Strategic fit", "Adoption readiness")),
              "Fabric tab: why the priority, and the three scores, beside it")
        path = pg.locator("#path")
        check(path.locator("ol[aria-label=\"Tata's path to scale\"] li").count() >= 7, "Path: the seven steps as one progress track")
        if shot:
            pg.locator("#priority").screenshot(path=f"{OUT}/item-18-priority.png")
            path.screenshot(path=f"{OUT}/item-18-path.png")
        # change 19: the fabric tab: the bar stays, each part says how it stands, Tata's plan in the ladder's order
        pg.goto(f"{BASE}/admin/technologies/{tech}?tab=fabrics&fabric={first['fabric_id']}")
        settle(pg, 2500)
        heads = [pg.locator(f"#{i} > summary").inner_text() for i in ("measures", "plan")]
        check("to settle" in heads[0] or "All settled" in heads[0], f"Fabric tab: Measures says how it stands ({heads[0][:40]!r})")
        check(bool(re.search(r"Commitment: (No owner yet|Defined|Aligned|Integrated) · \d of 4 recorded", heads[1])),
              "Tata's plan: its commitment is a status in the title, with how much is recorded")
        plan = pg.locator("#plan").inner_text()
        check(plan.index("Where Tata is") < plan.index("What's recorded"), "Tata's plan: where Tata is on its process first, then what's recorded")
        check(pg.locator("#plan ol[aria-label=State]").count() == 0 and pg.locator("#plan ol[aria-label=\"Tata's path to scale\"] li").count() >= 7,
              "Tata's plan: one progress track, the path to scale; the commitment isn't drawn as steps")
        check(pg.locator("#plan li", has_text="The step Tata has reached").count() == 1 and
              pg.locator("#plan li", has_text="People, budget or a trial").count() == 1, "Tata's plan: the four things recorded, as a checklist")
        if pg.locator("#blockers").get_by_role("button", name="Pick blockers…").count():
            pg.locator("#blockers").get_by_role("button", name="Pick blockers…").click()
            check(pg.locator("#blockers input[type=checkbox]").count() >= 1, "Tata's plan: Pick blockers opens the checklist in place")
            pg.locator("#blockers").get_by_role("button", name="Cancel").click()
            check(pg.locator("#blockers").get_by_role("button", name="Pick blockers…").count() == 1, "Tata's plan: Cancel closes it")
        uc = pg.locator("#use-cases")
        check(uc.get_by_role("button", name=re.compile(r"^\d+ sources$")).count() >= 1 and uc.get_by_role("button", name="why").count() >= 1,
              "Use cases: sources folded into a count, the capital's reason one click away")
        uc.get_by_role("button", name=re.compile(r"^\d+ sources$")).first.click()
        check(uc.get_by_role("button", name="Hide sources").count() == 1, "Use cases: the sources open on click")
        pg.mouse.wheel(0, 2500)
        pg.wait_for_timeout(500)
        bar = pg.locator("nav[aria-label=Fabrics]").bounding_box()
        check(bar is not None and -2 <= bar["y"] < 80, "Fabric tab: the fabric bar stays in view as the page scrolls")
        # change 21: finance set aside; the next step's proof is entered on the path itself
        check(pg.locator("#path a[href='#finance']").count() == 0, "Path: nothing points to Finance")
        enter = pg.locator("#path").get_by_role("button", name="Enter…")
        if width == 1440 and enter.count():
            if shot:
                pg.locator("#path").screenshot(path=f"{OUT}/item-21-path.png")
            enter.first.click()
            pg.locator("#path input").first.fill("walk check: $4 a ticket against $9 today")
            pg.locator("#path").get_by_role("button", name="Save").click()
            settle(pg)
            check("walk check: $4 a ticket" in pg.locator("#path").inner_text(), "Path: the next step's proof is entered in place, and shows")
        if shot:
            pg.goto(f"{BASE}/admin/technologies/{tech}?tab=fabrics&fabric={first['fabric_id']}")
            settle(pg, 2500)
            pg.screenshot(path=f"{OUT}/item-19-fabric-tab.png", full_page=True)
            pg.locator("#plan").screenshot(path=f"{OUT}/item-20-plan.png")
            pg.locator("#use-cases").screenshot(path=f"{OUT}/item-19-use-cases.png")
        no_sideways(pg, "Fabric tab")

        pg.goto(f"{BASE}/admin/technologies/{tech}?tab=evidence")
        settle(pg, 2500)
        pages = summary["technology"]["page_count"]
        check(f"Pages · articles ({pages}" in pg.inner_text("main"), f"Evidence: one page count ({pages}), each page once")
        # History: a choice shows there, and Undo there takes it back
        fab_id = summary["assessment"]["fabrics"][0]["fabric_id"]
        api("/decisions", {"kind": "override", "tech_id": tech, "fabric_id": fab_id, "value": "P1", "reason": "walk check"})
        pg.goto(f"{BASE}/admin/technologies/{tech}?tab=history")
        settle(pg, 2500)
        hist = pg.inner_text("main")
        check(bool(re.search(rf"read [\d,]+ of its {pages:,} pages", hist)), "History: what the assessment read, of all its pages")
        row = pg.locator("li", has_text="walk check")
        check(row.count() == 1 and "set to P1" in row.inner_text() and "By a person" in row.inner_text(),
              "History: the choice, who made it, when and why")
        if shot:
            pg.screenshot(path=f"{OUT}/item-18-history.png", full_page=True)
        row.get_by_role("button", name="Undo").click()
        settle(pg)
        check(not any(d.get("reason") == "walk check" for d in api(f"/decisions?tech_id={tech}")["decisions"]),
              "History: Undo takes the choice back")
        no_sideways(pg, "Technology history")

        # change 21: finance off Setup; every dropdown's chevron set in from its edge
        pg.goto(f"{BASE}/admin/sources")
        settle(pg)
        check(pg.locator("nav a", has_text=re.compile("^Finance$")).count() == 0, "Setup: no Finance in the menu")
        pg.goto(f"{BASE}/admin/finance")
        settle(pg)
        check("Set aside for now" in pg.inner_text("main"), "Setup › Finance's address says it's set aside")
        pg.goto(f"{BASE}/admin/technologies")
        settle(pg, 2500)
        styles = pg.evaluate("""() => [...document.querySelectorAll('select')].map(s => [getComputedStyle(s).appearance,
            parseFloat(getComputedStyle(s).paddingRight)])""")
        check(bool(styles) and all(a == "none" and pr >= 30 for a, pr in styles), "Dropdowns: the chevron set in from the edge, room kept for it")
        if shot:
            sel = pg.locator("select[aria-label=Domain]")
            box = sel.bounding_box()
            pg.screenshot(path=f"{OUT}/item-21-dropdowns.png", clip={"x": 0, "y": box["y"] - 16, "width": width, "height": 110})

        # change 22: the Briefing, the Points of View list and one Point of View, by the same principles
        pg.goto(f"{BASE}/admin")
        settle(pg, 2500)
        main = pg.inner_text("main")
        heads = pg.locator("main h2").all_inner_texts()
        check("To do" in heads and "What the radar found" in heads and heads.index("To do") < heads.index("What the radar found"),
              "Briefing: To do first, then what the radar found")
        strip = pg.get_by_role("region", name="To do").inner_text()
        check(" items" not in strip, "Briefing: no summed 'items' count")
        pub = pg.get_by_role("region", name="To do").locator("div.px-5").nth(2).inner_text()
        check("Since then:" in pub or "Nothing has changed since" in pub or "Nothing published yet" in pub,
              "Briefing: the publish card says what changed since the edition")
        window = pg.locator("main select").first.bounding_box()
        count = pg.get_by_text(re.compile(r"findings from")).first.bounding_box()
        check(window is not None and count is not None and abs(window["y"] - count["y"]) < 30,
              "Briefing: the window menu sits on the line it changes")
        tabs = pg.get_by_role("tablist", name="Findings").get_by_role("tab")
        check(tabs.all_inner_texts()[0].startswith("New ·") and tabs.all_inner_texts()[1].startswith("Old ·"),
              "Briefing: New and Old as two tabs (change 23)")
        summary_ = api("/briefing")
        tabs.nth(1).click()
        settle(pg, 2000)
        check("band=older" in pg.url and (summary_["counts"]["older"] == 0 or pg.locator("main section[aria-label=Findings] a, main section[aria-label=Findings] button").count() > 0),
              "Briefing: the Older tab lists older articles")
        if shot:
            pg.goto(f"{BASE}/admin")
            settle(pg, 2500)
            pg.screenshot(path=f"{OUT}/item-23-briefing.png", clip={"x": 0, "y": 0, "width": width, "height": 900})
        pg.goto(f"{BASE}/admin/scoring/pov")
        settle(pg, 2500)
        check(pg.get_by_role("region", name="Keeping them current").count() == 1 or "Keeping them current" in pg.inner_text("main"),
              "Points of View: what keeps them current, at the top")
        firsts = [min([t for t in c.locator(".font-mono").all_inner_texts() if re.fullmatch(r"P\d", t)] or ["P9"])
                  for c in pg.locator("main a[href*='/admin/scoring/pov/']").all()[:8]]
        check(bool(firsts) and firsts == sorted(firsts), f"Points of View: highest priority first ({firsts})")
        pg.get_by_label("Priority").select_option("none")
        settle(pg, 800)
        cards_ = pg.locator("main a[href*='/admin/scoring/pov/']")
        check(cards_.count() == 0 or "no priority" in cards_.first.inner_text(), "Points of View: a fabric without a priority says so")
        pg.get_by_label("Priority").select_option("")
        current = pg.get_by_role("region", name="Keeping them current").inner_text()
        check("Leaders see these as" in current or "Nothing is published yet" in current,
              "Points of View: says which versions leaders see (change 24)")
        if shot:
            pg.screenshot(path=f"{OUT}/item-22-povs.png", clip={"x": 0, "y": 0, "width": width, "height": 900})
        pg.goto(f"{BASE}/admin/scoring/pov/{pov_row['scoring_run_id']}/{tech}")
        settle(pg, 2500)
        head = pg.inner_text("main")
        check("All Points of View →" not in head and "Assessment run →" not in head, "Point of View: one way back, no technical link")
        since_pov = api(f"/technologies/{tech}/summary")["new_pages"]["since_pov"] or 0
        check(since_pov == 0 or "arrived after this was written" in head, "Point of View: says when pages arrived after it")
        check("At its latest look:" in head or "Not judged yet" in head, "Point of View: the evidence reason says it's the latest look")
        if shot:
            pg.screenshot(path=f"{OUT}/item-22-pov.png", clip={"x": 0, "y": 0, "width": width, "height": 700})
        check("Leaders see" in head or "Nothing is published yet" in head, "Point of View: says which version leaders see (change 24)")
        sent = api(f"/editions/pov/{tech}")["composed_at"] == api(f"/scoring/runs/{pov_row['scoring_run_id']}/pov/{tech}")["composed_at"]
        check(sent == ("Leaders see this version" in head), "Point of View: 'this version' only when the edition holds it")
        if shot:
            pg.get_by_text(re.compile("^(Leaders see|Nothing is published)")).first.screenshot(path=f"{OUT}/item-24-pov-line.png")
        edition = (api("/editions")["editions"] or [None])[0]
        later = [r for r in api("/scoring/povs")["povs"] if edition and r["composed_at"] > edition["published_at"]]
        if later:  # one rewritten after the edition: leaders still see the earlier version
            pg.goto(f"{BASE}/admin/scoring/pov/{later[0]['scoring_run_id']}/{later[0]['tech_id']}")
            settle(pg, 2500)
            line = pg.get_by_text(re.compile("^Leaders see")).first
            check("this one was written after it" in line.inner_text(), "Point of View: a rewrite says leaders still see the earlier version")
            if shot:
                pg.screenshot(path=f"{OUT}/item-24-pov.png", clip={"x": 0, "y": 0, "width": width, "height": 480})
        before_open = pg.evaluate("localStorage.getItem('tech-lens:briefing-todo')")
        link = pg.get_by_role("link", name=re.compile("^Publish on the Briefing"))
        check(not later or link.count() > 0, "Point of View: a rewrite links to Publish")
        if link.count():
            link.first.click()
            settle(pg, 2500)
            check(pg.locator("#todo-publish").count() == 1, "Point of View: its Publish link opens the Briefing's Publish column")
            pg.evaluate("v => v ? localStorage.setItem('tech-lens:briefing-todo', v) : localStorage.removeItem('tech-lens:briefing-todo')", before_open)

        check(not errors, f"no page errors at {width} px {errors[:2]}")
        ctx.close()
    browser.close()

print(f"\n{'ALL CHECKS PASSED' if not fails else f'{len(fails)} FAILED'}")
