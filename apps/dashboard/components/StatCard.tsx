interface StatCardProps {
  label: string;
  value: string | number;
  sub?: string;
  loading?: boolean;
  color?: string; // optional accent color for glow
}

export function StatCard({ label, value, sub, loading, color }: StatCardProps) {
  return (
    <div
      className="relative rounded-xl border border-white/[0.06] bg-[#0a1628]/80 p-4 backdrop-blur-sm overflow-hidden transition-colors hover:border-white/[0.1] hover:bg-[#0a1628]"
      style={color ? {
        boxShadow: `inset 0 1px 0 rgba(255,255,255,0.03), 0 0 0 0.5px ${color}18`,
      } : {
        boxShadow: "inset 0 1px 0 rgba(255,255,255,0.03)",
      }}
    >
      {/* Subtle top glow line */}
      {color && (
        <div
          className="absolute top-0 left-4 right-4 h-px pointer-events-none"
          style={{ background: `linear-gradient(90deg, transparent, ${color}40, transparent)` }}
        />
      )}
      <p className="text-[11px] font-medium uppercase tracking-wider text-white/35">{label}</p>
      {loading ? (
        <div className="mt-2 h-7 w-20 animate-pulse rounded-md bg-white/[0.06]" />
      ) : (
        <p className="mt-1 text-2xl font-semibold text-white/90 tracking-tight">
          {value}
        </p>
      )}
      {sub && (
        <p className="mt-1 text-[10px] text-white/25">{sub}</p>
      )}
    </div>
  );
}
