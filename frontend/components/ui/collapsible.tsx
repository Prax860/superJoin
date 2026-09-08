"use client";

import * as CollapsiblePrimitive from "@radix-ui/react-collapsible";
import * as React from "react";
import { cn } from "@/lib/utils";

const Collapsible = CollapsiblePrimitive.Root;
const CollapsibleTrigger = CollapsiblePrimitive.Trigger;

/**
 * Height is animated from the --radix-collapsible-content-height variable that
 * Radix measures for us, so the reveal is a real slide rather than a snap.
 */
const CollapsibleContent = React.forwardRef<
  React.ElementRef<typeof CollapsiblePrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof CollapsiblePrimitive.Content>
>(({ className, ...props }, ref) => (
  <CollapsiblePrimitive.Content
    ref={ref}
    className={cn(
      "overflow-hidden",
      "data-[state=open]:animate-[collapsibleDown_300ms_cubic-bezier(0.22,1,0.36,1)]",
      "data-[state=closed]:animate-[collapsibleUp_220ms_cubic-bezier(0.4,0,1,1)]",
      className,
    )}
    {...props}
  />
));
CollapsibleContent.displayName = CollapsiblePrimitive.Content.displayName;

export { Collapsible, CollapsibleTrigger, CollapsibleContent };
