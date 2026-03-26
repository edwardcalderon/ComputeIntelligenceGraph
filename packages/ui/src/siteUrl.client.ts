"use client";

import { useEffect, useState } from "react";
import {
  resolveDashboardUrl,
  resolveDocsUrl,
  resolveLandingLoggedOutUrl,
  resolveLandingUrl,
  type UrlContext,
} from "./siteUrl";

function getClientContext(): UrlContext {
  if (typeof window === "undefined") {
    return {};
  }

  return {
    hostname: window.location.hostname,
    protocol: window.location.protocol,
  };
}

function areSameContext(left: UrlContext, right: UrlContext): boolean {
  return left.hostname === right.hostname && left.protocol === right.protocol;
}

export function useUrlContext(): UrlContext {
  const [context, setContext] = useState<UrlContext>({});

  useEffect(() => {
    const updateContext = () => {
      const next = getClientContext();
      setContext((current) => (areSameContext(current, next) ? current : next));
    };

    updateContext();
    window.addEventListener("popstate", updateContext);
    window.addEventListener("hashchange", updateContext);

    return () => {
      window.removeEventListener("popstate", updateContext);
      window.removeEventListener("hashchange", updateContext);
    };
  }, []);

  return context;
}

export function useResolvedLandingUrl(): string {
  return resolveLandingUrl(useUrlContext());
}

export function useResolvedLandingLoggedOutUrl(): string {
  return resolveLandingLoggedOutUrl(useUrlContext());
}

export function useResolvedDocsUrl(): string {
  return resolveDocsUrl(useUrlContext());
}

export function useResolvedDashboardUrl(): string {
  return resolveDashboardUrl(useUrlContext());
}
