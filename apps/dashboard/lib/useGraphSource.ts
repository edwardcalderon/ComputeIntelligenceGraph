"use client";

import { useEffect, useSyncExternalStore } from "react";
import type { GraphSource } from "@cig/sdk";
import {
  GRAPH_SOURCE_CHANGE_EVENT,
  normalizeGraphSource,
  readStoredGraphSource,
  writeStoredGraphSource,
  resolveInitialGraphSource,
} from "./graphSource";

function subscribe(listener: () => void): () => void {
  if (typeof window === "undefined") {
    return () => undefined;
  }

  const handleStorage = () => listener();
  const handleCustomEvent = () => listener();

  window.addEventListener("storage", handleStorage);
  window.addEventListener(GRAPH_SOURCE_CHANGE_EVENT, handleCustomEvent);

  return () => {
    window.removeEventListener("storage", handleStorage);
    window.removeEventListener(GRAPH_SOURCE_CHANGE_EVENT, handleCustomEvent);
  };
}

function getSnapshot(): GraphSource {
  return readStoredGraphSource();
}

function getServerSnapshot(): GraphSource {
  return "live";
}

export function useDashboardGraphSource(explicitSource?: string | null): readonly [
  GraphSource,
  (source: GraphSource) => void,
] {
  const storedSource = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const normalizedExplicit = explicitSource == null ? null : normalizeGraphSource(explicitSource);
  const source = normalizedExplicit ?? storedSource;

  useEffect(() => {
    if (normalizedExplicit && normalizedExplicit !== storedSource) {
      writeStoredGraphSource(normalizedExplicit);
    }
  }, [normalizedExplicit, storedSource]);

  return [source, writeStoredGraphSource] as const;
}

export function useResolvedGraphSource(explicitSource?: string | null): GraphSource {
  return resolveInitialGraphSource(explicitSource);
}
