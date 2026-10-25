import { NextResponse, type NextRequest } from "next/server";

// One portal, two addresses. APP_SIDE (read on every request, so the same
// build serves both) picks the side: "admin" (the default) is the analysts'
// portal under /admin; "frontier" is the read-only executive view under
// /frontier, which can reach only the reads it shows.
//
// Proxy runs after next.config's redirects and before its /api rewrite to the
// backend, so a refused API call never reaches tech-atlas. "/" is decided here,
// not in next.config, so each address opens on its own side in one step.

/** The only API calls the executive address passes on, all GET: the grid,
 *  a Point of View (with what it shows beside its text), and for its value
 *  levers in full each fabric's latest assessment and the levers' names. */
const FRONTIER_READS = [
  /^\/api\/frontier$/,
  /^\/api\/frontier\/pov\/[\w.~-]+$/, // a Point of View as the published edition holds it
  /^\/api\/scoring\/runs\/[\w.~-]+\/pov\/[\w.~-]+$/,
  /^\/api\/technologies\/[\w.~-]+\/assessment$/,
  /^\/api\/scoring\/fabrics$/,
  /^\/api\/lists\/mechanisms$/,
  /^\/api\/technologies\/labels$/,
];

/** The one write it passes on: a leader opened or printed a Point of View, counted. */
const FRONTIER_WRITE = /^\/api\/frontier\/pov\/[\w.~-]+\/seen$/;

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const under = (prefix: string) => pathname === prefix || pathname.startsWith(prefix + "/");
  const to = (path: string) => new URL(path, request.url);

  if (process.env.APP_SIDE === "frontier") {
    if (under("/api")) {
      if (request.method === "GET" && FRONTIER_READS.some((r) => r.test(pathname))) return NextResponse.next();
      if (request.method === "POST" && FRONTIER_WRITE.test(pathname)) return NextResponse.next();
      return NextResponse.json({ detail: "Not available on the executive address" }, { status: 403 });
    }
    if (pathname === "/") return NextResponse.rewrite(to("/frontier"));
    if (under("/admin")) return NextResponse.redirect(to("/frontier"));
    return NextResponse.next();
  }

  if (pathname === "/" || under("/frontier")) return NextResponse.redirect(to("/admin"));
  return NextResponse.next();
}

export const config = {
  // everything but the build's static files, image optimisation and the icon
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpe?g|gif|svg|webp|ico)$).*)"],
};
