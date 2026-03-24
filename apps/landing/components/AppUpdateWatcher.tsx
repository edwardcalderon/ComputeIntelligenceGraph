"use client";

import { UpdateDialog } from "@cig/ui";
import { useEffect, useMemo, useRef, useState } from "react";

type RuntimeVersionPayload = {
  version?: string;
  releaseTag?: string;
  buildNumber?: string;
};

const POLL_INTERVAL_MS = 60_000;
const DISMISS_PREFIX = "cig:landing-update-dismissed:";

function resolveAppPath(pathname: string): string {
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH?.trim().replace(/\/$/, "") || "";
  const normalizedPath = pathname.startsWith("/") ? pathname : `/${pathname}`;
  return basePath ? `${basePath}${normalizedPath}` : normalizedPath;
}

function normalizeVersion(v: RuntimeVersionPayload | null): string {
  if (!v) return "";
  const release = typeof v.releaseTag === "string" ? v.releaseTag.trim() : "";
  const version = typeof v.version === "string" ? v.version.trim() : "";
  const build = v.buildNumber == null ? "" : String(v.buildNumber).trim();
  return release || version || build;
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
    const res = await fetch(`${resolveAppPath("/runtime-version.json")}?ts=${Date.now()}`, {
      cache: "no-store",
      headers: {
        "cache-control": "no-cache",
      },
    });
    if (!res.ok) return null;
    return (await res.json()) as RuntimeVersionPayload;
  } catch {
    return null;
  }
}

export function AppUpdateWatcher() {
  const current = useMemo(() => currentRuntimeVersion(), []);
  const [latest, setLatest] = useState<RuntimeVersionPayload | null>(null);
  const latestVersionRef = useRef("");
  const registrationRef = useRef<ServiceWorkerRegistration | null>(null);
  const reloadRequestedRef = useRef(false);

  useEffect(() => {
    let stopped = false;
    const currentVersion = normalizeVersion(current);
    const swUrl = resolveAppPath("/sw.js");
    const swScope = resolveAppPath("/");

    async function check({ respectVisibility = true }: { respectVisibility?: boolean } = {}) {
      if (respectVisibility && document.visibilityState === "hidden") return;
      const remote = await fetchRuntimeVersion();
      if (stopped || !remote) return;

      const remoteVersion = normalizeVersion(remote);
      if (!remoteVersion || remoteVersion === currentVersion) return;

      const dismissalKey = `${DISMISS_PREFIX}${currentVersion}->${remoteVersion}`;
      if (sessionStorage.getItem(dismissalKey) === "1") return;
      if (latestVersionRef.current === remoteVersion) return;

      latestVersionRef.current = remoteVersion;
      setLatest(remote);
    }

    async function registerServiceWorker() {
      if (!("serviceWorker" in navigator)) return;

      try {
        const workerRegistration = await navigator.serviceWorker.register(swUrl, {
          scope: swScope,
        });

        if (stopped) return;

        registrationRef.current = workerRegistration;

        const handleUpdateFound = () => {
          const installingWorker = workerRegistration.installing;
          if (!installingWorker) return;

          installingWorker.addEventListener("statechange", () => {
            if (installingWorker.state === "installed" && navigator.serviceWorker.controller) {
              void check({ respectVisibility: false });
            }
          });
        };

        workerRegistration.addEventListener("updatefound", handleUpdateFound);

        if (workerRegistration.waiting && navigator.serviceWorker.controller) {
          void check({ respectVisibility: false });
        }
      } catch {
        // Runtime-version polling remains the fallback if service workers are unavailable.
      }
    }

    const handleControllerChange = () => {
      if (reloadRequestedRef.current) {
        window.location.reload();
      }
    };

    void registerServiceWorker();
    navigator.serviceWorker?.addEventListener("controllerchange", handleControllerChange);

    void check();
    const id = window.setInterval(() => {
      if (registrationRef.current) {
        void registrationRef.current.update().catch(() => {});
      }
      void check();
    }, POLL_INTERVAL_MS);

    return () => {
      stopped = true;
      navigator.serviceWorker?.removeEventListener("controllerchange", handleControllerChange);
      window.clearInterval(id);
    };
  }, [current]);

  const latestVersion = normalizeVersion(latest);
  const currentVersion = normalizeVersion(current);

  if (!latest || !latestVersion || latestVersion === currentVersion) return null;

  const dismissalKey = `${DISMISS_PREFIX}${currentVersion}->${latestVersion}`;
  const reload = () => {
    const worker = registrationRef.current?.waiting;

    if (worker) {
      reloadRequestedRef.current = true;
      worker.postMessage({ type: "SKIP_WAITING" });
      return;
    }

    window.location.reload();
  };

  return (
    <UpdateDialog
      open
      title="Update available"
      description="A newer build is ready. Reload now to pick up the latest files and service worker."
      currentLabel="Current"
      latestLabel="Latest"
      currentVersion={currentVersion || "unknown"}
      latestVersion={latestVersion || "unknown"}
      reloadLabel="Reload now"
      laterLabel="Later"
      onReload={reload}
      onDismiss={() => {
        sessionStorage.setItem(dismissalKey, "1");
        latestVersionRef.current = "";
        setLatest(null);
      }}
    />
  );
}
