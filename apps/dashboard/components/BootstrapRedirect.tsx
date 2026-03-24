"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useTranslation } from "@cig-technology/i18n/react";
import { getBootstrapStatus } from "../lib/api";

export function BootstrapRedirect({
  children,
}: {
  children: React.ReactNode;
}) {
  const t = useTranslation();
  const router = useRouter();
  const pathname = usePathname();
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    const checkBootstrap = async () => {
      try {
        const status = await getBootstrapStatus();
        if (status.requires_bootstrap && pathname !== "/bootstrap") {
          router.push("/bootstrap");
        }
      } catch (err) {
        console.error("Failed to check bootstrap status:", err);
      } finally {
        setChecked(true);
      }
    };

    checkBootstrap();
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
