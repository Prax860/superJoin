import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[10.5px] font-semibold uppercase tracking-[0.08em] transition-colors [&_svg]:size-3",
  {
    variants: {
      tone: {
        neutral: "border-transparent bg-neutral-soft text-neutral",
        success: "border-transparent bg-success-soft text-success",
        danger: "border-transparent bg-danger-soft text-danger",
        info: "border-transparent bg-info-soft text-info",
        accent: "border-transparent bg-accent/18 text-accent-foreground dark:text-accent",
        outline: "border-border bg-transparent text-muted-foreground",
      },
    },
    defaultVariants: { tone: "neutral" },
  },
);

export type BadgeTone = NonNullable<VariantProps<typeof badgeVariants>["tone"]>;

export function Badge({
  className,
  tone,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ tone }), className)} {...props} />;
}

/** Maps a relationship / verification label onto a badge tone. */
export const toneForRelationship: Record<string, BadgeTone> = {
  CORROBORATES: "success",
  CONTRADICTS: "danger",
  RECONCILES: "info",
  UNCERTAIN: "neutral",
};

export { badgeVariants };
