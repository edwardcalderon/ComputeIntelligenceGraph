"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "@cig-technology/i18n/react";
import { StatCard } from "../../../components/StatCard";
import {
  getSecurityFindings,
  getSecurityScore,
  SecurityFinding,
  SecurityScore,
  SecurityFindingsResponse,
} from "../../../lib/api";

// ── Severity helpers ──────────────────────────────────────────────────────────

const SEVERITY_COLORS: Record<string, string> = {
  critical: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400",
  high: "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-400",
  medium: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-400",
  low: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400",
};

const STATUS_COLORS: Record<string, string> = {
  open: "bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400",
  acknowledged: "bg-yellow-50 text-yellow-600 dark:bg-yellow-900/20 dark:text-yellow-400",
  resolved: "bg-green-50 text-green-600 dark:bg-green-900/20 dark:text-green-400",
  "false-positive": "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400",
};

const CATEGORIES = ["all", "public-access", "encryption", "iam", "network"] as const;
type Category = (typeof CATEGORIES)[number];

function SeverityBadge({ severity }: { severity: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold capitalize ${
        SEVERITY_COLORS[severity] ?? "bg-gray-100 text-gray-600"
      }`}
    >
      {severity}
    </span>
  );
}

function StatusBadge({ status }: { status?: string }) {
  if (!status) return <span className="text-xs text-gray-400">—</span>;
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium capitalize ${
        STATUS_COLORS[status] ?? "bg-gray-100 text-gray-500"
      }`}
    >
      {status.replace("-", " ")}
    </span>
  );
}

// ── Grade display ─────────────────────────────────────────────────────────────

function gradeColor(grade: string): string {
  if (grade === "A") return "text-green-500";
  if (grade === "B") return "text-lime-500";
  if (grade === "C") return "text-yellow-500";
  if (grade === "D") return "text-orange-500";
  return "text-red-500";
}

function ScorePanel({
  score,
  loading,
}: {
  score: SecurityScore | undefined;
  loading: boolean;
}) {
  const t = useTranslation();
  return (
    <div className="flex items-center gap-6 rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-900">
      {loading ? (
        <div className="h-20 w-20 animate-pulse rounded-full bg-gray-200 dark:bg-gray-700" />
      ) : (
        <div className="flex flex-col items-center">
          <span
            className={`text-6xl font-extrabold leading-none ${gradeColor(
              score?.grade ?? "F"
            )}`}
          >
            {score?.grade ?? "—"}
          </span>
          <span className="mt-1 text-xs text-gray-400 dark:text-gray-500">{t("security.grade")}</span>
        </div>
      )}
      <div className="flex-1">
        {loading ? (
          <div className="space-y-2">
            <div className="h-6 w-32 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
            <div className="h-4 w-48 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
          </div>
        ) : (
          <>
            <p className="text-3xl font-bold text-gray-900 dark:text-gray-100">
              {score?.score ?? 0}
              <span className="ml-1 text-base font-normal text-gray-400">
                / {score?.maxScore ?? 100}
              </span>
            </p>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              {t("security.score")}
            </p>
          </>
        )}
      </div>
    </div>
  );
}

// ── Findings table ────────────────────────────────────────────────────────────

function FindingsTable({
  findings,
  loading,
}: {
  findings: SecurityFinding[];
  loading: boolean;
}) {
  const t = useTranslation();
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (loading) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-900 space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-4 w-full animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
        ))}
      </div>
    );
  }

  if (findings.length === 0) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-8 text-center dark:border-gray-700 dark:bg-gray-900">
        <p className="text-sm text-gray-400 dark:text-gray-500">{t("security.noFindings")}</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900">
      <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
        <thead className="bg-gray-50 dark:bg-gray-800">
          <tr>
            {[t("security.colSeverity"), t("security.colTitle"), t("security.colResource"), t("security.colCategory"), t("security.colStatus"), ""].map((col) => (
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
          {findings.map((f) => (
            <>
              <tr
                key={f.id}
                className="hover:bg-gray-50 dark:hover:bg-gray-800/60 cursor-pointer"
                onClick={() => setExpandedId(expandedId === f.id ? null : f.id)}
              >
                <td className="px-4 py-3">
                  <SeverityBadge severity={f.severity} />
                </td>
                <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-gray-100">
                  {f.title}
                </td>
                <td className="px-4 py-3 text-xs font-mono text-gray-500 dark:text-gray-400 max-w-[160px] truncate">
                  {f.resourceId}
                </td>
                <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300 capitalize">
                  {f.category?.replace("-", " ") ?? "—"}
                </td>
                <td className="px-4 py-3">
                  <StatusBadge status={f.status} />
                </td>
                <td className="px-4 py-3 text-right text-xs text-gray-400">
                  {expandedId === f.id ? "▲" : "▼"}
                </td>
              </tr>
              {expandedId === f.id && (
                <tr key={`${f.id}-detail`} className="bg-gray-50 dark:bg-gray-800/40">
                  <td colSpan={6} className="px-6 py-4">
                    <div className="space-y-3 text-sm">
                      <div>
                        <p className="font-semibold text-gray-700 dark:text-gray-300">{t("security.description")}</p>
                        <p className="mt-1 text-gray-600 dark:text-gray-400">{f.description}</p>
                      </div>
                      {f.remediationSteps && (
                        <div>
                          <p className="font-semibold text-gray-700 dark:text-gray-300">
                            {t("security.remediationSteps")}
                          </p>
                          <p className="mt-1 text-gray-600 dark:text-gray-400 whitespace-pre-line">
                            {f.remediationSteps}
                          </p>
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
              )}
            </>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function SecurityPage() {
  const t = useTranslation();
  const [activeCategory, setActiveCategory] = useState<Category>("all");

  const {
    data: scoreData,
    isLoading: scoreLoading,
    isError: scoreError,
  } = useQuery<SecurityScore>({
    queryKey: ["security", "score"],
    queryFn: getSecurityScore,
    staleTime: 5 * 60 * 1000,
  });

  const {
    data: findingsData,
    isLoading: findingsLoading,
    isError: findingsError,
  } = useQuery<SecurityFindingsResponse>({
    queryKey: ["security", "findings"],
    queryFn: () => getSecurityFindings(),
    staleTime: 5 * 60 * 1000,
  });

  const allFindings: SecurityFinding[] =
    findingsData?.findings ?? findingsData?.items ?? [];

  const filtered =
    activeCategory === "all"
      ? allFindings
      : allFindings.filter((f) => f.category === activeCategory);

  const bySeverity = scoreData?.findingsBySeverity ?? {
    critical: allFindings.filter((f) => f.severity === "critical").length,
    high: allFindings.filter((f) => f.severity === "high").length,
    medium: allFindings.filter((f) => f.severity === "medium").length,
    low: allFindings.filter((f) => f.severity === "low").length,
  };

  const isError = scoreError || findingsError;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{t("security.title")}</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          {t("security.subtitle")}
        </p>
      </div>

      {isError && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-600 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400">
          {t("security.failedToLoad")}
        </div>
      )}

      {/* Score */}
      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
          {t("security.securityScore")}
        </h2>
        <ScorePanel score={scoreData} loading={scoreLoading} />
      </section>

      {/* Findings by severity */}
      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
          {t("security.findingsBySeverity")}
        </h2>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <StatCard
            label={t("security.critical")}
            value={bySeverity.critical}
            loading={scoreLoading && findingsLoading}
          />
          <StatCard
            label={t("security.high")}
            value={bySeverity.high}
            loading={scoreLoading && findingsLoading}
          />
          <StatCard
            label={t("security.medium")}
            value={bySeverity.medium}
            loading={scoreLoading && findingsLoading}
          />
          <StatCard
            label={t("security.low")}
            value={bySeverity.low}
            loading={scoreLoading && findingsLoading}
          />
        </div>
      </section>

      {/* Findings list */}
      <section>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
            {t("security.findings")}
          </h2>
          {/* Category filter */}
          <div className="flex flex-wrap gap-1">
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`rounded-full px-3 py-1 text-xs font-medium capitalize transition-colors ${
                  activeCategory === cat
                    ? "bg-indigo-600 text-white"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
                }`}
              >
                {cat === "all" ? t("security.all") : cat.replace("-", " ")}
              </button>
            ))}
          </div>
        </div>
        <FindingsTable findings={filtered} loading={findingsLoading} />
      </section>
    </div>
  );
}
