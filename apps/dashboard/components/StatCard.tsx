interface StatCardProps {
  label: string;
  value: string | number;
  sub?: string;
  loading?: boolean;
  color?: string;
}

export function StatCard({ label, value, sub, loading, color }: StatCardProps) {
  return (
    <div className="relative rounded-xl border border-cig bg-cig-card p-4 overflow-hidden transition-colors hover:border-cig-accent">
      {/* Subtle top glow line — dark mode only */}
      {color && (
        <div
          className="absolute top-0 left-4 right-4 h-px pointer-events-none hidden dark:block"
          style={{ background: `linear-gradient(90deg, transparent, ${color}40, transparent)` }}
        />
      )}
      {/* Light mode accent dot */}
      {color && (
        <div className="absolute top-3 right-3 size-2 rounded-full dark:hidden" style={{ backgroundColor: color, opacity: 0.4 }} />
      )}
      <p className="text-[11px] font-medium uppercase tracking-wider text-cig-muted">{label}</p>
      {loading ? (
        <div className="mt-2 h-7 w-20 animate-pulse rounded-md bg-slate-200 dark:bg-white/[0.06]" />
      ) : (
        <p className="mt-1 text-2xl font-semibold text-cig-primary tracking-tight">
          {value}
        </p>
      )}
      {sub && (
        <p className="mt-1 text-[10px] text-cig-muted">{sub}</p>
      )}
    </div>
  );
}
