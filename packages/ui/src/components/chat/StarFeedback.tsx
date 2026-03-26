"use client";

import React, { useState } from "react";

type StarFeedbackVariant = "default" | "red";

interface StarFeedbackProps {
  question?: string;
  onRate?: (rating: number) => void;
  variant?: StarFeedbackVariant;
}

export function StarFeedback({
  question = "¿Qué tan útil fue?",
  onRate,
  variant = "default",
}: StarFeedbackProps) {
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);

  const bg = variant === "red" ? "#FCEBEB" : "#faf9ff";
  const borderColor = variant === "red" ? "#FCEBEB" : "#EEEDFE";
  const qColor = variant === "red" ? "#791F1F" : "#888";

  function handleClick(star: number) {
    setRating(star);
    onRate?.(star);
  }

  return (
    <div
      className="flex items-center gap-2 px-3 py-1.5 border-t"
      style={{ background: bg, borderColor }}
    >
      <span className="flex-1 text-[10px]" style={{ color: qColor }}>
        {question}
      </span>
      {/* rtl so hover-siblings selector works left-to-right visually */}
      <div className="flex" style={{ direction: "rtl" }}>
        {[5, 4, 3, 2, 1].map((star) => (
          <button
            key={star}
            type="button"
            className="text-base leading-none transition-colors duration-100"
            style={{ color: star <= (hover || rating) ? "#EF9F27" : "#d4ccf0" }}
            onMouseEnter={() => setHover(star)}
            onMouseLeave={() => setHover(0)}
            onClick={() => handleClick(star)}
            aria-label={`${star} star${star > 1 ? "s" : ""}`}
          >
            ★
          </button>
        ))}
      </div>
    </div>
  );
}
