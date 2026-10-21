# A Point of View's "Use cases, fabric by fabric", read by a newcomer (21 Oct)

The user's review: the section is cryptic. "Tata's step" and "Finance: not entered yet (needed from the Proof of
concept step)" don't say what they are, what's missing, where it's entered or whether it matters.

What a first-time reader hit:
- titles in Tata's product names and acronyms (196 of 652 use cases: Vayu, IZO, CPaaS, MDR, SASE…);
- nine source numbers in a row;
- "light capital" with no reason (the reason is stored, never shown);
- "Tata's step: Evaluation" with no word that it's the path to scale, step 1 of 7, or what's next;
- "Finance: not entered yet" without what (Tata's margin, revenue, costs), what for (does it pay: contribution,
  payback, break-even), where (Finance on the technology's page) or when (from Proof of concept, so nothing is
  missing yet);
- the same two lines repeated in every fabric.

## Signed off: a table, and plain titles

1. **A table**, one row per use case, columns: Fabric · Use case · Investment needed · How far Tata has got ·
   Does it pay? The fabric-wide cells (fabric, how far, does it pay) span that fabric's rows.
   - Use case: the plain title; up to 3 source numbers, then "+n".
   - Investment needed: light / moderate / heavy, with its stored reason.
   - How far Tata has got: "Evaluation, step 1 of 7; next: Customer zero", or "Not recorded yet"; the blockers a
     person picked under it.
   - Does it pay?: the figures, or "Not known yet"; "Enter figures →" for admins.
   - A note under the table says what the last two columns mean, where they're entered, and that figures are asked
     for from Proof of concept (step n), so none is missing before then.
   - Accepted suggestions and "no use case yet" are rows too. On a phone the table scrolls inside its box.
2. **Plain titles**: value_levers v4 writes each title in plain words for a business reader outside Tata; a Tata
   product is named only beside what it is ("on Vayu, Tata's cloud"); acronyms spelled out. Then the use cases are
   asked again (refresh_levers.py, about 516 calls). Scores don't change.

pov_view adds each use case's capital reason, the step's number and the number of steps. Then: walks, client
change log change 16. Whether to rewrite the Points of View' own text afterwards is asked, not assumed.
