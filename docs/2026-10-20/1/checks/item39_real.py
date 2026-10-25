"""Change 39, run for real through the page as a person would: Add evidence
on FlexE (two links and a PDF file, through to its Point of View, assessing
even if thin) and on k0s (one link, judge only). Spends model calls.

    docker cp item39_real.py tech-radar-atlas-1:/tmp/ && docker exec tech-radar-atlas-1 python /tmp/item39_real.py
"""

import json
import time
import urllib.request

from playwright.sync_api import sync_playwright

BASE, API, OUT = "http://lens:3100", "http://localhost:8100/api", "/tmp/shots-after"
CASES = [("flex-ethernet-flexe", ["https://datatracker.ietf.org/doc/draft-ietf-ccamp-flexe-yang-cm/",
                                  "https://convergedigest.com/oif-launches-flexe-21-project/"],
          ["/tmp/OIF-FLEXE-02.0-1.pdf"], "pov"),
         ("k0s", ["https://www.cncf.io/blog/2026/01/26/k0s-in-2025-a-year-of-community-growth-governance-and-kubernetes-innovation/"],
          [], "judge")]


def api(path):
    return json.loads(urllib.request.urlopen(API + path).read())


with sync_playwright() as p:
    pg = p.chromium.launch().new_context(viewport={"width": 1440, "height": 1100}, timezone_id="America/Chicago").new_page()
    for tech, links, files, through in CASES:
        pg.goto(f"{BASE}/admin/technologies/{tech}")
        pg.wait_for_load_state("networkidle"); pg.wait_for_timeout(3000)
        pg.get_by_role("button", name="Add evidence: links or files").click()
        form = pg.locator("form[aria-label='Add evidence']")
        form.locator("textarea").fill("\n".join(links))
        if files:
            form.locator("input[type=file]").set_input_files(files)
        if through == "judge":
            form.get_by_label("Only judge its evidence", exact=False).check()
        else:
            form.get_by_text("Assess even if its evidence is still judged thin").click()
        pg.wait_for_timeout(300)
        form.screenshot(path=f"{OUT}/item-39-real-{tech}-form.png")
        print(tech, "start button:", form.get_by_role("button", name="Start").inner_text())
        form.get_by_role("button", name="Start").click()
        pg.wait_for_timeout(4000)
        pg.screenshot(path=f"{OUT}/item-39-real-{tech}-running.png")
        t0 = time.time()
        while time.time() - t0 < 1200:
            jobs = api(f"/find-evidence?tech_id={tech}&limit=1")["jobs"]
            if jobs and jobs[0]["status"] != "running":
                break
            time.sleep(10)
        j = jobs[0]
        print(tech, j["status"], round(time.time() - t0), "s:", j.get("summary") or j.get("error"))
        for r in j["results"]:
            print("   ", r["status"], r.get("title") or r["url"], r.get("reason") or "")
        pg.wait_for_timeout(5000)
        pg.screenshot(path=f"{OUT}/item-39-real-{tech}-done.png", full_page=False)
