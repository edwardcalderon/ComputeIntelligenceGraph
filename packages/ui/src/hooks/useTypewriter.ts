import { useEffect, useRef, useState } from "react";

interface UseTypewriterOptions {
  /** Milliseconds before the first character appears (default: 260) */
  delay?: number;
  /** Milliseconds between each character (default: 14) */
  speed?: number;
}

interface UseTypewriterResult {
  /** The currently displayed text */
  typed: string;
  /** True once the full text has been typed */
  done: boolean;
}

/**
 * Types `text` character by character when `active` is true.
 * Resets immediately when `active` becomes false.
 *
 * @example
 * const { typed, done } = useTypewriter(feature.description, isHovered);
 */
export function useTypewriter(
  text: string,
  active: boolean,
  { delay = 260, speed = 14 }: UseTypewriterOptions = {}
): UseTypewriterResult {
  const [typed, setTyped] = useState("");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);

    if (!active) {
      setTyped("");
      return;
    }

    let i = 0;
    const tick = () => {
      i++;
      setTyped(text.slice(0, i));
      if (i < text.length) {
        timer.current = setTimeout(tick, speed);
      }
    };
    timer.current = setTimeout(tick, delay);

    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [active, text, delay, speed]);

  return { typed, done: typed.length === text.length };
}
