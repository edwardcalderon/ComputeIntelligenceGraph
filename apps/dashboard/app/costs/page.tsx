"use client";

import { useQuery } from "@tanstack/react-query";
import { StatCard } from "../../components/StatCard";
import {
  getCostSummary,
  CostSummary,
  CostBreakdownEntry,
  ResourceCostEntry,
} from "../../lib/api";

function fmt(amount: number, currency: string): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency || "USD",
    maximumFractionDigits: 2,
  }).format(amount);
}

function BreakdownTable({
  title,
  rows,
  currency,
  loading,
}: {
  title: string;
  rows: CostBreakdownEntry[];
  currency: string;
  loading: boolean;
}) {
  return (
    <section>
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
        {title}
      </h2>
      <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900">
        {loading ? (
          <div className="p-6 space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-4 w-full animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <p className="p-6 text-sm text-gray-400 dark:text-gray-500">No data available.</p>
        ) : (
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-800">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                  Name
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                  Monthly Cost
                </th>
                {rows.some((r) => r.percentage != null) && (
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                    %
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {rows.map((row) => (
                <tr key={row.name} className="hover:bg-gray-50 dark:hover:bg-gray-800/60">
                  <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">{row.name}</td>
                  <td className="px-4 py-3 text-right text-sm font-medium text-gray-900 dark:text-gray-100">
                    {fmt(row.amount, row.currency || currency)}
                  </td>
                  {rows.some((r) => r.percentage != null) && (
                    <td className="px-4 py-3 text-right text-sm text-gray-500 dark:text-gray-400">
                      {row.percentage != null ? `${row.percentage.toFixed(1)}%` : "—"}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}

function TopResourcesTable({
  resources,
  currency,
  loading,
}: {
  resources: ResourceCostEntry[];
  currency: string;
  loading: boolean;
}) {
  const top10 = [...resources].sort((a, b) => b.amount - a.amount).slice(0, 10);

  return (
    <section>
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
        Top 10 Most Expensive Resources
      </h2>
      <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900">
        {loading ? (
          <div className="p-6 space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-4 w-full animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
            ))}
          </div>
        ) : top10.length === 0 ? (
          <p className="p-6 text-sm text-gray-400 dark:text-gray-500">No resource cost data available.</p>
        ) : (
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-800">
              <tr>
                {["#", "Resource", "Type", "Region", "Monthly Cost"].map((col) => (
                  <th
                    key={col}
                    className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400"
                  >
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {top10.map((r, i) => (
                <tr key={r.resourceId} className="hover:bg-gray-50 dark:hover:bg-gray-800/60">
                  <td className="px-4 py-3 text-sm text-gray-400 dark:text-gray-500">{i + 1}</td>
                  <td className="px-4 py-3">
                    <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                      {r.resourceName || r.resourceId}
                    </div>
                    {r.resourceName && (
                      <div className="text-xs font-mono text-gray-400">{r.resourceId}</div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">{r.type ?? "—"}</td>
                  <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">{r.region ?? "—"}</td>
                  <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-gray-100">
                    {fmt(r.amount, r.currency || currency)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}

export default function CostsPage() {
  const { data, isLoading, isError } = useQuery<CostSummary>({
    queryKey: ["costs", "summary"],
    queryFn: getCostSummary,
    staleTime: 5 * 60 * 1000,
  });

  const currency = data?.currency ?? "USD";

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Costs</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Monthly infrastructure cost breakdown
        </p>
      </div>

      {isError && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-600 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400">
          Failed to load cost data. Check API connectivity.
        </div>
      )}

      {/* Total monthly cost */}
      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
          Total Monthly Cost
        </h2>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <StatCard
            label="Total this month"
            value={data ? fmt(data.totalMonthlyCost, currency) : "—"}
            loading={isLoading}
          />
        </div>
      </section>

      {/* Cost trends */}
      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
          Cost Trends
        </h2>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          {(["7d", "30d", "90d"] as const).map((period) => {
            const trend = data?.trends?.[period];
            return (
              <StatCard
                key={period}
                label={`Last ${period}`}
                value={trend ? fmt(trend.total, trend.currency || currency) : "—"}
                sub={
                  trend?.change != null
                    ? `${trend.change >= 0 ? "+" : ""}${trend.change.toFixed(1)}% vs prior period`
                    : undefined
                }
                loading={isLoading}
              />
            );
          })}
        </div>
      </section>

      {/* By type */}
      <BreakdownTable
        title="By Resource Type"
        rows={data?.breakdown?.byType ?? []}
        currency={currency}
        loading={isLoading}
      />

      {/* By region */}
      <BreakdownTable
        title="By Region"
        rows={data?.breakdown?.byRegion ?? []}
        currency={currency}
        loading={isLoading}
      />

      {/* By tag */}
      {(isLoading || (data?.breakdown?.byTag?.length ?? 0) > 0) && (
        <BreakdownTable
          title="By Tag"
          rows={data?.breakdown?.byTag ?? []}
          currency={currency}
          loading={isLoading}
        />
      )}

      {/* Top 10 resources */}
      <TopResourcesTable
        resources={data?.resourceCosts ?? []}
        currency={currency}
        loading={isLoading}
      />
    </div>
  );
}
