# Plan 6: six fabrics in the portal (tech-lens)

**Date:** 2026-10-04 · **Folder:** 2026-10-04/5 · **Status:** approved on 4 Oct ("please add the missing fabric").

**The fabrics, what TCL's website says and the proposals:** [tech-atlas plan 6](../../../../tech-atlas/docs/2026-10-04/5/implementation-plan.md).

## Changes

- **Label colours** (`app/globals.css`, `lib/theme.ts`), taken from TCL's own pages:
  - Security uses the azure of their Security page (`#00a4ff`);
  - Media uses the violet of their Media page (`#bf96ff`).

  Interaction keeps its purple. Their Interaction pages are Kaleyra red, which we keep for failures, and purple is Commotion's colour, also part of their Interaction Fabric.
- **Setup → Fabrics** (`app/admin/(setup)/scoring/fabrics/page.tsx`):
  - the intro no longer says "four" and states that a technology is scored in each fabric judged relevant to it;
  - the grid is 3 by 3 from 1,536 px, so six fabrics fill it.
- **Technology page help:** it lists the six fabrics.
- Everything else (labels, the scores tables, "Not assessed in …") reads the fabrics from the data.
