"use client";

import * as React from "react";
import * as ProgressPrimitive from "@radix-ui/react-progress";
import { cn } from "@/lib/utils";

const Progress = React.forwardRef<
  React.ElementRef<typeof ProgressPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof ProgressPrimitive.Root> & {
    /** Renders a travelling highlight for work with no known end time. */
    indeterminate?: boolean;
    tone?: "primary" | "success" | "danger" | "accent";
  }
>(({ className, value, indeterminate, tone = "primary", ...props }, ref) => {
  const fill = {
    primary: "bg-primary",
    success: "bg-success",
    danger: "bg-danger",
    accent: "bg-accent",
  }[tone];

  return (
    <ProgressPrimitive.Root
      ref={ref}
      value={indeterminate ? null : value}
      className={cn("relative h-1.5 w-full overflow-hidden rounded-full bg-muted", className)}
      {...props}
    >
      {indeterminate ? (
        <div
          className={cn("h-full w-2/5 rounded-full", fill)}
          style={{ animation: "indeterminate 1.35s cubic-bezier(0.65,0,0.35,1) infinite" }}
        />
      ) : (
        <ProgressPrimitive.Indicator
          className={cn("h-full w-full rounded-full transition-transform duration-500 ease-out", fill)}
          style={{ transform: `translateX(-${100 - (value ?? 0)}%)` }}
        />
      )}
    </ProgressPrimitive.Root>
  );
});
Progress.displayName = ProgressPrimitive.Root.displayName;

export { Progress };
