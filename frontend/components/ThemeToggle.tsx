"use client";

import * as React from "react";
import { useTheme } from "next-themes";
import { Moon, Sun } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { prefersReducedMotion } from "@/lib/motion";
import { cn } from "@/lib/utils";

type ViewTransitionDocument = Document & {
  startViewTransition?: (callback: () => void) => { ready: Promise<void> };
};

/**
 * Theme switch. Where the View Transitions API is available the new theme is
 * revealed with a circular wipe originating at the button; elsewhere it just
 * swaps. Renders a stable placeholder until mounted so SSR and client markup
 * agree (next-themes cannot know the theme on the server).
 */
export function ThemeToggle({ className }: { className?: string }) {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);
  const buttonRef = React.useRef<HTMLButtonElement | null>(null);

  React.useEffect(() => setMounted(true), []);

  const isDark = resolvedTheme === "dark";

  const toggle = React.useCallback(() => {
    const next = isDark ? "light" : "dark";
    const doc = document as ViewTransitionDocument;

    if (!doc.startViewTransition || prefersReducedMotion()) {
      setTheme(next);
      return;
    }

    const rect = buttonRef.current?.getBoundingClientRect();
    const x = rect ? rect.left + rect.width / 2 : window.innerWidth / 2;
    const y = rect ? rect.top + rect.height / 2 : 0;
    const radius = Math.hypot(
      Math.max(x, window.innerWidth - x),
      Math.max(y, window.innerHeight - y),
    );

    const transition = doc.startViewTransition(() => setTheme(next));
    transition.ready.then(() => {
      document.documentElement.animate(
        {
          clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${radius}px at ${x}px ${y}px)`],
        },
        {
          duration: 620,
          easing: "cubic-bezier(0.22, 1, 0.36, 1)",
          pseudoElement: "::view-transition-new(root)",
        },
      );
    });
  }, [isDark, setTheme]);

  const base = cn(
    "relative grid size-9 place-items-center rounded-full border border-border bg-card/70 text-muted-foreground",
    "transition-colors duration-200 hover:border-primary/45 hover:text-foreground",
    className,
  );

  if (!mounted) {
    return <span className={base} aria-hidden />;
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          ref={buttonRef}
          type="button"
          onClick={toggle}
          className={base}
          aria-label={`Switch to ${isDark ? "light" : "dark"} theme`}
        >
          <Sun
            className={cn(
              "absolute size-4 transition-all duration-400 ease-out",
              isDark ? "rotate-90 scale-0 opacity-0" : "rotate-0 scale-100 opacity-100",
            )}
          />
          <Moon
            className={cn(
              "absolute size-4 transition-all duration-400 ease-out",
              isDark ? "rotate-0 scale-100 opacity-100" : "-rotate-90 scale-0 opacity-0",
            )}
          />
        </button>
      </TooltipTrigger>
      <TooltipContent>{isDark ? "Light mode" : "Dark mode"}</TooltipContent>
    </Tooltip>
  );
}
