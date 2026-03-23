const DEFAULT_LANDING_URL = "http://localhost:3000";

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

function formatLocalLandingUrl(hostname: string, protocol: string): string {
  const normalizedProtocol = protocol.endsWith(":") ? protocol : `${protocol}:`;
  const renderedHost = hostname === "::1" ? "[::1]" : hostname;
  return `${normalizedProtocol}//${renderedHost}:3000`;
}

export function resolveLandingUrl(context: UrlContext = {}): string {
  const hostname =
    context.hostname ??
    (typeof window !== "undefined" ? window.location.hostname : undefined);
  const protocol =
    context.protocol ??
    (typeof window !== "undefined" ? window.location.protocol : undefined);

  if (hostname && isLocalHostname(hostname)) {
    return formatLocalLandingUrl(hostname, protocol ?? "http:");
  }

  return process.env.NEXT_PUBLIC_SITE_URL ?? DEFAULT_LANDING_URL;
}

export function resolveLandingLoggedOutUrl(context: UrlContext = {}): string {
  return `${resolveLandingUrl(context)}?logged_out=1`;
}
