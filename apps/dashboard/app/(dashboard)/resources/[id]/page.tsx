"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
  getResource,
  getResourceDependencies,
  getResourceDependents,
  getResourceCost,
  getResourceSecurityFindings,
  Resource,
  SecurityFinding,
} from "../../../../lib/api";

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
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
        colors[state] ?? "bg-gray-100 text-gray-600"
      }`}
    >
      {state}
    </span>
  );
}

function SeverityBadge({ severity }: { severity: SecurityFinding["severity"] }) {
  const colors: Record<string, string> = {
    critical: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300",
    high: "bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300",
    medium: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300",
    low: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",
  };
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
        colors[severity] ?? "bg-gray-100 text-gray-600"
      }`}
    >
      {severity}
    </span>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-900">
      <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
        {title}
      </h2>
      {children}
    </div>
  );
}

function ResourceLink({ resource }: { resource: Resource }) {
  return (
    <Link
      href={`/resources/${resource.id}`}
      className="flex items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
    >
      <span className="font-medium text-blue-600 dark:text-blue-400">
        {resource.name || resource.id}
      </span>
      <span className="text-gray-400 text-xs">{resource.type}</span>
      <span className="text-gray-400 text-xs uppercase">{resource.provider}</span>
    </Link>
  );
}

function SkeletonBlock({ className = "" }: { className?: string }) {
  return (
    <div className={`animate-pulse rounded bg-gray-200 dark:bg-gray-700 ${className}`} />
  );
}

export default function ResourceDetailPage() {
  const { id } = useParams<{ id: string }>();

  const { data: resource, isLoading: loadingResource, isError: errorResource } = useQuery({
    queryKey: ["resource", id],
    queryFn: () => getResource(id),
    enabled: !!id,
  });

  const { data: depsData, isLoading: loadingDeps } = useQuery({
    queryKey: ["resource", id, "dependencies"],
    queryFn: () => getResourceDependencies(id),
    enabled: !!id,
  });

  const { data: dependentsData, isLoading: loadingDependents } = useQuery({
    queryKey: ["resource", id, "dependents"],
    queryFn: () => getResourceDependents(id),
    enabled: !!id,
  });

  const { data: costData, isLoading: loadingCost } = useQuery({
    queryKey: ["resource", id, "cost"],
    queryFn: () => getResourceCost(id),
    enabled: !!id,
  });

  const { data: findingsData, isLoading: loadingFindings } = useQuery({
    queryKey: ["resource", id, "findings"],
    queryFn: () => getResourceSecurityFindings(id),
    enabled: !!id,
  });

  const cost = costData?.items.find((c) => c.resourceId === id);
  const findings = findingsData?.items ?? [];
  const dependencies = depsData?.items ?? [];
  const dependents = dependentsData?.items ?? [];

  if (errorResource) {
    return (
      <div className="space-y-4">
        <Link
          href="/resources"
          className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
        >
          ← Back to Resources
        </Link>
        <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-center text-sm text-red-600 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400">
          Resource not found or failed to load.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Back button */}
      <Link
        href="/resources"
        className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
      >
        ← Back to Resources
      </Link>

      {/* Header */}
      <div className="rounded-lg border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-900">
        {loadingResource ? (
          <div className="space-y-2">
            <SkeletonBlock className="h-7 w-48" />
            <SkeletonBlock className="h-4 w-64" />
          </div>
        ) : (
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">
                {resource?.name || resource?.id}
              </h1>
              <p className="mt-1 font-mono text-xs text-gray-400">{resource?.id}</p>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
              <span className="rounded bg-gray-100 px-2 py-0.5 text-xs dark:bg-gray-800">
                {resource?.type}
              </span>
              <span className="rounded bg-gray-100 px-2 py-0.5 text-xs uppercase dark:bg-gray-800">
                {resource?.provider}
              </span>
              {resource?.region && (
                <span className="rounded bg-gray-100 px-2 py-0.5 text-xs dark:bg-gray-800">
                  {resource.region}
                </span>
              )}
              <StateBadge state={resource?.state} />
            </div>
          </div>
        )}
      </div>

      {/* Metadata */}
      <Section title="Metadata">
        {loadingResource ? (
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <SkeletonBlock key={i} className="h-4 w-full" />
            ))}
          </div>
        ) : (
          <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
            {[
              ["ID", resource?.id],
              ["Name", resource?.name],
              ["Type", resource?.type],
              ["Provider", resource?.provider?.toUpperCase()],
              ["Region", resource?.region ?? "—"],
              ["State", resource?.state ?? "—"],
            ].map(([label, value]) => (
              <div key={label} className="flex flex-col">
                <dt className="text-xs font-medium text-gray-500 dark:text-gray-400">{label}</dt>
                <dd className="mt-0.5 text-sm text-gray-900 dark:text-gray-100 font-mono break-all">
                  {value ?? "—"}
                </dd>
              </div>
            ))}
          </dl>
        )}
      </Section>

      {/* Tags */}
      <Section title="Tags">
        {loadingResource ? (
          <SkeletonBlock className="h-8 w-48" />
        ) : !resource?.tags || Object.keys(resource.tags).length === 0 ? (
          <p className="text-sm text-gray-400">No tags.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {Object.entries(resource.tags).map(([k, v]) => (
              <span
                key={k}
                className="inline-flex items-center rounded bg-blue-50 px-2 py-1 text-xs text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
              >
                {k}={v}
              </span>
            ))}
          </div>
        )}
      </Section>

      {/* Relationships */}
      <Section title="Relationships">
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          <div>
            <h3 className="mb-2 text-xs font-semibold text-gray-500 dark:text-gray-400">
              Dependencies ({loadingDeps ? "…" : dependencies.length})
            </h3>
            {loadingDeps ? (
              <div className="space-y-1">
                {Array.from({ length: 2 }).map((_, i) => (
                  <SkeletonBlock key={i} className="h-8 w-full" />
                ))}
              </div>
            ) : dependencies.length === 0 ? (
              <p className="text-sm text-gray-400">No dependencies.</p>
            ) : (
              <div className="divide-y divide-gray-100 dark:divide-gray-800">
                {dependencies.map((r) => (
                  <ResourceLink key={r.id} resource={r} />
                ))}
              </div>
            )}
          </div>
          <div>
            <h3 className="mb-2 text-xs font-semibold text-gray-500 dark:text-gray-400">
              Dependents ({loadingDependents ? "…" : dependents.length})
            </h3>
            {loadingDependents ? (
              <div className="space-y-1">
                {Array.from({ length: 2 }).map((_, i) => (
                  <SkeletonBlock key={i} className="h-8 w-full" />
                ))}
              </div>
            ) : dependents.length === 0 ? (
              <p className="text-sm text-gray-400">No dependents.</p>
            ) : (
              <div className="divide-y divide-gray-100 dark:divide-gray-800">
                {dependents.map((r) => (
                  <ResourceLink key={r.id} resource={r} />
                ))}
              </div>
            )}
          </div>
        </div>
      </Section>

      {/* Cost */}
      <Section title="Cost">
        {loadingCost ? (
          <SkeletonBlock className="h-8 w-32" />
        ) : !cost ? (
          <p className="text-sm text-gray-400">No cost data available.</p>
        ) : (
          <p className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
            {cost.currency}{" "}
            {cost.monthlyCost.toLocaleString(undefined, {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
            <span className="ml-1 text-sm font-normal text-gray-500 dark:text-gray-400">
              / month
            </span>
          </p>
        )}
      </Section>

      {/* Security Findings */}
      <Section title="Security Findings">
        {loadingFindings ? (
          <div className="space-y-2">
            {Array.from({ length: 2 }).map((_, i) => (
              <SkeletonBlock key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : findings.length === 0 ? (
          <p className="text-sm text-gray-400">No security findings.</p>
        ) : (
          <ul className="divide-y divide-gray-100 dark:divide-gray-800">
            {findings.map((f) => (
              <li key={f.id} className="py-3">
                <div className="flex items-start gap-3">
                  <SeverityBadge severity={f.severity} />
                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                      {f.title}
                    </p>
                    {f.description && (
                      <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                        {f.description}
                      </p>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </div>
  );
}
