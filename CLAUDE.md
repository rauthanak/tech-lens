@AGENTS.md

# Keep the client documents in step

This is the portal and leaders' site of the Emerging Technology Radar; its server is `../tech-atlas`.

Some changes alter what the product shows or how people use it:
- a screen, tab, button or label, or a wording people read;
- a filter or view;
- a workflow step or what a person can decide or undo;
- what the leaders' site shows.

For any of these, update in the same piece of work, without being asked:
- the business process;
- the technical architecture, when its parts change;
- the Product Guide;
- the Administrator's Training Manual, including retaking the affected screenshots, read-only, with `take_screens.py` and `make_crops.py`.

These documents live outside this repo, in `../final_deliverable/` and `../artifacts/`. `../AGENTS.md` lists every source file and how to re-render each one. Also add an entry to the client change log (`../tech-atlas/docs/2026-10-20/1/make_change_log.py`).

When you finish, say which documents changed. If none needed to, say why in one line.
