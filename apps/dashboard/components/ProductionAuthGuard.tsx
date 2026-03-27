"use client";

import { useEffect, useMemo } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { buildDashboardRequestPath, isProtectedDashboardHostname, resolveLandingSignInUrl } from "../lib/siteUrl";
import { clearBrowserSession, getBrowserAccessToken } from "../lib/cigClient";

function getRedirectUrl(pathname: string, search: string): string | null {
  if (typeof window === "undefined") {
    return null;
  }

  if (!isProtectedDashboardHostname(window.location.hostname)) {
    return null;
  }

  return resolveLandingSignInUrl({
    hostname: window.location.hostname,
    protocol: window.location.protocol,
    dashboardPath: buildDashboardRequestPath(pathname, search),
  });
}

export function ProductionAuthGuard({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname() ?? "/";
  const searchParams = useSearchParams();
  const search = useMemo(() => {
    const rendered = searchParams?.toString() ?? "";
    return rendered ? `?${rendered}` : "";
  }, [searchParams]);

  const redirectUrl = useMemo(() => getRedirectUrl(pathname, search), [pathname, search]);
  const shouldRedirect = Boolean(redirectUrl && getBrowserAccessToken() == null);

  useEffect(() => {
    if (!redirectUrl || !shouldRedirect || typeof window === "undefined") {
      return;
    }

    clearBrowserSession();
    window.location.replace(redirectUrl);
  }, [redirectUrl, shouldRedirect]);

  if (shouldRedirect) {
    return (
      <div className="flex h-screen items-center justify-center bg-cig-base">
        <div className="flex flex-col items-center gap-4">
          <div className="relative size-12">
            <div className="absolute inset-0 rounded-full border-2 border-cyan-500/20" />
            <div className="absolute inset-0 animate-spin rounded-full border-2 border-transparent border-t-cyan-400" />
          </div>
          <p className="text-sm tracking-wide text-cyan-500">Redirecting to sign in…</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
