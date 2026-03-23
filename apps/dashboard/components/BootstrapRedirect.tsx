"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useTranslation } from "@cig-technology/i18n/react";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080";

interface BootstrapStatusResponse {
  requires_bootstrap: boolean;
}

async function getBootstrapStatus(): Promise<BootstrapStatusResponse> {
  const res = await fetch(`${API_URL}/api/v1/bootstrap/status`, {
    headers: { "Content-Type": "application/json" },
  });
  if (!res.ok) {
    throw new Error(`API error ${res.status}: ${res.statusText}`);
  }
  return res.json();
}

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
