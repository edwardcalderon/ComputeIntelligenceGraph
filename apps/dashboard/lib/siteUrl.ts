const DEFAULT_LANDING_URL   = "http://localhost:3000";
const DEFAULT_DASHBOARD_URL = "http://localhost:3001";
const DEFAULT_DOCS_URL      = "http://localhost:3004";

type UrlContext = {
  hostname?: string | null;
  protocol?: string | null;
};

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
  const hostname =
    context.hostname ??
    (typeof window !== "undefined" ? window.location.hostname : undefined);
  const protocol =
    context.protocol ??
    (typeof window !== "undefined" ? window.location.protocol : undefined);

  if (hostname && isLocalHostname(hostname)) {
    return formatLocalOriginUrl(hostname, protocol ?? "http:", 3000);
  }

  return process.env.NEXT_PUBLIC_SITE_URL ?? DEFAULT_LANDING_URL;
}

export function resolveLandingLoggedOutUrl(context: UrlContext = {}): string {
  return `${resolveLandingUrl(context)}?logged_out=1`;
}

export function resolveDashboardUrl(context: UrlContext = {}): string {
  const hostname =
    context.hostname ??
    (typeof window !== "undefined" ? window.location.hostname : undefined);
  const protocol =
    context.protocol ??
    (typeof window !== "undefined" ? window.location.protocol : undefined);

  if (hostname && isLocalHostname(hostname)) {
    return formatLocalOriginUrl(hostname, protocol ?? "http:", 3001);
  }

  return process.env.NEXT_PUBLIC_DASHBOARD_URL ?? DEFAULT_DASHBOARD_URL;
}

export function resolveDocsUrl(context: UrlContext = {}): string {
  const hostname =
    context.hostname ??
    (typeof window !== "undefined" ? window.location.hostname : undefined);
  const protocol =
    context.protocol ??
    (typeof window !== "undefined" ? window.location.protocol : undefined);

  if (hostname && isLocalHostname(hostname)) {
    return formatLocalOriginUrl(hostname, protocol ?? "http:", 3004);
  }

  return process.env.NEXT_PUBLIC_DOCS_URL ?? DEFAULT_DOCS_URL;
}
