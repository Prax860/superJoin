import { cn } from "@/lib/utils";

/**
 * Rendered as a <span> (display:block) rather than a <div> so it stays valid
 * phrasing content — skeletons often sit inside <p>/<dd> value slots, and a
 * <div> there is invalid HTML that breaks hydration.
 */
export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLSpanElement>) {
  return <span className={cn("skeleton block rounded-md", className)} {...props} />;
}
