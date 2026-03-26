import { useSyncExternalStore } from "react";

const DEFAULT_LANDING_URL = "http://localhost:3000";
const DEFAULT_DASHBOARD_URL = "http://localhost:3001";
const DEFAULT_DOCS_URL = "http://localhost:3000/documentation";

export type UrlContext = {
  hostname?: string | null;
  protocol?: string | null;
};

type PublicEnv = {
  NEXT_PUBLIC_SITE_URL?: string;
  NEXT_PUBLIC_DASHBOARD_URL?: string;
  NEXT_PUBLIC_DOCS_URL?: string;
};

function getPublicEnv(): PublicEnv {
  return (globalThis as { process?: { env?: PublicEnv } }).process?.env ?? {};
}

function isLocalHostname(hostname: string): boolean {
  const normalized = hostname.toLowerCase();
  return (
    normalized === "localhost" ||
    normalized === "127.0.0.1" ||
    normalized === "::1" ||
    normalized.endsWith(".localhost")
  );
}

function formatLocalOriginUrl(hostname: string, protocol: string, port: number): string {
  const normalizedProtocol = protocol.endsWith(":") ? protocol : `${protocol}:`;
  const renderedHost = hostname === "::1" ? "[::1]" : hostname;
  return `${normalizedProtocol}//${renderedHost}:${port}`;
}

export function resolveLandingUrl(context: UrlContext = {}): string {
  const env = getPublicEnv();
  const hostname = context.hostname;
  const protocol = context.protocol;

  if (hostname && isLocalHostname(hostname)) {
    return formatLocalOriginUrl(hostname, protocol ?? "http:", 3000);
  }

  return env.NEXT_PUBLIC_SITE_URL ?? DEFAULT_LANDING_URL;
}

export function resolveLandingLoggedOutUrl(context: UrlContext = {}): string {
  return `${resolveLandingUrl(context)}?logged_out=1`;
}

export function resolveDocsUrl(context: UrlContext = {}): string {
  const env = getPublicEnv();
  const hostname = context.hostname;
  const protocol = context.protocol;

  if (hostname && isLocalHostname(hostname)) {
    return `${formatLocalOriginUrl(hostname, protocol ?? "http:", 3000)}/documentation`;
  }

  const configuredDocsUrl = env.NEXT_PUBLIC_DOCS_URL;
  if (configuredDocsUrl) {
    return configuredDocsUrl;
  }

  const configuredSiteUrl = env.NEXT_PUBLIC_SITE_URL;
  if (configuredSiteUrl) {
    return `${configuredSiteUrl.replace(/\/+$/, "")}/documentation`;
  }

  return DEFAULT_DOCS_URL;
}

export function resolveDashboardUrl(context: UrlContext = {}): string {
  const env = getPublicEnv();
  const hostname = context.hostname;
  const protocol = context.protocol;

  if (hostname && isLocalHostname(hostname)) {
    return formatLocalOriginUrl(hostname, protocol ?? "http:", 3001);
  }

  return env.NEXT_PUBLIC_DASHBOARD_URL ?? DEFAULT_DASHBOARD_URL;
}

function subscribe(onStoreChange: () => void): () => void {
  if (typeof window === "undefined") {
    return () => {};
  }

  window.addEventListener("popstate", onStoreChange);
  window.addEventListener("hashchange", onStoreChange);

  return () => {
    window.removeEventListener("popstate", onStoreChange);
    window.removeEventListener("hashchange", onStoreChange);
  };
}

function getClientContext(): UrlContext {
  if (typeof window === "undefined") {
    return {};
  }

  return {
    hostname: window.location.hostname,
    protocol: window.location.protocol,
  };
}

function getServerContext(): UrlContext {
  return {};
}

export function useUrlContext(): UrlContext {
  return useSyncExternalStore(subscribe, getClientContext, getServerContext);
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
