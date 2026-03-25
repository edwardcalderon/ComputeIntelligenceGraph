"use client";

import React, { useEffect, useState } from "react";
import { FooterBar } from "@cig/ui/components";
import { AuthButton } from "./AuthButton";
import { PreferencesMenu } from "./PreferencesMenu";
import { useTranslation } from "@cig-technology/i18n/react";
import { ChevronsUp } from "lucide-react";

function cn(...classes: (string | false | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}

/* ─── Back to Top Button ──────────────────────────────────────────────── */
const BackToTop: React.FC = () => {
  const t = useTranslation();
  const [show, setShow] = useState(false);

  useEffect(() => {
    const onScroll = () => setShow(window.scrollY > 400);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <button
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      aria-label={t("hero.backToTop")}
      title={t("hero.backToTop")}
      className={cn(
        "fixed bottom-4 right-4 z-40 rounded-full border border-zinc-200/80 dark:border-zinc-800 bg-white/85 dark:bg-zinc-950/85 px-3 py-3 sm:px-4 shadow-lg shadow-zinc-900/10 backdrop-blur transition-all duration-500 hover:bg-zinc-100 dark:hover:bg-zinc-900 hover:scale-105 hover:border-zinc-300 dark:hover:border-zinc-700 focus:outline-none focus:ring-2 focus:ring-cyan-400 cursor-pointer",
        show ? "opacity-100 translate-y-0 pointer-events-auto" : "opacity-0 translate-y-4 pointer-events-none"
      )}
    >
      <span className="flex items-center gap-2.5 text-zinc-600 dark:text-zinc-300">
        <span className="flex size-9 items-center justify-center rounded-full bg-gradient-to-br from-cyan-500/15 via-blue-500/15 to-violet-500/15 ring-1 ring-zinc-200/80 dark:ring-zinc-700/70">
          <ChevronsUp size={18} className="text-cyan-500 dark:text-cyan-300" />
        </span>
        <span className="hidden text-[10px] font-semibold uppercase tracking-[0.35em] whitespace-nowrap sm:inline">
          {t("hero.backToTop")}
        </span>
      </span>
    </button>
  );
};

/* ─── Footer ──────────────────────────────────────────────────────────── */
const Footer: React.FC = () => {
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
    <footer className="relative w-full border-t border-zinc-200 dark:border-zinc-800/50 px-4 py-4 sm:px-6">
      <div className="relative z-10">
        <FooterBar
          brandLabel={t("footer.brandTitle")}
          brandHref="/"
          subtitle={t("footer.rightsReserved")}
          links={[
            { label: t("footer.privacy"), href: "/privacy" },
            { label: t("footer.terms"), href: "/terms" },
          ]}
          meta={meta}
        />
      </div>
    </footer>
  );
};

/* ─── Landing Layout ──────────────────────────────────────────────────── */
interface LandingLayoutProps {
  children: React.ReactNode;
  className?: string;
}

export const LandingLayout: React.FC<LandingLayoutProps> = ({ children, className }) => {
  return (
    <div className={cn(
      "min-h-screen w-full bg-gradient-to-br from-zinc-50 via-white to-zinc-100 dark:from-zinc-950 dark:via-zinc-900 dark:to-zinc-950 text-zinc-900 dark:text-zinc-50 relative overflow-x-hidden",
      className
    )}>
      {/* Top auth bar */}
      <div className="fixed top-4 right-4 z-50 flex items-center gap-2">
        <PreferencesMenu />
        <AuthButton />
      </div>

      {/* Blob glows — both modes */}
      <div className="pointer-events-none fixed -top-40 -left-40 w-[600px] h-[600px] bg-gradient-to-tr from-cyan-600 via-blue-600 to-violet-600 opacity-[0.10] dark:opacity-[0.07] rounded-full blur-3xl animate-pulse-slow z-0" />
      <div className="pointer-events-none fixed -bottom-40 -right-40 w-[500px] h-[500px] bg-gradient-to-bl from-violet-600 via-blue-600 to-cyan-600 opacity-[0.08] dark:opacity-[0.05] rounded-full blur-3xl animate-pulse-slow z-0" />

      {/* Main content */}
      <div className="relative z-10 flex flex-col min-h-screen">
        <main className="flex-1">
          {children}
        </main>
        <Footer />
      </div>

      <BackToTop />
    </div>
  );
};
