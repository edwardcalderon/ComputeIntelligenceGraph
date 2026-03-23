"use client";

import { useGetIdentity, useLogout } from "@refinedev/core";
import { useTranslation } from "@cig-technology/i18n/react";
import { useState, useCallback } from "react";

interface Identity {
  id: string;
  name: string;
  email: string;
  avatar: string | null;
  provider?: string;
}

export default function ProfilePage() {
  const t = useTranslation();
  const { data: identity, isLoading } = useGetIdentity<Identity>();
  const { mutate: logout, isPending: loggingOut } = useLogout();

  const initials = identity?.name
    ? identity.name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase()
    : "?";

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-48">
        <div className="size-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4 sm:space-y-6">
      <div className="space-y-1">
        <h1 className="text-3xl font-semibold tracking-tight text-gray-900 dark:text-gray-100">
          {t("profile.title")}
        </h1>
      </div>

      {/* Avatar & identity card */}
      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-900 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-5">
          {identity?.avatar ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={identity.avatar}
              alt={identity.name}
              className="size-20 shrink-0 rounded-full object-cover ring-2 ring-blue-500/30"
            />
          ) : (
            <span className="flex size-20 shrink-0 items-center justify-center rounded-full bg-blue-600 text-2xl font-bold text-white ring-2 ring-blue-500/30">
              {initials}
            </span>
          )}
          <div className="min-w-0 space-y-2">
            <p className="text-2xl font-semibold leading-tight text-gray-900 dark:text-gray-100 [overflow-wrap:anywhere]">
              {identity?.name ?? "—"}
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400 [overflow-wrap:anywhere]">
              {identity?.email ?? "—"}
            </p>
            <span className="inline-flex w-fit max-w-full items-center gap-1 rounded-full bg-green-100 px-2.5 py-1 text-xs font-medium text-green-700 dark:bg-green-900/30 dark:text-green-400">
              <span className="size-1.5 rounded-full bg-green-500" />
              {t("profile.activeSession")}
            </span>
          </div>
        </div>
      </div>

      {/* Account info */}
      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900">
        <div className="px-5 py-5 sm:px-6">
          <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-gray-100">
            {t("profile.accountInfo")}
          </h2>
          <dl className="space-y-4">
            <Row label={t("profile.fullName")}  value={identity?.name  ?? "—"} />
            <Row label={t("profile.email")}      value={identity?.email ?? "—"} />
            <UserIdRow label={t("profile.userId")} value={identity?.id ?? "—"} />
          </dl>
        </div>

        <div className="border-t border-gray-100 px-5 py-5 dark:border-gray-800 sm:px-6">
          <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-gray-100">
            {t("profile.authentication")}
          </h2>
          <dl className="space-y-4">
            <Row label={t("profile.provider")}      value={identity?.provider ?? "CIG Auth"} />
            <Row label={t("profile.sessionType")}  value={t("profile.sessionTypeValue")} />
          </dl>
        </div>
      </div>

      {/* Sign out */}
      <div className="rounded-2xl border border-red-200 bg-red-50 p-5 dark:border-red-900/50 dark:bg-red-950/20 sm:p-6">
        <h2 className="mb-2 text-lg font-semibold text-red-800 dark:text-red-300">
          {t("profile.signOutTitle")}
        </h2>
        <p className="mb-4 max-w-xl text-sm text-red-600 dark:text-red-400">
          {t("profile.signOutDesc")}
        </p>
        <button
          onClick={() => logout()}
          disabled={loggingOut}
          className="inline-flex w-full items-center justify-center rounded-lg bg-red-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-red-700 disabled:opacity-50 sm:w-auto"
        >
          {loggingOut ? t("profile.signingOut") : t("profile.signOutButton")}
        </button>
      </div>
    </div>
  );
}

function Row({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="grid gap-1.5 sm:grid-cols-[minmax(0,9rem)_minmax(0,1fr)] sm:gap-4">
      <dt className="text-xs font-medium uppercase tracking-[0.08em] text-gray-500 dark:text-gray-400">
        {label}
      </dt>
      <dd
        className={[
          "min-w-0 text-sm text-gray-900 dark:text-gray-100 [overflow-wrap:anywhere] sm:text-right",
          mono ? "font-mono text-xs" : "",
        ].join(" ")}
      >
        {value}
      </dd>
    </div>
  );
}

function UserIdRow({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [value]);

  const truncated = value.length > 16
    ? `${value.slice(0, 8)}...${value.slice(-8)}`
    : value;

  return (
    <div className="grid gap-1.5 sm:grid-cols-[minmax(0,9rem)_minmax(0,1fr)] sm:gap-4">
      <dt className="text-xs font-medium uppercase tracking-[0.08em] text-gray-500 dark:text-gray-400">
        {label}
      </dt>
      <dd className="flex min-w-0 items-center gap-2 sm:justify-end">
        <span
          className="block min-w-0 truncate font-mono text-xs text-gray-900 dark:text-gray-100"
          title={value}
        >
          {truncated}
        </span>
        <button
          onClick={handleCopy}
          type="button"
          className="rounded p-0.5 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
          title={copied ? "Copied!" : "Copy to clipboard"}
        >
          {copied ? (
            <svg className="size-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 6 9 17l-5-5" />
            </svg>
          ) : (
            <svg className="size-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
            </svg>
          )}
        </button>
      </dd>
    </div>
  );
}
