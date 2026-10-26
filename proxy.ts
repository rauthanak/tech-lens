import { NextResponse, type NextRequest } from "next/server";

// One address for everyone. Signing in (/sign-in) sets the radar_session
// cookie, "<role>.<token>". The role in front only picks where a person lands:
// an admin on the portal (/admin), a leader on the leaders' view (/frontier),
// and a leader asking for an admin page sees /no-access. The API checks every
// call itself (tech-atlas services/auth.guard), so a changed cookie opens
// nothing; admins may open the leaders' view to see it as leaders do.
//
// Proxy runs after next.config's redirects and before its /api rewrite to the
// backend: API calls pass straight on, and the API decides.

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const under = (prefix: string) => pathname === prefix || pathname.startsWith(prefix + "/");
  const to = (path: string) => new URL(path, request.url);

  if (under("/api") || under("/sign-in")) return NextResponse.next();
  const session = request.cookies.get("radar_session")?.value;
  if (!session) return NextResponse.redirect(to(`/sign-in?next=${encodeURIComponent(pathname + search)}`));
  const role = session.split(".", 1)[0];
  if (pathname === "/") return NextResponse.redirect(to(role === "leader" ? "/frontier" : "/admin"));
  if (role === "leader" && under("/admin")) return NextResponse.rewrite(to("/no-access"));
  return NextResponse.next();
}

export const config = {
  // every /api path (even one ending in .png), then everything but the
  // build's static files, image optimisation and the icon
  matcher: ["/api/:path*", "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpe?g|gif|svg|webp|ico)$).*)"],
};
