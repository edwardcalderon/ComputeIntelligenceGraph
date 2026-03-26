"use client";

import { useEffect, useRef } from "react";
import { useRouter, usePathname } from "next/navigation";
import { getBootstrapStatus } from "../lib/api";
import {
  clearBootstrapPromptSeen,
  hasSeenBootstrapPrompt,
  markBootstrapPromptSeen,
} from "../lib/bootstrapPreferences";
import { notifyUser } from "./NotificationBell";

const BOOTSTRAP_STATUS_TIMEOUT_MS = 3_000;

export function BootstrapRedirect({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const didCheckRef = useRef(false);

  useEffect(() => {
    if (didCheckRef.current) {
      return;
    }
    didCheckRef.current = true;

    let cancelled = false;

    const checkBootstrap = async () => {
      try {
        const status = await Promise.race([
          getBootstrapStatus(),
          new Promise<never>((_resolve, reject) => {
            window.setTimeout(() => reject(new Error("Bootstrap status check timed out")), BOOTSTRAP_STATUS_TIMEOUT_MS);
          }),
        ]);
        if (cancelled) {
          return;
        }

        if (status.mode !== "self-hosted" || !status.requires_bootstrap) {
          clearBootstrapPromptSeen();
          return;
        }

        const hasSeenPrompt = hasSeenBootstrapPrompt();
        if (hasSeenPrompt) {
          return;
        }

        const shouldRedirect = pathname !== "/bootstrap";
        markBootstrapPromptSeen();
        notifyUser(
          "Self-hosted setup is required. Open the bootstrap flow to finish initial setup.",
          "progress"
        );

        if (shouldRedirect) {
          router.replace("/bootstrap");
        }
      } catch (err) {
        if (!cancelled) {
          console.warn("Failed to check bootstrap status:", err);
        }
      }
    };

    checkBootstrap();
    return () => {
      cancelled = true;
    };
  }, [router, pathname]);

  return <>{children}</>;
}
