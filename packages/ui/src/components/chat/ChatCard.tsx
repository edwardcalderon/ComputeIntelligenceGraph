import React from "react";

interface ChatCardProps {
  children: React.ReactNode;
  /** Renders the card with a red border (blocked/error state) */
  blocked?: boolean;
  className?: string;
}

/**
 * Base wrapper for all CIGBot bot response cards.
 * Applies the TG-style border radius: sharp top-left, rounded on all other corners.
 */
export function ChatCard({ children, blocked = false, className }: ChatCardProps) {
  return (
    <div
      className={`self-start max-w-[98%] overflow-hidden${className ? ` ${className}` : ""}`}
      style={{
        background: "#ffffff",
        borderRadius: "3px 16px 16px 16px",
        border: `1px solid ${blocked ? "#E24B4A" : "#e8e4f8"}`,
      }}
    >
      {children}
    </div>
  );
}
