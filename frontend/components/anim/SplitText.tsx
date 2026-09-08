"use client";

import * as React from "react";
import { animate, stagger } from "animejs";
import { prefersReducedMotion } from "@/lib/motion";
import { cn } from "@/lib/utils";

/**
 * Splits text into per-word spans and lifts them in on mount. Words (not
 * characters) keep the hero readable to screen readers and keep the DOM small;
 * the original string is exposed via aria-label.
 */
export function SplitText({
  text,
  className,
  wordClassName,
  delay = 0,
  as: Tag = "span",
}: {
  text: string;
  className?: string;
  wordClassName?: string;
  delay?: number;
  as?: "span" | "h1" | "h2" | "p";
}) {
  const ref = React.useRef<HTMLElement | null>(null);
  const words = React.useMemo(() => text.split(" "), [text]);

  React.useEffect(() => {
    const root = ref.current;
    if (!root) return;
    const targets = Array.from(root.querySelectorAll<HTMLElement>("[data-word]"));
    if (targets.length === 0) return;

    if (prefersReducedMotion()) {
      targets.forEach((t) => {
        t.style.opacity = "1";
        t.style.transform = "none";
      });
      return;
    }

    const animation = animate(targets, {
      opacity: [0, 1],
      translateY: ["0.62em", "0em"],
      rotate: [4, 0],
      filter: ["blur(6px)", "blur(0px)"],
      duration: 880,
      delay: stagger(62, { start: delay }),
      ease: "out(3)",
    });
    return () => {
      animation.pause();
    };
  }, [words, delay]);

  return (
    <Tag
      ref={ref as React.Ref<never>}
      aria-label={text}
      className={cn("inline-block", className)}
    >
      {words.map((word, index) => (
        <span
          key={`${word}-${index}`}
          aria-hidden
          className="inline-block overflow-hidden align-bottom"
        >
          <span
            data-word
            className={cn("inline-block opacity-0 will-change-transform", wordClassName)}
          >
            {word}
          </span>
          {index < words.length - 1 ? <span className="inline-block">&nbsp;</span> : null}
        </span>
      ))}
    </Tag>
  );
}
