import type { GraphSnapshot, GraphSource } from "@cig/sdk";
import { isLoopbackHostname } from "./siteUrl";

export const GRAPH_SOURCE_STORAGE_KEY = "cig-graph-source";
export const GRAPH_SOURCE_CHANGE_EVENT = "cig-graph-source-change";

export function normalizeGraphSource(value: unknown): GraphSource {
  return value === "demo" ? "demo" : "live";
}

export function readStoredGraphSource(): GraphSource {
  if (typeof window === "undefined") {
    return "live";
  }

  try {
    return normalizeGraphSource(localStorage.getItem(GRAPH_SOURCE_STORAGE_KEY));
  } catch {
    return "live";
  }
}

export function writeStoredGraphSource(source: GraphSource): void {
  if (typeof window === "undefined") {
    return;
  }

  try {
    localStorage.setItem(GRAPH_SOURCE_STORAGE_KEY, source);
    window.dispatchEvent(new Event(GRAPH_SOURCE_CHANGE_EVENT));
  } catch {
    // ignore storage issues
  }
}

export function resolveInitialGraphSource(source?: string | null): GraphSource {
  return normalizeGraphSource(source ?? readStoredGraphSource());
}

export function buildResourceHref(resourceId: string, source: GraphSource): string {
  const params = new URLSearchParams();
  if (source !== "live") {
    params.set("source", source);
  }

  const query = params.toString();
  return `/resources/${encodeURIComponent(resourceId)}${query ? `?${query}` : ""}`;
}

export function shouldAutoUseDemoGraphSource(
  hostname: string | null | undefined,
  source: GraphSource,
  snapshot: Pick<GraphSnapshot, "source" | "resources">,
): boolean {
  if (!hostname || !isLoopbackHostname(hostname) || source !== "live") {
    return false;
  }

  return !snapshot.source.available || snapshot.resources.length === 0;
}
