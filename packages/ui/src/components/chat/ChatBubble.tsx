import React from "react";

// ─── User bubble ─────────────────────────────────────────────────────────────

interface UserBubbleProps {
  children: React.ReactNode;
  /** true = ✓✓ (processed), false = ✓ (sent, awaiting) */
  processed?: boolean;
}

export function UserBubble({ children, processed = true }: UserBubbleProps) {
  return (
    <div className="self-end max-w-[82%]">
      <div
        className="px-3 py-2 text-[12.5px] leading-relaxed text-white"
        style={{
          background: "#6C3DE8",
          borderRadius: "16px 16px 3px 16px",
        }}
      >
        {children}
        <span className="ml-1.5 text-[10px]" style={{ color: processed ? "#a8d5ff" : "#d4c8ff" }}>
          {processed ? "✓✓" : "✓"}
        </span>
      </div>
    </div>
  );
}

// ─── Date separator pill ─────────────────────────────────────────────────────

interface DateSeparatorProps {
  label: string;
}

export function DateSeparator({ label }: DateSeparatorProps) {
  return (
    <div
      className="self-center px-2.5 py-0.5 rounded-full text-[10px] font-medium"
      style={{ background: "rgba(108,61,232,0.15)", color: "#3C3489" }}
    >
      {label}
    </div>
  );
}

// ─── Message timestamp ────────────────────────────────────────────────────────

interface TimestampProps {
  children: React.ReactNode;
}

export function Timestamp({ children }: TimestampProps) {
  return (
    <div className="self-start pl-1 text-[10px]" style={{ color: "#b0a8d0" }}>
      {children}
    </div>
  );
}
