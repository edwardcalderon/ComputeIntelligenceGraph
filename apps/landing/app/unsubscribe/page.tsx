"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { useTranslation } from "@cig-technology/i18n/react";

type State = "idle" | "loading" | "success" | "error";

function UnsubscribeForm() {
  const t = useTranslation();
  const params = useSearchParams();
  const token = params.get("token") ?? "";
  const [state, setState] = useState<State>("idle");

  const handleConfirm = async () => {
    if (!token) {
      setState("error");
      return;
    }
    setState("loading");
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080";
      const res = await fetch(`${apiUrl}/api/v1/newsletter/unsubscribe`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      setState(res.ok ? "success" : "error");
    } catch {
      setState("error");
    }
  };

  if (!token) {
    return (
      <Result
        icon="✕"
        iconColor="#ef4444"
        title={t("unsubscribe.error")}
        desc={t("unsubscribe.errorDesc")}
      />
    );
  }

  if (state === "success") {
    return (
      <Result
        icon="✓"
        iconColor="#10b981"
        title={t("unsubscribe.success")}
        desc={t("unsubscribe.successDesc")}
      />
    );
  }

  if (state === "error") {
    return (
      <Result
        icon="✕"
        iconColor="#ef4444"
        title={t("unsubscribe.error")}
        desc={t("unsubscribe.errorDesc")}
      />
    );
  }

  return (
    <div className="flex flex-col items-center gap-6 text-center">
      {/* Icon */}
      <div className="flex size-16 items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-800">
        <svg className="size-8 text-zinc-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 0 1-2.25 2.25h-15a2.25 2.25 0 0 1-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25m19.5 0v.243a2.25 2.25 0 0 1-1.07 1.916l-7.5 4.615a2.25 2.25 0 0 1-2.36 0L3.32 8.91a2.25 2.25 0 0 1-1.07-1.916V6.75" />
        </svg>
      </div>

      <div>
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">{t("unsubscribe.title")}</h1>
        <p className="mt-2 max-w-sm text-sm leading-relaxed text-zinc-500 dark:text-zinc-400">
          {t("unsubscribe.desc")}
        </p>
      </div>

      <button
        onClick={handleConfirm}
        disabled={state === "loading"}
        className="inline-flex items-center gap-2 rounded-full bg-red-500 px-6 py-3 text-sm font-semibold text-white shadow-sm transition-all hover:bg-red-600 focus:outline-none focus:ring-2 focus:ring-red-400/60 disabled:opacity-60 cursor-pointer"
      >
        {state === "loading" ? (
          <>
            <span className="size-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
            {t("unsubscribe.processing")}
          </>
        ) : (
          t("unsubscribe.confirm")
        )}
      </button>

      <Link href="/" className="text-xs text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors">
        {t("unsubscribe.backHome")}
      </Link>
    </div>
  );
}

function Result({ icon, iconColor, title, desc }: { icon: string; iconColor: string; title: string; desc: string }) {
  const t = useTranslation();
  return (
    <div className="flex flex-col items-center gap-5 text-center">
      <div
        className="flex size-16 items-center justify-center rounded-full text-2xl font-bold text-white"
        style={{ backgroundColor: iconColor }}
      >
        {icon}
      </div>
      <div>
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">{title}</h1>
        <p className="mt-2 max-w-sm text-sm leading-relaxed text-zinc-500 dark:text-zinc-400">{desc}</p>
      </div>
      <Link
        href="/"
        className="inline-flex items-center gap-1 rounded-full border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-5 py-2.5 text-sm font-medium text-zinc-700 dark:text-zinc-300 shadow-sm transition-all hover:bg-zinc-50 dark:hover:bg-zinc-800"
      >
        {t("unsubscribe.backHome")}
      </Link>
    </div>
  );
}

export default function UnsubscribePage() {
  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-zinc-50 via-white to-zinc-100 dark:from-zinc-950 dark:via-zinc-900 dark:to-zinc-950 flex items-center justify-center px-4">
      {/* Subtle glow */}
      <div className="pointer-events-none fixed -top-40 -left-40 h-[500px] w-[500px] rounded-full bg-gradient-to-tr from-cyan-600 via-blue-600 to-violet-600 opacity-[0.06] blur-3xl" />
      <div className="relative z-10 w-full max-w-md rounded-2xl border border-zinc-200/80 dark:border-zinc-800/60 bg-white/80 dark:bg-zinc-950/70 px-8 py-10 shadow-xl backdrop-blur-xl">
        {/* Gradient top accent */}
        <div className="absolute left-0 right-0 top-0 h-0.5 rounded-t-2xl bg-gradient-to-r from-cyan-500 via-blue-500 to-violet-500" />
        {/* Brand */}
        <div className="mb-8 flex justify-center">
          <span className="text-sm font-bold tracking-widest text-zinc-400 uppercase">CIG</span>
        </div>
        <Suspense
          fallback={
            <div className="flex justify-center py-8">
              <span className="size-6 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-600" />
            </div>
          }
        >
          <UnsubscribeForm />
        </Suspense>
      </div>
    </div>
  );
}
