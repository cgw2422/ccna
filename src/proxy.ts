import { NextResponse, type NextRequest } from "next/server";

// Lightweight gate: redirect to /login when there is no session cookie.
// Real session validation happens server-side in requireUser()/getApiUser().
const PUBLIC = ["/login", "/register", "/api/health", "/offline"];

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (PUBLIC.some((p) => pathname === p || pathname.startsWith(`${p}/`))) return NextResponse.next();
  if (req.cookies.has("ccna_session")) return NextResponse.next();
  if (pathname.startsWith("/api/")) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.search = "";
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!_next/|icons/|sw.js|manifest.webmanifest|favicon.ico|robots.txt).*)"],
};
