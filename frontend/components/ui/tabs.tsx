"use client";

import * as React from "react";
import * as TabsPrimitive from "@radix-ui/react-tabs";
import { animate } from "animejs";
import { cn } from "@/lib/utils";

const Tabs = TabsPrimitive.Root;

/**
 * TabsList paints a single pill behind the active trigger and animates it into
 * place with anime.js, so the indicator slides between tabs instead of
 * cross-fading. The pill is measured from the DOM, so it tracks label width.
 */
const TabsList = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>
>(({ className, children, ...props }, forwardedRef) => {
  const listRef = React.useRef<HTMLDivElement | null>(null);
  const pillRef = React.useRef<HTMLSpanElement | null>(null);
  const settled = React.useRef(false);

  React.useEffect(() => {
    const list = listRef.current;
    const pill = pillRef.current;
    if (!list || !pill) return;

    const move = () => {
      const active = list.querySelector<HTMLElement>('[data-state="active"]');
      if (!active) return;
      const target = {
        width: active.offsetWidth,
        left: active.offsetLeft,
      };
      if (!settled.current) {
        // First paint: place it without a slide so it doesn't fly in from 0.
        pill.style.opacity = "1";
        pill.style.width = `${target.width}px`;
        pill.style.transform = `translateX(${target.left}px)`;
        settled.current = true;
        return;
      }
      animate(pill, {
        width: target.width,
        translateX: target.left,
        duration: 460,
        ease: "outElastic(1, 0.85)",
      });
    };

    move();
    const observer = new MutationObserver(move);
    observer.observe(list, { attributes: true, subtree: true, attributeFilter: ["data-state"] });
    const resize = new ResizeObserver(move);
    resize.observe(list);
    return () => {
      observer.disconnect();
      resize.disconnect();
    };
  }, []);

  return (
    <TabsPrimitive.List
      ref={(node) => {
        listRef.current = node;
        if (typeof forwardedRef === "function") forwardedRef(node);
        else if (forwardedRef) forwardedRef.current = node;
      }}
      className={cn(
        "relative inline-flex h-11 items-center gap-1 rounded-full border border-border bg-card/70 p-1 backdrop-blur-md",
        className,
      )}
      {...props}
    >
      <span
        ref={pillRef}
        aria-hidden
        className="pointer-events-none absolute left-0 top-1 h-9 rounded-full bg-primary opacity-0 shadow-[0_4px_14px_-6px_hsl(var(--shadow-color)/0.5)]"
      />
      {children}
    </TabsPrimitive.List>
  );
});
TabsList.displayName = TabsPrimitive.List.displayName;

const TabsTrigger = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
>(({ className, children, ...props }, ref) => (
  <TabsPrimitive.Trigger
    ref={ref}
    className={cn(
      "relative z-10 inline-flex h-9 items-center gap-2 rounded-full px-4 text-[13px] font-medium text-muted-foreground transition-colors duration-200",
      "hover:text-foreground data-[state=active]:text-primary-foreground",
      "[&_svg]:size-3.5",
      className,
    )}
    {...props}
  >
    {children}
  </TabsPrimitive.Trigger>
));
TabsTrigger.displayName = TabsPrimitive.Trigger.displayName;

const TabsContent = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Content
    ref={ref}
    className={cn("outline-none focus-visible:outline-none", className)}
    {...props}
  />
));
TabsContent.displayName = TabsPrimitive.Content.displayName;

export { Tabs, TabsList, TabsTrigger, TabsContent };
