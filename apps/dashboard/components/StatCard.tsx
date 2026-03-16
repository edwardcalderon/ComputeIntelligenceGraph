interface StatCardProps {
  label: string;
  value: string | number;
  sub?: string;
  loading?: boolean;
}

export function StatCard({ label, value, sub, loading }: StatCardProps) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900">
      <p className="text-sm text-gray-500 dark:text-gray-400">{label}</p>
      {loading ? (
        <div className="mt-1 h-8 w-16 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
      ) : (
        <p className="mt-1 text-2xl font-semibold text-gray-900 dark:text-gray-100">
          {value}
        </p>
      )}
      {sub && (
        <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">{sub}</p>
      )}
    </div>
  );
}
