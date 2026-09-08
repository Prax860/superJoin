"use client";

import * as React from "react";
import { animate, utils } from "animejs";
import { prefersReducedMotion } from "@/lib/motion";
import { cn } from "@/lib/utils";

/**
 * Counts from the previously rendered value up to `value` with anime.js, but
 * only once the element has scrolled into view — metrics further down the page
 * should tick when the reader reaches them, not while off screen.
 */
export function AnimatedNumber({
  value,
  duration = 1100,
  className,
}: {
  value: number;
  duration?: number;
  className?: string;
}) {
  const ref = React.useRef<HTMLSpanElement | null>(null);
  const from = React.useRef(0);
  const [armed, setArmed] = React.useState(false);

  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setArmed(true);
          observer.disconnect();
        }
      },
      { threshold: 0.2 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  React.useEffect(() => {
    const el = ref.current;
    if (!el || !armed) return;

    if (prefersReducedMotion()) {
      el.textContent = value.toLocaleString();
      from.current = value;
      return;
    }

    const state = { n: from.current };
    const animation = animate(state, {
      n: value,
      duration,
      ease: "out(4)",
      onUpdate: () => {
        el.textContent = utils.round(state.n, 0).toLocaleString();
      },
    });
    from.current = value;
    return () => {
      animation.pause();
    };
  }, [value, duration, armed]);

  return (
    <span ref={ref} className={cn("tabular-nums", className)}>
      0
    </span>
  );
}
