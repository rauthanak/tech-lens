"""Every page of the portal, at 1440 and 400 px, on the live data: a full
screenshot of each, for a first-time-reader review. Notes any page that
scrolls sideways or throws. Starts nothing that costs.

    docker cp tour.py tech-radar-atlas-1:/tmp/ && docker exec tech-radar-atlas-1 python /tmp/tour.py
"""

import os

from playwright.sync_api import sync_playwright

ADMIN, FRONTIER, OUT = "http://lens:3100", "http://frontier:3100", "/tmp/tour"
os.makedirs(OUT, exist_ok=True)
RUN, SOURCE, SCORING, TECH = "3ba3d120703a", "aws_reinvent", "88d8dfb82df9", "agentic-ai"
ONLY = os.environ.get("ONLY")
PAGES = {
    "briefing": "/admin",
    "operations": "/admin/operations",
    "runs": "/admin/runs",
    "run": f"/admin/runs/{RUN}",
    "run-source": f"/admin/runs/{RUN}/sources/{SOURCE}",
    "technologies": "/admin/technologies",
    "technology": f"/admin/technologies/{TECH}",
    "import": "/admin/import",
    "assessments": "/admin/scoring/assessments",
    "assessment-run": f"/admin/scoring/assessments/{SCORING}",
    "assessment": f"/admin/scoring/assessments/{SCORING}/{SCORING}:{TECH}:interaction",
    "assessment-pov": f"/admin/scoring/assessments/{SCORING}/pov/{TECH}",
    "povs": "/admin/scoring/pov",
    "pov": f"/admin/scoring/pov/{SCORING}/{TECH}",
    "setup-sources": "/admin/sources",
    "setup-source": f"/admin/sources/{SOURCE}",
    "setup-source-settings": "/admin/sources/settings",
    "setup-signals": "/admin/signals/list",
    "setup-scoring": "/admin/scoring",
    "setup-fabrics": "/admin/scoring/fabrics",
    "setup-measures": "/admin/scoring/measures",
    "setup-weights": "/admin/scoring/config",
    "setup-pending": "/admin/scoring/pending",
    "setup-classification": "/admin/classification",
    "setup-domains": "/admin/classification/domains",
    "setup-trl": "/admin/classification/trl",
    "setup-finance": "/admin/finance",
    "setup-assumptions": "/admin/assumptions",
    "setup-mechanisms": "/admin/mechanisms",
    "setup-path": "/admin/path",
    "setup-skills": "/admin/prompts",
    "setup-skill": "/admin/prompts/analyzer",
    "setup-skills-map": "/admin/prompts/map",
    "setup-changes": "/admin/changes",
    "frontier": "/frontier",
    "frontier-pov": f"/frontier/pov/{SCORING}/{TECH}",
}

with sync_playwright() as p:
    browser = p.chromium.launch()
    for width in (1440, 400):
        ctx = browser.new_context(viewport={"width": width, "height": 900}, timezone_id="America/Chicago")
        pg = ctx.new_page()
        errors: list[str] = []
        pg.on("pageerror", lambda e: errors.append(str(e)))
        for name, path in PAGES.items():
            if ONLY and not name.startswith(ONLY):
                continue
            errors.clear()
            base = FRONTIER if path.startswith("/frontier") else ADMIN
            try:
                pg.goto(base + path, timeout=60000)
                pg.wait_for_load_state("networkidle", timeout=60000)
                pg.wait_for_timeout(2500)
                wide = pg.evaluate("document.documentElement.scrollWidth - window.innerWidth")
                tall = pg.evaluate("document.documentElement.scrollHeight")
                pg.screenshot(path=f"{OUT}/{name}-{width}.png", full_page=tall < 9000)
                print(f"{width} {name}: {tall}px tall" + (f", SIDEWAYS {wide}px" if wide > 1 else "")
                      + (f", ERROR {errors[0][:120]}" if errors else ""))
            except Exception as exc:  # noqa: BLE001 — a page that won't load is a finding
                print(f"{width} {name}: FAILED {str(exc)[:160]}")
        ctx.close()
    browser.close()
