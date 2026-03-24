"use client";

import { FooterBar } from "@cig/ui/components";
import { useTranslation } from "@cig-technology/i18n/react";
import { resolveLandingUrl } from "../lib/siteUrl";

export function Footer() {
  const t = useTranslation();
  const version = process.env.NEXT_PUBLIC_APP_VERSION || "";
  const build = process.env.NEXT_PUBLIC_APP_BUILD || "";

  const meta = [
    t("footer.licenseNotice", { year: new Date().getFullYear() }),
    version ? t("common.version", { version }) : "",
    build ? t("common.build", { build }) : "",
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <footer className="shrink-0 border-t border-zinc-200/80 bg-white/80 px-4 py-3 text-zinc-700 dark:border-white/10 dark:bg-zinc-950/70 dark:text-zinc-300">
      <FooterBar
        brandLabel={t("footer.brandTitle")}
        brandHref={resolveLandingUrl()}
        subtitle={t("footer.rightsReserved")}
        links={[
          { label: t("footer.privacy"), href: "/privacy" },
          { label: t("footer.terms"), href: "/terms" },
        ]}
        meta={meta}
      />
    </footer>
  );
}
