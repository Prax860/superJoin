"use client";

import type * as React from "react";
import { Aurora, ScrollProgress } from "@/components/anim/Aurora";
import { useScrollDriver } from "@/lib/motion";

/**
 * Client shell that installs the scroll driver once for the whole app and
 * renders the animated backdrop beneath the page content. Kept separate from
 * the root layout so the layout itself stays a server component.
 */
export function Chrome({ children }: { children: React.ReactNode }) {
  useScrollDriver();

  return (
    <>
      <ScrollProgress />
      <Aurora />
      <div className="relative z-10">{children}</div>
    </>
  );
}
