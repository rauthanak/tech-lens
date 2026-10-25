"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import FabricLabel from "@/components/FabricLabel";
import {
  HORIZON_WORDS, isPale, type Item, type Lens, LENS_WORDS, leaderName, leaderText, measuresNote, moveReason, moveText,
  overrideNote, povHref, priorityFill, upOf,
} from "@/components/frontier/items";
import { formatScore } from "@/lib/scoring";
import { PRIORITY } from "@/lib/theme";

/** Zoom `k` (1 = the whole grid) and pan `x`, `y`, as fractions of the plot's
 *  width and height: kept in fractions, a resize doesn't move the view. */
type View = { k: number; x: number; y: number };
type Box = { x0: number; y0: number; x1: number; y1: number };

const HOME: View = { k: 1, x: 0, y: 0 };
const MAX_ZOOM = 8;
const STEP = 1.6; // one press of + or −
const M = { top: 10, right: 12, bottom: 46, left: 46 }; // room for the axes
const D0 = -0.4, D1 = 10.4; // the drawn range: a dot at 0 or 10 stays inside the frame
const R = 5.5; // dot radius, the same at every zoom
const SPREAD = 10; // spacing of dots that share one point
const FONT = 11;
const CHAR = 0.6 * FONT; // a label's width per character, rounded up for the brand font
const MAX_NAME = 30;

// the four corners, named by where they sit: left is later, top is bigger (or more threat)
const QUADRANTS = [
  { name: "Plan", left: true, top: true, tint: 0.035 },
  { name: "Act", left: false, top: true, tint: 0.075 },
  { name: "Watch", left: true, top: false, tint: 0 },
  { name: "Wait", left: false, top: false, tint: 0.035 },
] as const;

/** Moved to a more urgent priority (P3 → P2) or a less urgent one. */
const movedUp = (item: Item) => !!item.moved?.from && !!item.priority && item.priority < item.moved.from;

function clamp(v: View): View {
  const k = Math.min(MAX_ZOOM, Math.max(1, v.k));
  return { k, x: Math.min(0, Math.max(1 - k, v.x)), y: Math.min(0, Math.max(1 - k, v.y)) };
}

/** Zoom to `k`, keeping the point at (fx, fy), as fractions of the plot, where it is. */
function zoomAt(v: View, k: number, fx: number, fy: number): View {
  const next = Math.min(MAX_ZOOM, Math.max(1, k));
  return clamp({ k: next, x: fx - ((fx - v.x) * next) / v.k, y: fy - ((fy - v.y) * next) / v.k });
}

const overlaps = (a: Box, b: Box) => a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;
const inside = (a: Box, b: Box) => a.x0 >= b.x0 && a.x1 <= b.x1 && a.y0 >= b.y0 && a.y1 <= b.y1;

type Dot = { item: Item; i: number; cx: number; cy: number };
type Row = { text: string; priority: string | null; ring: boolean; more?: boolean };
type Block = { key: string; x0: number; y0: number; swatch: boolean; rows: Row[]; leader: number[] | null };

const LINE = 14; // a name's line height

/** Names for the dots in view, point by point, most urgent first. Dots
 *  sharing a point are named together: one line per technology (its fabrics
 *  joined), each with its priority's colour, so which is which needs no
 *  pointing. A block takes the first free spot beside its dots (right, left,
 *  above, below) that crosses no dot, name or corner label, else one a
 *  little further out, joined to them by a thin line; with none, it tries
 *  one name and "+N more"; with no room at all it's left out, and the dots
 *  still show their names on hover. Returns the blocks and how many dots
 *  they name. */
function placeNames(dots: Dot[], obstacles: Box[], plot: Box, withFabric: boolean, lens: Lens): { blocks: Block[]; named: number } {
  const points = new Map<string, Dot[]>();
  for (const d of dots) {
    const key = `${d.item.how_soon}|${upOf(d.item, lens)}`;
    points.set(key, [...(points.get(key) ?? []), d]);
  }
  const taken: Box[] = [];
  const blocks: Block[] = [];
  let named = 0;
  for (const [key, group] of points) {
    const lines: { tech: string; name: string; fabrics: string[]; priority: string | null; ring: boolean; count: number }[] = [];
    for (const { item } of group) {
      const same = lines.find((l) => l.tech === item.tech_id && l.priority === item.priority && l.ring === item.override);
      if (same) { same.fabrics.push(item.fabric); same.count++; }
      else lines.push({ tech: item.tech_id, name: item.name, fabrics: [item.fabric], priority: item.priority,
        ring: item.override, count: 1 });
    }
    const text = (l: (typeof lines)[number]) => {
      const name = l.name.length > MAX_NAME ? `${l.name.slice(0, MAX_NAME - 1).trimEnd()}…` : l.name;
      return withFabric ? `${name} · ${l.fabrics.join(", ")}` : name;
    };
    const edge = group.map((d) => R + (d.item.override ? 3.5 : 0));
    const bx0 = Math.min(...group.map((d, j) => d.cx - edge[j])), bx1 = Math.max(...group.map((d, j) => d.cx + edge[j]));
    const by0 = Math.min(...group.map((d, j) => d.cy - edge[j])), by1 = Math.max(...group.map((d, j) => d.cy + edge[j]));
    for (const m of lines.length > 1 ? [lines.length, 1] : [1]) {
      const more = lines.slice(m).reduce((n, l) => n + l.count, 0);
      const rows: Row[] = [
        ...lines.slice(0, m).map((l) => ({ text: text(l), priority: l.priority, ring: l.ring })),
        ...(more ? [{ text: `+${more} more here`, priority: null, ring: false, more: true }] : []),
      ];
      const swatch = rows.length > 1;
      const w = Math.max(...rows.map((r) => r.text.length * CHAR)) + (swatch ? 10 : 0), h = rows.length * LINE;
      const midX = (bx0 + bx1) / 2, midY = (by0 + by1) / 2;
      // beside the dots first (d = 0), then a step further out each time
      const spot = [0, 1, 2, 3, 4].flatMap((n) => {
        const d = n * LINE * 1.25;
        return [
          { x0: bx1 + 3 + (n && 8), y0: midY - h / 2 - d },
          { x0: bx0 - 3 - w - (n && 8), y0: midY - h / 2 - d },
          { x0: midX - w / 2, y0: by0 - 2 - h - d },
          { x0: bx1 - w, y0: by0 - 2 - h - d }, // above, for dots near the right edge
          { x0: bx0, y0: by0 - 2 - h - d }, // above, near the left edge
          { x0: midX - w / 2, y0: by1 + 2 + d },
          ...(n ? [{ x0: bx1 + 11, y0: midY - h / 2 + d }, { x0: bx0 - 11 - w, y0: midY - h / 2 + d }] : []),
        ];
      }).map((b) => ({ ...b, x1: b.x0 + w, y1: b.y0 + h }))
        .find((b) => inside(b, plot) && !obstacles.some((o) => overlaps(b, o)) && !taken.some((t) => overlaps(b, t)));
      if (!spot) continue;
      taken.push(spot);
      // a block set apart from its dots gets a line to them, edge to edge
      const near = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
      const from = [near((spot.x0 + spot.x1) / 2, bx0, bx1), near((spot.y0 + spot.y1) / 2, by0, by1)];
      const to = [near(from[0], spot.x0, spot.x1), near(from[1], spot.y0, spot.y1)];
      const leader = Math.hypot(to[0] - from[0], to[1] - from[1]) > 6 ? [...from, ...to] : null;
      blocks.push({ key, x0: spot.x0, y0: spot.y0, swatch, rows, leader });
      named += lines.slice(0, m).reduce((n, l) => n + l.count, 0);
      break;
    }
  }
  return { blocks, named };
}

const score = (n: number | null) => (n == null ? "no score" : `${formatScore(n)} out of 10`);

/** The 2×2: across, how soon (right is sooner); up, how big (top is bigger),
 *  or in the Defence lens the Disruption threat, both 0–10. One dot per placed
 *  item, coloured by its priority; a ring when a person set it, an arrow when
 *  its priority moved since the edition before. The frontier is a stepped
 *  line through the dots nothing beats on both axes, with a hatched band for
 *  those near it. Wheel or + − zoom, drag moves, ⌂ shows it all; clicking a
 *  dot opens its Point of View. */
export default function Grid({ items, cutpoints, withFabric, from, lens, frontier, since }: {
  items: Item[];
  cutpoints: { how_soon: [number, number]; how_big: [number, number] };
  withFabric: boolean;
  from: string; // the address a Point of View comes back to
  lens: Lens;
  frontier: { on: Set<Item>; near: Set<Item>; band: number };
  since?: string; // the edition before, for "moved since"
}) {
  const words = LENS_WORDS[lens];
  const router = useRouter();
  const box = useRef<HTMLDivElement>(null);
  const svg = useRef<SVGSVGElement>(null);
  const [width, setWidth] = useState(0);
  const [view, setView] = useState<View>(HOME);
  const [hover, setHover] = useState<number | null>(null);
  const [dragging, setDragging] = useState(false);
  const drag = useRef<{ id: number; cx: number; cy: number; x: number; y: number; moved: boolean } | null>(null);
  const dragged = useRef(false); // the last press moved the grid, so it wasn't a click on a dot
  const viewNow = useRef(view); // for the wheel listener, which outlives renders
  useEffect(() => { viewNow.current = view; }, [view]);

  // the drawing is sized to its box, so it scales with the page
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => setWidth(Math.floor(entry.contentRect.width)));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const height = Math.round(Math.min(720, Math.max(340, width * 0.58)));
  const pw = Math.max(1, width - M.left - M.right);
  const ph = height - M.top - M.bottom;

  // the wheel zooms about the pointer; fully out, scrolling further out
  // scrolls the page instead. Listened to directly: React's is passive.
  useEffect(() => {
    const el = svg.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      const delta = e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 400 : 1);
      if (delta === 0 || (delta > 0 && viewNow.current.k <= 1)) return;
      e.preventDefault();
      const r = el.getBoundingClientRect();
      const fx = (e.clientX - r.left - M.left) / pw, fy = (e.clientY - r.top - M.top) / ph;
      setView((v) => zoomAt(v, v.k * Math.exp(-delta * 0.0015), fx, fy));
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [pw, ph]);

  // dots that share a point sit in a small sunflower around it, the first
  // (the most urgent: the list comes in priority order) at its centre
  const offsets = useMemo(() => {
    const groups = new Map<string, number[]>();
    items.forEach((item, i) => {
      const key = `${item.how_soon}|${upOf(item, lens)}`;
      groups.set(key, [...(groups.get(key) ?? []), i]);
    });
    const out: [number, number][] = items.map(() => [0, 0]);
    for (const group of groups.values())
      group.forEach((i, j) => {
        const r = SPREAD * Math.sqrt(j), a = j * 2.39996; // the golden angle
        out[i] = [r * Math.cos(a), r * Math.sin(a)];
      });
    return out;
  }, [items, lens]);

  const zoomBy = (factor: number) => setView((v) => zoomAt(v, v.k * factor, 0.5, 0.5));

  function open(item: Item) {
    if (dragged.current) return;
    const href = povHref(item, from);
    if (href) router.push(href);
  }

  function onPointerDown(e: React.PointerEvent<SVGSVGElement>) {
    if (e.button !== 0) return;
    dragged.current = false;
    drag.current = { id: e.pointerId, cx: e.clientX, cy: e.clientY, x: view.x, y: view.y, moved: false };
  }
  function onPointerMove(e: React.PointerEvent<SVGSVGElement>) {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    const dx = e.clientX - d.cx, dy = e.clientY - d.cy;
    if (!d.moved) {
      if (Math.hypot(dx, dy) < 4) return; // a click, so far
      d.moved = true;
      e.currentTarget.setPointerCapture(e.pointerId);
      setDragging(true);
      setHover(null);
    }
    setView((v) => clamp({ k: v.k, x: d.x + dx / pw, y: d.y + dy / ph }));
  }
  function onPointerUp(e: React.PointerEvent<SVGSVGElement>) {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    dragged.current = d.moved;
    drag.current = null;
    setDragging(false);
  }

  const sx = (v: number) => M.left + pw * (view.x + (view.k * (v - D0)) / (D1 - D0));
  const sy = (v: number) => M.top + ph * (view.y + (view.k * (D1 - v)) / (D1 - D0));
  const plot: Box = { x0: M.left, y0: M.top, x1: M.left + pw, y1: M.top + ph };
  // the corners split on the upper band edges: Act is exactly the top priority's cell
  const midSoon = cutpoints.how_soon[1];
  const midBig = cutpoints.how_big[1];

  // corners, dots and where each name goes: worked out again only when the grid changes
  // (its dots, zoom, size or what's up), not on every hover
  const { quadrants, dots, blocks, named } = useMemo(() => {
    const quadrants = QUADRANTS.map((q0) => {
      const q = { ...q0, sub: `${q0.left ? "later" : "sooner"} · ${(q0.top ? words.more : words.less).toLowerCase()}` };
      const [x0, x1] = q.left ? [sx(D0), sx(midSoon)] : [sx(midSoon), sx(D1)];
      const [y0, y1] = q.top ? [sy(D1), sy(midBig)] : [sy(midBig), sy(D0)];
      const seen = { x0: Math.max(plot.x0, x0), x1: Math.min(plot.x1, x1), y0: Math.max(plot.y0, y0), y1: Math.min(plot.y1, y1) };
      // the name goes in the quadrant's outer corner, while enough of it shows
      const shown = seen.x1 - seen.x0 >= 96 && seen.y1 - seen.y0 >= 44;
      const tx = q.left ? seen.x0 + 10 : seen.x1 - 10;
      const ty = q.top ? seen.y0 + 19 : seen.y1 - 22;
      const w = Math.max(q.name.length * 9, q.sub.length * 6.2);
      const label: Box = { x0: q.left ? tx : tx - w, x1: q.left ? tx + w : tx, y0: ty - 14, y1: ty + 18 };
      return { ...q, x0, x1, y0, y1, shown, tx, ty, label };
    });

    const dots: Dot[] = items
      .map((item, i) => ({ item, i, cx: sx(item.how_soon ?? 0) + offsets[i][0], cy: sy(upOf(item, lens) ?? 0) + offsets[i][1] }))
      .filter((d) => d.cx > plot.x0 - R && d.cx < plot.x1 + R && d.cy > plot.y0 - R && d.cy < plot.y1 + R);

    const obstacles: Box[] = [
      ...quadrants.filter((q) => q.shown).map((q) => q.label),
      ...dots.map((d) => ({ x0: d.cx - R - 1, x1: d.cx + R + 1, y0: d.cy - R - 1, y1: d.cy + R + 1 })),
    ];
    const { blocks, named } = width > 0 ? placeNames(dots, obstacles, plot, withFabric, lens) : { blocks: [], named: 0 };
    return { quadrants, dots, blocks, named };
  }, [items, offsets, view, width, lens, withFabric, cutpoints]); // eslint-disable-line react-hooks/exhaustive-deps

  // the frontier, sooner to later: a stepped line through its dots, and the band
  // between it and the same line moved back by the band's width on both axes
  const steps = [...frontier.on].map((i) => [i.how_soon ?? 0, upOf(i, lens) ?? 0] as const)
    .sort((a, b) => a[0] - b[0] || b[1] - a[1])
    .filter((p, k, all) => k === 0 || p[0] !== all[k - 1][0] || p[1] !== all[k - 1][1]);
  const stair = (w: number) => {
    const at = (v: number) => Math.max(D0, v - w);
    return [[D0, at(steps[0][1])], ...steps.flatMap(([x, y], k) => [
      ...(k ? [[at(steps[k - 1][0]), at(y)]] : []), [at(x), at(y)]]), [at(steps[steps.length - 1][0]), D0]];
  };
  const band = steps.length ? [...stair(0), ...stair(frontier.band).reverse()] : [];
  const line = steps.flatMap(([x, y], k) => [...(k ? [[steps[k - 1][0], y]] : []), [x, y]]);
  const pts = (ps: number[][]) => ps.map(([x, y]) => `${sx(x)},${sy(y)}`).join(" ");
  const anyMoved = items.some((i) => i.moved);
  const unnamed = dots.length - named;

  const step = view.k >= 3 ? 0.5 : 1;
  const ticks = Array.from({ length: Math.round(10 / step) + 1 }, (_, n) => n * step);
  const tip = hover == null ? undefined : dots.find((d) => d.i === hover);
  const mid = (a: number, b: number) => (a + b) / 2;
  const button = "flex h-8 w-8 items-center justify-center rounded-full border border-line bg-white text-base leading-none text-ink hover:bg-ground disabled:opacity-40 disabled:hover:bg-white";

  return (
    <div className="rounded-card border border-line bg-white p-3 sm:p-4">
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-muted">
          <span className="flex items-center gap-1">
            <span className="mr-1">Priority: act now</span>
            {Object.keys(PRIORITY).map((p) => (
              <span key={p} className={`px-1 py-0.5 font-mono text-[11px] ${PRIORITY[p]}`}>{p}</span>
            ))}
            <span className="ml-1">just watch</span>
          </span>
          <span className="flex items-center gap-1.5">
            <svg width="18" height="18" aria-hidden>
              <circle cx="9" cy="9" r={R + 3} fill="none" stroke="var(--color-azure)" strokeWidth="1.75" />
              <circle cx="9" cy="9" r={R} style={{ fill: priorityFill("P3") }} />
            </svg>
            Ring: priority set by a person
          </span>
          <span className="flex items-center gap-1.5">
            <svg width="26" height="14" aria-hidden>
              {/* the band's hatching, defined here (always drawn) for the grid too */}
              <defs>
                <pattern id="frontier-hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                  <line x1="0" y1="0" x2="0" y2="6" stroke="var(--color-azure)" strokeWidth="1.5" strokeOpacity="0.4" />
                </pattern>
              </defs>
              <rect x="0" y="2" width="26" height="10" fill="url(#frontier-hatch)" />
              <path d="M1 4 H13 V10 H25" fill="none" stroke="var(--color-azure)" strokeWidth="2" />
            </svg>
            The frontier: best bets now; hatched: close behind
          </span>
          {anyMoved && (
            <span className="flex items-center gap-1.5">
              <svg width="18" height="14" aria-hidden>
                <path d="M4 2 l3.5 5 h-7 z M14 12 l3.5 -5 h-7 z" fill="var(--color-ink)" />
              </svg>
              Priority moved{since ? ` since ${since}` : ""}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <span className="mr-1 hidden text-xs text-muted sm:inline">Scroll to zoom, drag to move</span>
          <button type="button" className={button} onClick={() => zoomBy(STEP)} disabled={view.k >= MAX_ZOOM}
            aria-label="Zoom in" title="Zoom in">+</button>
          <button type="button" className={button} onClick={() => zoomBy(1 / STEP)} disabled={view.k <= 1}
            aria-label="Zoom out" title="Zoom out">−</button>
          <button type="button" className={button} onClick={() => setView(HOME)} disabled={view.k <= 1}
            aria-label="Show the whole grid" title="Show the whole grid">⌂</button>
        </div>
      </div>

      <div ref={box} className="relative mt-3">
        <svg ref={svg} width={width} height={width > 0 ? height : 340} role="group"
          aria-label="Technologies by how soon they arrive and how big the prize is"
          className={`block select-none ${dragging ? "cursor-grabbing" : view.k > 1 ? "cursor-grab" : ""}`}
          style={{ touchAction: view.k > 1 ? "none" : "auto" }}
          onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp} onPointerLeave={() => setHover(null)}>
          {width > 0 && (
            <>
              <defs>
                <clipPath id="frontier-plot">
                  <rect x={plot.x0} y={plot.y0} width={pw} height={ph} />
                </clipPath>
              </defs>

              <g clipPath="url(#frontier-plot)">
                {quadrants.map((q) => q.tint > 0 && (
                  <rect key={q.name} x={q.x0} y={q.y0} width={q.x1 - q.x0} height={q.y1 - q.y0}
                    fill="var(--color-navy)" fillOpacity={q.tint} />
                ))}
                {/* the band edges, where the priority changes */}
                {cutpoints.how_soon.map((v) => (
                  <line key={`s${v}`} x1={sx(v)} x2={sx(v)} y1={plot.y0} y2={plot.y1}
                    stroke="var(--color-faint)" strokeDasharray="2 4" />
                ))}
                {cutpoints.how_big.map((v) => (
                  <line key={`b${v}`} x1={plot.x0} x2={plot.x1} y1={sy(v)} y2={sy(v)}
                    stroke="var(--color-faint)" strokeDasharray="2 4" />
                ))}
                {/* the corners, split on the upper band edges (drawn solid) */}
                <line x1={sx(midSoon)} x2={sx(midSoon)} y1={plot.y0} y2={plot.y1} stroke="var(--color-faint)" />
                <line x1={plot.x0} x2={plot.x1} y1={sy(midBig)} y2={sy(midBig)} stroke="var(--color-faint)" />

                {quadrants.filter((q) => q.shown).map((q) => (
                  <text key={q.name} x={q.tx} y={q.ty} textAnchor={q.left ? "start" : "end"} className="pointer-events-none">
                    <tspan fontSize={13} fontWeight={600} letterSpacing="0.08em" fill="var(--color-navy)"
                      fillOpacity={0.7}>{q.name.toUpperCase()}</tspan>
                    <tspan x={q.tx} dy={14} fontSize={10.5} fill="var(--color-muted)">{q.sub}</tspan>
                  </text>
                ))}

                {/* the frontier and the band near it, under the dots */}
                {band.length > 0 && (
                  <polygon points={pts(band)} fill="url(#frontier-hatch)" className="pointer-events-none" />
                )}
                {line.length > 1 && (
                  <polyline points={pts(line)} fill="none" stroke="var(--color-azure)" strokeWidth={2}
                    strokeLinejoin="round" className="pointer-events-none" />
                )}

                {dots.map(({ item, i, cx, cy }) => (
                  <g key={`${item.tech_id}:${item.fabric_id}:${i}`} role="link" tabIndex={0}
                    aria-label={`${item.name}, ${item.fabric}: priority ${item.priority}${item.override ? ", set by a person" : ""}${item.moved ? `, ${moveText(item, since)}` : ""}; how soon ${score(item.how_soon)}; ${words.up.toLowerCase()} ${score(upOf(item, lens))}${frontier.on.has(item) ? "; a best bet now" : ""}${item.pov ? "; opens its Point of View" : ""}`}
                    className={`outline-none ${item.pov ? "cursor-pointer" : ""}`}
                    onPointerEnter={() => { if (!drag.current?.moved) setHover(i); }}
                    onPointerLeave={() => setHover((h) => (h === i ? null : h))}
                    onFocus={() => setHover(i)} onBlur={() => setHover(null)}
                    onClick={() => open(item)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); dragged.current = false; open(item); }
                    }}>
                    {item.override && (
                      <circle cx={cx} cy={cy} r={R + 3.5} fill="none" stroke="var(--color-azure)" strokeWidth={1.75} />
                    )}
                    <circle cx={cx} cy={cy} r={R} style={{ fill: priorityFill(item.priority) }}
                      stroke={isPale(item.priority) ? "#3f5f99" : "#fff"} strokeOpacity={isPale(item.priority) ? 0.6 : 1}
                      strokeWidth={1.25} />
                    {item.moved && (
                      <path d={movedUp(item) ? `M${cx + R + 4} ${cy - R - 5} l3.5 5 h-7 z` : `M${cx + R + 4} ${cy - R} l3.5 -5 h-7 z`}
                        fill="var(--color-ink)" stroke="#fff" strokeWidth={0.75} />
                    )}
                  </g>
                ))}

                <g className="pointer-events-none" stroke="var(--color-faint)">
                  {blocks.map((b) => b.leader && (
                    <line key={b.key} x1={b.leader[0]} y1={b.leader[1]} x2={b.leader[2]} y2={b.leader[3]} />
                  ))}
                </g>
                <g className="pointer-events-none" fontSize={FONT}>
                  {blocks.map((b) => b.rows.map((row, j) => {
                    const y = b.y0 + LINE * (j + 0.5);
                    return (
                      <g key={`${b.key}:${j}`}>
                        {b.swatch && !row.more && (
                          <circle cx={b.x0 + 3.5} cy={y} r={3.5} style={{ fill: priorityFill(row.priority) }}
                            stroke={row.ring ? "var(--color-azure)" : isPale(row.priority) ? "#3f5f99" : "none"}
                            strokeWidth={row.ring ? 1.5 : 0.75} />
                        )}
                        <text x={b.x0 + (b.swatch ? 10 : 0)} y={y} dominantBaseline="central"
                          fill={row.more ? "var(--color-muted)" : "var(--color-ink)"} stroke="#fff" strokeWidth={3}
                          strokeLinejoin="round" paintOrder="stroke">{row.text}</text>
                      </g>
                    );
                  }))}
                </g>

                {/* the dot under the pointer, drawn again on top */}
                {tip && (
                  <circle cx={tip.cx} cy={tip.cy} r={R + 2} className="pointer-events-none"
                    style={{ fill: priorityFill(tip.item.priority) }} stroke="var(--color-ink)" strokeWidth={1.5} />
                )}
              </g>

              <rect x={plot.x0} y={plot.y0} width={pw} height={ph} fill="none" stroke="var(--color-line)" />

              {/* axes: the numbers in view, then what each way means */}
              <g fontSize={10.5} fill="var(--color-muted)">
                {ticks.map((v) => {
                  const x = sx(v);
                  return x >= plot.x0 - 0.5 && x <= plot.x1 + 0.5 && (
                    <g key={`x${v}`}>
                      <line x1={x} x2={x} y1={plot.y1} y2={plot.y1 + 4} stroke="var(--color-faint)" />
                      <text x={x} y={plot.y1 + 15} textAnchor="middle">{formatScore(v)}</text>
                    </g>
                  );
                })}
                {ticks.map((v) => {
                  const y = sy(v);
                  return y >= plot.y0 - 0.5 && y <= plot.y1 + 0.5 && (
                    <g key={`y${v}`}>
                      <line x1={plot.x0 - 4} x2={plot.x0} y1={y} y2={y} stroke="var(--color-faint)" />
                      <text x={plot.x0 - 7} y={y} textAnchor="end" dominantBaseline="central">{formatScore(v)}</text>
                    </g>
                  );
                })}
              </g>
              <g fontSize={11.5} fill="var(--color-muted)">
                <text x={plot.x0} y={height - 6}>← Later</text>
                <text x={mid(plot.x0, plot.x1)} y={height - 6} textAnchor="middle" fontWeight={600} fill="var(--color-ink)">
                  How soon
                </text>
                <text x={plot.x1} y={height - 6} textAnchor="end">Sooner →</text>
                <text transform={`translate(12 ${plot.y1}) rotate(-90)`}>← {words.less}</text>
                <text transform={`translate(12 ${mid(plot.y0, plot.y1)}) rotate(-90)`} textAnchor="middle" fontWeight={600}
                  fill="var(--color-ink)">{words.up}</text>
                <text transform={`translate(12 ${plot.y0}) rotate(-90)`} textAnchor="end">{words.more} →</text>
              </g>
            </>
          )}
        </svg>

        {tip && !dragging && (
          <div className="pointer-events-none absolute z-10 w-max max-w-[min(18rem,calc(100%-1rem))] rounded-card border border-line bg-white px-3 py-2.5 text-xs leading-relaxed text-neutral-700 shadow-lg"
            style={{
              left: tip.cx < width / 2 ? tip.cx + 14 : tip.cx - 14,
              top: tip.cy < height / 2 ? tip.cy + 10 : tip.cy - 10,
              transform: `translate(${tip.cx < width / 2 ? "0" : "-100%"}, ${tip.cy < height / 2 ? "0" : "-100%"})`,
            }}>
            <div className="text-sm font-semibold text-ink">{tip.item.name}</div>
            <div className="mt-1 flex flex-wrap items-center gap-1.5">
              <FabricLabel id={tip.item.fabric_id} name={tip.item.fabric} />
              {tip.item.priority && (
                <span className={`px-1 py-0.5 font-mono text-[11px] ${PRIORITY[tip.item.priority] ?? "bg-neutral-100"}`}>
                  {tip.item.priority}
                </span>
              )}
              {tip.item.horizon && <span>{HORIZON_WORDS[tip.item.horizon] ?? tip.item.horizon} horizon</span>}
            </div>
            <p className="mt-1">Stage: {tip.item.stage.known ? tip.item.stage.name : "not judged yet"}</p>
            <p className="mt-1.5">
              How soon: {score(tip.item.how_soon)}
              {measuresNote(tip.item.soon_scored) && `, from ${measuresNote(tip.item.soon_scored)}`}
              <br />
              {lens === "defence" ? <>Disruption threat: {score(tip.item.threat)}, entered by Tata</> : <>
                How big: {score(tip.item.how_big)}
                {measuresNote(tip.item.big_scored) && `, from ${measuresNote(tip.item.big_scored)}`}
              </>}
            </p>
            {tip.item.override && (
              <p className="mt-1.5 text-ink">
                Priority set by a person{overrideNote(tip.item)}
              </p>
            )}
            {tip.item.moved && (
              <p className="mt-1.5 text-ink">{moveText(tip.item, since)}: {moveReason(tip.item.moved, tip.item.override)}</p>
            )}
            {(frontier.on.has(tip.item) || frontier.near.has(tip.item)) && (
              <p className="mt-1.5">
                {frontier.on.has(tip.item) ? "Best bet now: nothing else here is both sooner and higher up."
                  : `Close behind: within ${frontier.band} of the best bets on both axes.`}
              </p>
            )}
            <p className="mt-1.5">
              <span className={`mr-1 rounded px-1 py-px text-[11px] ${leaderName(tip.item.leader).chip}`}>
                {leaderName(tip.item.leader).name}
              </span>
              {leaderText(tip.item.leader)}
            </p>
            {tip.item.path_step && <p className="mt-1">Tata&apos;s step: {tip.item.path_step}</p>}
            {tip.item.pov?.headline && (
              <p className="mt-1.5 border-l-2 border-navy/30 pl-2 text-neutral-800">{tip.item.pov.headline}</p>
            )}
            <p className={`mt-1.5 ${tip.item.pov ? "text-link" : "text-muted"}`}>
              {tip.item.pov ? "Click to read its Point of View" : "No Point of View written yet"}
            </p>
          </div>
        )}
      </div>

      {width > 0 && unnamed > 0 && (
        <p className="mt-2 text-xs text-muted">
          {unnamed === 1 ? "1 name doesn't" : `${unnamed} names don't`} fit at this zoom: zoom in, or point at a dot
          to see what it is.
        </p>
      )}
    </div>
  );
}
