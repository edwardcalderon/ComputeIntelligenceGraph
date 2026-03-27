"use client";

import { useEffect, useState } from "react";
import { ChevronsUp } from "lucide-react";
import { useTranslation } from "@cig-technology/i18n/react";

function cn(...classes: (string | false | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}

export function BackToTop() {
  const t = useTranslation();
  const [show, setShow] = useState(false);
  const [bottomPx, setBottomPx] = useState(16);

  useEffect(() => {
    function update() {
      setShow(window.scrollY > 400);
      const footer = document.getElementById("site-footer");
      if (footer) {
        const gap = window.innerHeight - footer.getBoundingClientRect().top;
        setBottomPx(gap > 0 ? gap + 8 : 16);
      }
    }
    window.addEventListener("scroll", update, { passive: true });
    update();
    return () => window.removeEventListener("scroll", update);
  }, []);

  return (
    <button
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      aria-label={t("hero.backToTop")}
      title={t("hero.backToTop")}
      style={{ bottom: `${bottomPx}px` }}
      className={cn(
        "fixed right-4 z-40 rounded-full border border-zinc-200/80 dark:border-zinc-800 bg-white/85 dark:bg-zinc-950/85 px-3 py-3 sm:px-4 shadow-lg shadow-zinc-900/10 backdrop-blur transition-all duration-500 hover:bg-zinc-100 dark:hover:bg-zinc-900 hover:scale-105 hover:border-zinc-300 dark:hover:border-zinc-700 focus:outline-none focus:ring-2 focus:ring-cyan-400 cursor-pointer",
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
}
