"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useCallback, useTransition, Suspense } from "react";
import { getResourcesPaged, searchResources, Resource } from "../../lib/api";
import { getProviderColor, getProviderLabel } from "../../lib/providers";

const PAGE_SIZE = 20;

const TYPES = ["compute", "storage", "network", "database"] as const;
const PROVIDERS = ["aws", "gcp", "kubernetes", "docker"] as const;
const STATES = ["active", "inactive", "stopped", "terminated"] as const;

function StateBadge({ state }: { state?: string }) {
  if (!state) return <span className="text-gray-400">—</span>;
  const colors: Record<string, string> = {
    active: "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300",
    inactive: "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300",
    stopped: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300",
    terminated: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300",
  };
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
        colors[state] ?? "bg-gray-100 text-gray-600"
      }`}
    >
      {state}
    </span>
  );
}

function TagList({ tags }: { tags?: Record<string, string> }) {
  if (!tags || Object.keys(tags).length === 0)
    return <span className="text-gray-400">—</span>;
  return (
    <div className="flex flex-wrap gap-1">
      {Object.entries(tags)
        .slice(0, 3)
        .map(([k, v]) => (
          <span
            key={k}
            className="inline-flex items-center rounded bg-blue-50 px-1.5 py-0.5 text-xs text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
          >
            {k}={v}
          </span>
        ))}
      {Object.keys(tags).length > 3 && (
        <span className="text-xs text-gray-400">
          +{Object.keys(tags).length - 3}
        </span>
      )}
    </div>
  );
}

export default function ResourcesPage() {
  return (
    <Suspense fallback={<div className="p-8 text-sm text-gray-400">Loading…</div>}>
      <ResourcesContent />
    </Suspense>
  );
}

function ResourcesContent() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();

  const search = searchParams.get("search") ?? "";
  const type = searchParams.get("type") ?? "";
  const provider = searchParams.get("provider") ?? "";
  const state = searchParams.get("state") ?? "";
  const page = parseInt(searchParams.get("page") ?? "1", 10);

  const setParam = useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value) {
        params.set(key, value);
      } else {
        params.delete(key);
      }
      // Reset to page 1 when filters change (except when changing page)
      if (key !== "page") params.set("page", "1");
      startTransition(() => {
        router.push(`${pathname}?${params.toString()}`);
      });
    },
    [searchParams, pathname, router]
  );

  // Build query string for API
  const buildQueryString = () => {
    const p = new URLSearchParams();
    p.set("limit", String(PAGE_SIZE));
    p.set("offset", String((page - 1) * PAGE_SIZE));
    if (type) p.set("type", type);
    if (provider) p.set("provider", provider);
    if (state) p.set("state", state);
    return p.toString();
  };

  const { data, isLoading, isError } = useQuery({
    queryKey: ["resources", "list", search, type, provider, state, page],
    queryFn: () =>
      search
        ? searchResources(search, buildQueryString())
        : getResourcesPaged(buildQueryString()),
  });

  const totalPages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
          Resources
        </h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          {data ? `${data.total} resource${data.total !== 1 ? "s" : ""} found` : "Loading…"}
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        {/* Search */}
        <input
          type="search"
          placeholder="Search by name…"
          value={search}
          onChange={(e) => setParam("search", e.target.value)}
          className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
        />

        {/* Type filter */}
        <select
          value={type}
          onChange={(e) => setParam("type", e.target.value)}
          className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
        >
          <option value="">All types</option>
          {TYPES.map((t) => (
            <option key={t} value={t}>
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </option>
          ))}
        </select>

        {/* Provider filter */}
        <select
          value={provider}
          onChange={(e) => setParam("provider", e.target.value)}
          className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
        >
          <option value="">All providers</option>
          {PROVIDERS.map((p) => (
            <option key={p} value={p}>
              {p.toUpperCase()}
            </option>
          ))}
        </select>

        {/* State filter */}
        <select
          value={state}
          onChange={(e) => setParam("state", e.target.value)}
          className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
        >
          <option value="">All states</option>
          {STATES.map((s) => (
            <option key={s} value={s}>
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </option>
          ))}
        </select>

        {/* Clear filters */}
        {(search || type || provider || state) && (
          <button
            onClick={() => {
              startTransition(() => router.push(pathname));
            }}
            className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-600 shadow-sm hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
          >
            Clear filters
          </button>
        )}
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900">
        {isError ? (
          <div className="p-8 text-center text-sm text-red-500">
            Failed to load resources. Check API connectivity.
          </div>
        ) : (
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-800">
              <tr>
                {["Name", "Type", "Provider", "Region", "State", "Tags"].map(
                  (col) => (
                    <th
                      key={col}
                      className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400"
                    >
                      {col}
                    </th>
                  )
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>
                    {Array.from({ length: 6 }).map((_, j) => (
                      <td key={j} className="px-4 py-3">
                        <div className="h-4 w-24 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : data?.items.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-8 text-center text-sm text-gray-400"
                  >
                    No resources match the current filters.
                  </td>
                </tr>
              ) : (
                data?.items.map((resource: Resource) => (
                  <tr
                    key={resource.id}
                    onClick={() => router.push(`/resources/${resource.id}`)}
                    className="cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/60 transition-colors"
                  >
                    <td className="px-4 py-3">
                      <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                        {resource.name || resource.id}
                      </div>
                      <div className="text-xs text-gray-400 font-mono">
                        {resource.id}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
                      {resource.type}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold uppercase text-white"
                        style={{ backgroundColor: getProviderColor(resource.provider) }}
                      >
                        {getProviderLabel(resource.provider)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
                      {resource.region ?? "—"}
                    </td>
                    <td className="px-4 py-3">
                      <StateBadge state={resource.state} />
                    </td>
                    <td className="px-4 py-3">
                      <TagList tags={resource.tags} />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {!isLoading && !isError && totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-gray-600 dark:text-gray-400">
          <span>
            Page {page} of {totalPages}
          </span>
          <div className="flex gap-2">
            <button
              disabled={page <= 1}
              onClick={() => setParam("page", String(page - 1))}
              className="rounded-md border border-gray-300 px-3 py-1.5 text-sm disabled:opacity-40 hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-800"
            >
              Previous
            </button>
            <button
              disabled={page >= totalPages}
              onClick={() => setParam("page", String(page + 1))}
              className="rounded-md border border-gray-300 px-3 py-1.5 text-sm disabled:opacity-40 hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-800"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
