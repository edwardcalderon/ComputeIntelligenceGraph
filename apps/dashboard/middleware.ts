import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { resolveLandingUrl } from "./lib/siteUrl";

/** Routes that are always public — no session required. */
const PUBLIC_PATHS = [
  "/auth/callback",
  "/auth/login-callback",
  "/auth/login",
  "/api/auth/sync",
  "/runtime-version.json",
  "/sw.js",
  "/_next",
  "/favicon",
];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const landingUrl = resolveLandingUrl({
    hostname: request.nextUrl.hostname,
    protocol: request.nextUrl.protocol,
  });

  if (pathname === "/auth/callback" && request.nextUrl.searchParams.has("code")) {
    const loginCallbackUrl = new URL("/auth/login-callback", request.url);
    for (const [key, value] of request.nextUrl.searchParams.entries()) {
      loginCallbackUrl.searchParams.set(key, value);
    }
    return NextResponse.redirect(loginCallbackUrl);
  }

  // Allow public paths through
  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  const hasSession = request.cookies.has("cig_has_session");

  if (!hasSession) {
    // Redirect unauthenticated users to the landing sign-in page.
    return NextResponse.redirect(landingUrl);
  }

  return NextResponse.next();
}

export const config = {
  // Run on all routes except static assets and Next.js internals
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
