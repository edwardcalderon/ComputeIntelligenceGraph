"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useTranslation } from "@cig-technology/i18n/react";
import { getBootstrapStatus } from "../lib/api";
import {
  clearBootstrapPromptSeen,
  hasSeenBootstrapPrompt,
  markBootstrapPromptSeen,
} from "../lib/bootstrapPreferences";
import { notifyUser } from "./NotificationBell";

export function BootstrapRedirect({
  children,
}: {
  children: React.ReactNode;
}) {
  const t = useTranslation();
  const router = useRouter();
  const pathname = usePathname();
  const [checked, setChecked] = useState(false);
  const didCheckRef = useRef(false);

  useEffect(() => {
    if (didCheckRef.current) {
      return;
    }
    didCheckRef.current = true;

    let cancelled = false;

    const checkBootstrap = async () => {
      try {
        const status = await getBootstrapStatus();
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
        console.error("Failed to check bootstrap status:", err);
      } finally {
        if (!cancelled) {
          setChecked(true);
        }
      }
    };

    checkBootstrap();
    return () => {
      cancelled = true;
    };
  }, [router, pathname]);

  if (!checked) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-gray-950">
        <p className="text-gray-500 dark:text-gray-400">{t("common.loading")}</p>
      </div>
    );
  }

  return <>{children}</>;
}
