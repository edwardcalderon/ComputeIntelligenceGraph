export type DashboardAuthSource = "authentik" | "supabase";

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const part = token.split(".")[1];
    if (!part) return null;
    return JSON.parse(atob(part.replace(/-/g, "+").replace(/_/g, "/")));
  } catch {
    return null;
  }
}

function normalizeAuthSource(value: string | null | undefined): DashboardAuthSource | null {
  if (value === "authentik" || value === "supabase") {
    return value;
  }
  return null;
}

function looksLikeSupabaseIssuer(issuer: string): boolean {
  const normalized = issuer.toLowerCase();
  return (
    normalized.includes("supabase")
    || normalized.includes("/auth/v1")
  );
}

function inferAuthSourceFromToken(token: string | null | undefined): DashboardAuthSource | null {
  const payload = decodeJwtPayload(token ?? "");
  const issuer = typeof payload?.iss === "string" ? payload.iss.trim() : "";
  if (issuer && looksLikeSupabaseIssuer(issuer)) {
    return "supabase";
  }

  if (payload) {
    return "authentik";
  }

  return null;
}

export function resolveDashboardAuthSource(params: {
  explicitAuthSource?: string | null;
  accessToken?: string | null;
  idToken?: string | null;
  defaultSource?: DashboardAuthSource;
}): DashboardAuthSource {
  const inferred = inferAuthSourceFromToken(params.idToken ?? params.accessToken ?? null);
  if (inferred) {
    return inferred;
  }

  const explicit = normalizeAuthSource(params.explicitAuthSource);
  if (explicit) {
    return explicit;
  }

  return params.defaultSource ?? "authentik";
}
