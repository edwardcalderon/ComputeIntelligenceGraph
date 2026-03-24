"use client";

import { useEffect, useMemo, useState } from "react";
import { notifyUser } from "./NotificationBell";

type RuntimeVersionPayload = {
  version?: string;
  releaseTag?: string;
  buildNumber?: string;
};

const POLL_INTERVAL_MS = 60_000;
const DISMISS_PREFIX = "cig:update-dismissed:";

function normalizeVersion(v: RuntimeVersionPayload | null): string {
  if (!v) return "";
  const release = typeof v.releaseTag === "string" ? v.releaseTag.trim() : "";
  const version = typeof v.version === "string" ? v.version.trim() : "";
  return release || version;
}

function currentRuntimeVersion(): RuntimeVersionPayload {
  return {
    version: process.env.NEXT_PUBLIC_APP_VERSION,
    releaseTag: process.env.NEXT_PUBLIC_RELEASE_TAG,
    buildNumber: process.env.NEXT_PUBLIC_APP_BUILD,
  };
}

async function fetchRuntimeVersion(): Promise<RuntimeVersionPayload | null> {
  try {
    const res = await fetch(`/runtime-version.json?ts=${Date.now()}`, {
      cache: "no-store",
      headers: {
        "cache-control": "no-cache",
      },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as RuntimeVersionPayload;
    return data;
  } catch {
    return null;
  }
}

export function AppUpdateWatcher() {
  const current = useMemo(() => currentRuntimeVersion(), []);
  const [latest, setLatest] = useState<RuntimeVersionPayload | null>(null);

  useEffect(() => {
    let stopped = false;
    const currentVersion = normalizeVersion(current);

    async function check() {
      if (document.visibilityState === "hidden") return;
      const remote = await fetchRuntimeVersion();
      if (stopped || !remote) return;

      const remoteVersion = normalizeVersion(remote);
      if (!remoteVersion || remoteVersion === currentVersion) return;

      const dismissalKey = `${DISMISS_PREFIX}${currentVersion}->${remoteVersion}`;
      if (sessionStorage.getItem(dismissalKey) === "1") return;

      setLatest(remote);
      notifyUser(`New release available: ${remoteVersion}`, "progress");
    }

    void check();
    const id = window.setInterval(() => {
      void check();
    }, POLL_INTERVAL_MS);

    return () => {
      stopped = true;
      window.clearInterval(id);
    };
  }, [current]);

  const latestVersion = normalizeVersion(latest);
  const currentVersion = normalizeVersion(current);

  if (!latest || !latestVersion || latestVersion === currentVersion) return null;

  const dismissalKey = `${DISMISS_PREFIX}${currentVersion}->${latestVersion}`;

  return (
    <div className="fixed right-4 top-16 z-[90] w-[min(420px,calc(100vw-2rem))] rounded-xl border border-cyan-500/30 bg-cig-card/95 p-4 shadow-2xl backdrop-blur">
      <p className="text-sm font-semibold text-cig-secondary">Update available</p>
      <p className="mt-1 text-xs text-cig-muted">
        Current {currentVersion || "unknown"} - latest {latestVersion}
      </p>
      <div className="mt-3 flex items-center gap-2">
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="rounded-md bg-cyan-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-cyan-500 transition-colors"
        >
          Reload now
        </button>
        <button
          type="button"
          onClick={() => {
            sessionStorage.setItem(dismissalKey, "1");
            setLatest(null);
          }}
          className="rounded-md border border-cig px-3 py-1.5 text-xs font-medium text-cig-muted hover:bg-cig-hover transition-colors"
        >
          Later
        </button>
      </div>
    </div>
  );
}
