import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const LANDING_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

/** Routes that are always public — no session required. */
const PUBLIC_PATHS = ["/auth/callback", "/_next", "/favicon"];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow public paths through
  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  const hasSession = request.cookies.has("cig_has_session");

  if (!hasSession) {
    // Redirect unauthenticated users to the landing sign-in page.
    return NextResponse.redirect(LANDING_URL);
  }

  return NextResponse.next();
}

export const config = {
  // Run on all routes except static assets and Next.js internals
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
