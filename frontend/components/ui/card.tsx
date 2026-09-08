"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Card tracks the pointer and exposes it as --mx/--my so children can paint a
 * spotlight that follows the cursor. Tracking only runs while hovered.
 */
const Card = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & { spotlight?: boolean }
>(({ className, spotlight = true, onMouseMove, ...props }, ref) => {
  const handleMove = React.useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      if (spotlight) {
        const rect = event.currentTarget.getBoundingClientRect();
        event.currentTarget.style.setProperty("--mx", `${event.clientX - rect.left}px`);
        event.currentTarget.style.setProperty("--my", `${event.clientY - rect.top}px`);
      }
      onMouseMove?.(event);
    },
    [spotlight, onMouseMove],
  );

  return (
    <div
      ref={ref}
      onMouseMove={handleMove}
      className={cn(
        "group/card relative overflow-hidden rounded-xl border border-card-border bg-card text-card-foreground elevate",
        "transition-[transform,box-shadow,border-color] duration-300 ease-out",
        spotlight &&
          "before:pointer-events-none before:absolute before:inset-0 before:opacity-0 before:transition-opacity before:duration-300 hover:before:opacity-100 before:bg-[radial-gradient(320px_circle_at_var(--mx,50%)_var(--my,50%),color-mix(in_oklch,var(--primary)_11%,transparent),transparent_65%)]",
        className,
      )}
      {...props}
    />
  );
});
Card.displayName = "Card";

const CardHeader = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("relative z-10 flex flex-col gap-1.5 p-5", className)} {...props} />
  ),
);
CardHeader.displayName = "CardHeader";

const CardTitle = React.forwardRef<HTMLHeadingElement, React.HTMLAttributes<HTMLHeadingElement>>(
  ({ className, ...props }, ref) => (
    <h3
      ref={ref}
      className={cn("font-display text-lg leading-tight tracking-tight", className)}
      {...props}
    />
  ),
);
CardTitle.displayName = "CardTitle";

const CardDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p ref={ref} className={cn("text-[13px] leading-relaxed text-muted-foreground", className)} {...props} />
));
CardDescription.displayName = "CardDescription";

const CardContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("relative z-10 p-5 pt-0", className)} {...props} />
  ),
);
CardContent.displayName = "CardContent";

const CardFooter = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("relative z-10 flex items-center p-5 pt-0", className)} {...props} />
  ),
);
CardFooter.displayName = "CardFooter";

export { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter };
