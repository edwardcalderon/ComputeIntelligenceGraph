"use client";

import { useTranslation } from "@cig-technology/i18n/react";

export function Footer() {
  const t = useTranslation();

  return (
    <footer className="shrink-0 text-center text-[10px] text-cig-muted py-2 border-t border-cig">
      <a
        href={process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"}
        className="hover:text-cig-secondary transition-colors"
      >
        {t("footer.site")}
      </a>
      {" · "}{t("footer.dashboardLabel")}{" · "}
      <span title={process.env.NEXT_PUBLIC_RELEASE_TAG || ""}>
        v{process.env.NEXT_PUBLIC_APP_VERSION}
        {process.env.NEXT_PUBLIC_APP_BUILD ? `+build.${process.env.NEXT_PUBLIC_APP_BUILD}` : ""}
      </span>
    </footer>
  );
}
