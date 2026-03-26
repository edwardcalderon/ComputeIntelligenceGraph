"use client";

import Link from "next/link";
import { useTranslation } from "@cig-technology/i18n/react";
import { resolveDocsUrl, resolveLandingUrl } from "../lib/siteUrl";

export function Footer() {
  const t = useTranslation();
  const version = process.env.NEXT_PUBLIC_APP_VERSION || "";
  const build = process.env.NEXT_PUBLIC_APP_BUILD || "";

  const year = new Date().getFullYear();

  return (
    <footer className="shrink-0 border-t border-zinc-200/60 bg-white/60 px-4 py-2 dark:border-white/[0.06] dark:bg-zinc-950/50">
      <div className="flex items-center justify-between gap-4 text-[11px] text-zinc-400 dark:text-zinc-600">
        {/* Left: copyright */}
        <span>
          © {year}{" "}
          <a
            href={resolveLandingUrl()}
            target="_blank"
            rel="noopener noreferrer"
            className="transition-colors hover:text-zinc-600 dark:hover:text-zinc-400"
          >
            CIG
          </a>
          {" — "}{t("footer.rightsReserved")}
        </span>

        {/* Right: version + build + utility links */}
        <div className="flex items-center gap-4">
          {(version || build) && (
            <span className="hidden sm:block tabular-nums">
              {version && `v${version}`}
              {version && build && " · "}
              {build && `build ${build}`}
            </span>
          )}
          <a
            href={resolveDocsUrl()}
            target="_blank"
            rel="noopener noreferrer"
            className="transition-colors hover:text-zinc-600 dark:hover:text-zinc-400"
          >
            {t("footer.docs")}
          </a>
          <Link
            href="/privacy"
            className="transition-colors hover:text-zinc-600 dark:hover:text-zinc-400"
          >
            {t("footer.privacy")}
          </Link>
          <Link
            href="/terms"
            className="transition-colors hover:text-zinc-600 dark:hover:text-zinc-400"
          >
            {t("footer.terms")}
          </Link>
        </div>
      </div>
    </footer>
  );
}
