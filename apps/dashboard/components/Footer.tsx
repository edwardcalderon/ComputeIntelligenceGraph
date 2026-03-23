"use client";

import { useTranslation } from "@cig-technology/i18n/react";

export function Footer() {
  const t = useTranslation();

  return (
    <footer className="shrink-0 border-t border-cig px-4 py-2 text-[10px] text-cig-muted">
      <div className="flex flex-wrap items-center justify-center gap-x-1.5 gap-y-0.5 text-center">
        <a
          href={process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"}
          className="hover:text-cig-secondary transition-colors"
        >
          {t("footer.site")}
        </a>
        <span aria-hidden="true">·</span>
        <span>{t("footer.dashboardLabel")}</span>
        <span aria-hidden="true">·</span>
        <span title={process.env.NEXT_PUBLIC_RELEASE_TAG || ""}>
          v{process.env.NEXT_PUBLIC_APP_VERSION}
          {process.env.NEXT_PUBLIC_APP_BUILD ? `+build.${process.env.NEXT_PUBLIC_APP_BUILD}` : ""}
        </span>
      </div>
    </footer>
  );
}
