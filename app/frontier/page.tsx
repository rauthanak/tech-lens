"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import BackendError from "@/components/BackendError";
import PageHeader from "@/components/PageHeader";
import Grid from "@/components/frontier/Grid";
import {
  type Frontier, frontierOf, type Item, type Lens, LENS_WORDS, pastEmerging, type Published, upOf,
} from "@/components/frontier/items";
import { ActNow, Assumptions, card, Committed, EvidenceThisEdition, MovedSince, NotPlaced, OnTheFrontier, pill } from "@/components/frontier/Sections";
import Table from "@/components/frontier/Table";
import { fetchJson } from "@/lib/api";
import { useMedia } from "@/lib/media";
import { formatAt, plural } from "@/lib/format";
import { useHere } from "@/lib/here";

function FrontierView() {
  const params = useSearchParams();
  const path = usePathname() ?? "/frontier";
  const here = useHere();
  const fabric = params.get("fabric") ?? "";
  // a phone opens on the table (390 dots don't fit a phone's width); the grid is one tap away
  const narrow = useMedia("(max-width: 639px)");
  const chosen = params.get("view");
  const view = chosen === "table" || chosen === "grid" ? chosen : narrow ? "table" : "grid";
  const lens: Lens = params.get("lens") === "defence" ? "defence" : "growth";
  // "" emerging (the default: all but the stages past it), "mature" only those, "all" both
  const stage = params.get("stage") === "mature" ? "mature" : params.get("stage") === "all" ? "all" : "";
  const [loaded, setLoaded] = useState<{ fabric: string; data: Frontier } | null>(null);
  const [error, setError] = useState<unknown>(null);

  useEffect(() => {
    let live = true; // a late answer for a fabric no longer chosen is dropped
    fetchJson<Frontier>(`/api/frontier${fabric ? `?fabric=${encodeURIComponent(fabric)}` : ""}`)
      .then((data) => { if (live) { setLoaded({ fabric, data }); setError(null); } })
      .catch((e) => { if (live) setError(e); });
    return () => { live = false; };
  }, [fabric]);

  // the address with one choice changed, the others kept
  const href = (key: "fabric" | "view" | "stage" | "lens", value: string) => {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    next.delete("at"); // another choice starts the table at its first rows
    const q = next.toString();
    return q ? `${path}?${q}` : path;
  };

  const raw = loaded?.data;
  const data = raw && raw.edition ? (raw as Published) : null;
  const unpublished = raw != null && raw.edition == null;
  const stale = loaded != null && loaded.fabric !== fabric; // the next fabric is on its way
  const shown = loaded?.fabric ?? fabric; // the fabric the data on screen is for
  const inStage = (i: Item) => stage === "all" || (stage === "mature") === pastEmerging(i);
  const staged = useMemo(() => (data?.placed ?? []).filter(inStage), [data, stage]); // eslint-disable-line react-hooks/exhaustive-deps
  // in Defence, a placement without Tata's Disruption threat entry has no height: it waits, with why
  // (kept the same between renders, so the grid's layout isn't worked out again)
  const placed = useMemo(() => (lens === "defence" ? staged.filter((i) => i.threat != null) : staged), [staged, lens]);
  const held = [...(data?.held ?? []).filter(inStage),
    ...(lens === "defence" ? staged.filter((i) => i.threat == null).map((i) => ({ ...i, reason: i.threat_missing ?? "Disruption threat not entered by Tata yet" })) : [])];
  const past = new Set([...(data?.placed ?? []), ...(data?.held ?? [])].filter(pastEmerging).map((i) => i.tech_id)).size;
  const pastName = data?.stages.filter((s) => s.known && !s.emerging).map((s) => s.name).join(", ") || "Mature";
  const fabricName = data?.fabrics.find((f) => f.id === shown)?.name ?? shown;
  const [soonLo, soonHi] = data?.cutpoints.how_soon ?? [4, 7];
  const [bigLo, bigHi] = data?.cutpoints.how_big ?? [4, 7];
  const techs = new Set(placed.map((p) => p.tech_id)).size;
  const band = data?.near_band ?? 0.5;
  const frontier = useMemo(() => frontierOf(placed, lens, band), [placed, lens, band]); // compares every pair of dots
  const onList = placed.filter((i) => frontier.on.has(i))
    .sort((a, b) => (b.how_soon ?? 0) - (a.how_soon ?? 0) || (upOf(b, lens) ?? 0) - (upOf(a, lens) ?? 0));
  const nearList = placed.filter((i) => frontier.near.has(i));
  const since = data?.edition.previous?.label;
  const withFabric = !shown;

  return (
    <div>
      <PageHeader title="Technology priorities"
        intro="Where each emerging technology stands for Tata Communications: how soon it arrives (across), how big the prize is (up), and its priority (colour)."
        help={<>
          <li>This is an edition: every dot and Point of View as they stood when Tata&apos;s radar team published it.
            The radar keeps working after that; this screen changes only at the next edition.</li>
          <li>Each dot is one technology in one fabric, the business line it&apos;s judged for. A technology that
            matters to several fabrics has a dot in each.</li>
          <li>Across is how soon it arrives at scale, 0 to 10: further right is sooner. Up is how big the prize is for
            Tata Communications, 0 to 10; View by &ldquo;{LENS_WORDS.defence.name}&rdquo; makes up the Disruption
            threat Tata enters instead.</li>
          <li>Colour is the priority, from P1 act now (darkest) to P6 just watch (lightest). A ring means a person set
            it; an arrow means it moved since the edition before.</li>
          <li>The corners: Act (sooner and bigger, past both solid lines: exactly the P1 dots), Plan (bigger, but
            later), Wait (sooner, but smaller) and Watch (the rest). The solid lines sit at {soonHi} across and {bigHi}{" "}
            up; the dotted ones at {soonLo}{bigLo !== soonLo ? ` across and ${bigLo} up` : ""} mark where the priority
            changes again. The blue line marks the best bets now; the hatched band, within {band} of it, those close
            behind.</li>
          <li>Click a dot, or Read in the table, for its Point of View in this edition: what Tata Communications should
            do, and why.</li>
        </>}>
        {data && (
          <p className="mt-2 text-sm text-ink">
            {data.edition.name ? <><b className="font-semibold">Edition {data.edition.name}</b> · published </> : "Published "}
            {formatAt(data.edition.published_at, data.edition.tz)}
            <a href="/frontier/pack" target="_blank" rel="noreferrer"
              className="ml-3 rounded-full border border-line bg-white px-2.5 py-1 text-xs hover:bg-neutral-100 print:hidden">
              Edition pack (PDF)
            </a>
          </p>
        )}
        {data && !stale && (
          <p className="mt-1 text-sm text-neutral-600">
            {placed.length > 0
              ? `${plural(placed.length, "dot")} on the grid (${plural(techs, "technology", "technologies")}${fabric ? ` in ${fabricName}` : ""}; one dot per technology per fabric) · ${held.length.toLocaleString()} not placed yet`
              : `${held.length.toLocaleString()} not placed yet`}
            {stage === "" && past > 0 && ` · ${plural(past, "technology", "technologies")} at ${pastName} left out`}
          </p>
        )}
      </PageHeader>

      {error != null && <BackendError error={error} />}

      {unpublished && (
        <div className={`mt-6 ${card} py-6 text-sm text-neutral-700`}>
          <p className="font-semibold text-ink">Nothing is published yet.</p>
          <p className="mt-1 max-w-3xl">
            This view shows an edition: every placement and Point of View as they stood when Tata Communications&apos;
            radar team published it. Once the first edition is published, it shows here.
          </p>
        </div>
      )}

      {data && (
        <div className={`mt-6 ${stale ? "opacity-50" : ""}`}>
          <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
            <nav aria-label="Fabric" className="flex flex-wrap gap-1.5">
              <Link href={href("fabric", "")} scroll={false} className={pill(!fabric)}
                aria-current={!fabric ? "page" : undefined}>All</Link>
              {data.fabrics.map((f) => (
                <Link key={f.id} href={href("fabric", f.id)} scroll={false} className={pill(fabric === f.id)}
                  aria-current={fabric === f.id ? "page" : undefined}>{f.name}</Link>
              ))}
            </nav>
            <div className="flex flex-wrap gap-2">
              {([
                ["View by", "lens", lens === "defence" ? "defence" : "", [["", LENS_WORDS.growth.name], ["defence", LENS_WORDS.defence.name]],
                  "Up is how big the prize is, or the Disruption threat Tata enters (the threat to existing revenue if Tata does nothing); a dot without Tata's entry waits under Not placed yet"],
                ["Stage", "stage", stage, [["", "Emerging"], ["mature", pastName], ["all", "All stages"]],
                  `How far a technology is on the market: Research, Pilot, Early commercial or ${pastName}. Emerging shows every stage but ${pastName}, including those not judged yet`],
                ["Show as", "view", view, [["grid", "Grid"], ["table", "Table"]],
                  "The table lists the same dots, most urgent first"],
              ] as const).map(([label, key, current, options, hint]) => (
                <nav key={key} aria-label={label} title={hint} className="flex items-center rounded-full border border-line bg-white p-0.5 text-sm">
                  <span className="px-2 text-xs text-muted">{label}</span>
                  {options.map(([v, name]) => (
                    <Link key={v} href={href(key, v)} scroll={false} aria-current={current === v ? "page" : undefined}
                      className={`rounded-full px-3.5 py-1 ${current === v ? "bg-navy text-white" : "text-ink hover:bg-ground"}`}>
                      {name}
                    </Link>
                  ))}
                </nav>
              ))}
            </div>
          </div>

          <div className="mt-4">
            {placed.length === 0 ? (
              <p className="rounded-card border border-line bg-white px-5 py-6 text-sm text-neutral-600">
                {lens === "defence" && staged.length > 0
                  ? `Nothing here has a Disruption threat entered by Tata yet, so this view has nothing to place: see Not placed yet below, or view by ${LENS_WORDS.growth.name}.`
                  : stage === "mature"
                    ? `Nothing at ${pastName}${shown ? ` in ${fabricName}` : ""} is placed.`
                    : `Nothing is placed${shown ? ` in ${fabricName}` : ""} in this edition.`}
              </p>
            ) : view === "table" ? (
              <Table items={placed} from={here} lens={lens} frontier={frontier} since={since} />
            ) : (
              <Grid key={`${shown}:${stage}:${lens}`} items={placed} cutpoints={data.cutpoints} withFabric={withFabric}
                from={here} lens={lens} frontier={{ ...frontier, band }} since={since} />
            )}
          </div>

          <div className="mt-6 grid grid-cols-1 items-start gap-4 lg:grid-cols-2 2xl:grid-cols-4">
            <ActNow items={placed.filter((i) => i.priority === "P1")} lens={lens} from={here} withFabric={withFabric} />
            <OnTheFrontier on={onList} near={nearList} lens={lens} from={here} withFabric={withFabric} />
            <MovedSince moved={placed.filter((i) => i.moved)} previous={data.edition.previous} from={here} withFabric={withFabric} />
            <Committed items={placed} />
          </div>

          <NotPlaced held={held} from={here} withFabric={withFabric} lens={lens} />

          <div className="mt-10 grid grid-cols-1 items-start gap-4 lg:grid-cols-2">
            <Assumptions items={data.assumptions} />
            <EvidenceThisEdition ev={data.evidence} assessed={data.edition.counts.technologies} />
          </div>
        </div>
      )}
      {!raw && error == null && <p className="mt-6 text-sm text-muted">Loading…</p>}
    </div>
  );
}

export default function FrontierPage() {
  return (
    <Suspense fallback={null}>
      <FrontierView />
    </Suspense>
  );
}
