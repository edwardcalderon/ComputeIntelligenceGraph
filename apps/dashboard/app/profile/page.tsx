"use client";

import { useGetIdentity, useLogout } from "@refinedev/core";

interface Identity {
  id: string;
  name: string;
  email: string;
  avatar: string | null;
}

export default function ProfilePage() {
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
    <div className="max-w-2xl mx-auto space-y-6">
      <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">Profile</h1>

      {/* Avatar & identity card */}
      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-6">
        <div className="flex items-center gap-5">
          {identity?.avatar ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={identity.avatar}
              alt={identity.name}
              className="size-20 rounded-full object-cover ring-2 ring-blue-500/30"
            />
          ) : (
            <span className="size-20 rounded-full bg-blue-600 text-white flex items-center justify-center text-2xl font-bold ring-2 ring-blue-500/30">
              {initials}
            </span>
          )}
          <div>
            <p className="text-xl font-semibold text-gray-900 dark:text-gray-100">{identity?.name}</p>
            <p className="text-sm text-gray-500 dark:text-gray-400">{identity?.email}</p>
            <span className="mt-2 inline-flex items-center gap-1 rounded-full bg-green-100 dark:bg-green-900/30 px-2 py-0.5 text-xs font-medium text-green-700 dark:text-green-400">
              <span className="size-1.5 rounded-full bg-green-500" />
              Active session
            </span>
          </div>
        </div>
      </div>

      {/* Account info */}
      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 divide-y divide-gray-100 dark:divide-gray-800">
        <div className="px-6 py-4">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">Account Information</h2>
          <dl className="space-y-3">
            <Row label="Full name"  value={identity?.name  ?? "—"} />
            <Row label="Email"      value={identity?.email ?? "—"} />
            <Row label="User ID"    value={identity?.id    ?? "—"} mono />
          </dl>
        </div>

        <div className="px-6 py-4">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">Authentication</h2>
          <dl className="space-y-3">
            <Row label="Provider"      value="Supabase OAuth" />
            <Row label="Session type"  value="Browser session (sessionStorage)" />
          </dl>
        </div>
      </div>

      {/* Sign out */}
      <div className="rounded-xl border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/20 p-6">
        <h2 className="text-sm font-semibold text-red-800 dark:text-red-300 mb-1">Sign out</h2>
        <p className="text-xs text-red-600 dark:text-red-400 mb-4">
          This will clear your session and redirect you to the landing page.
        </p>
        <button
          onClick={() => logout()}
          disabled={loggingOut}
          className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50 transition-colors"
        >
          {loggingOut ? "Signing out…" : "Sign out"}
        </button>
      </div>
    </div>
  );
}

function Row({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <dt className="text-xs text-gray-500 dark:text-gray-400 w-32 flex-shrink-0">{label}</dt>
      <dd className={`text-sm text-gray-900 dark:text-gray-100 text-right break-all ${mono ? "font-mono text-xs" : ""}`}>
        {value}
      </dd>
    </div>
  );
}
