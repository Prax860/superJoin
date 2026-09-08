"use client";

import * as React from "react";

/**
 * Fixed, non-interactive backdrop, layered back to front:
 *   1. flat base colour
 *   2. three drifting colour fields
 *   3. a slow rotating conic sweep
 *   4. vertical light beams that breathe
 *   5. a panning technical grid
 *   6. film grain
 *   7. a vertical fade so text keeps its contrast
 *
 * Layers 2-5 parallax off --scroll-y, which `useScrollDriver` writes to <html>
 * once per animation frame. Everything is CSS-driven, so scrolling costs no
 * React renders.
 */
export function Aurora() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
      <div className="absolute inset-0 bg-background" />

      {/* Drifting colour fields */}
      <div
        className="animate-drift absolute -left-[16%] -top-[20%] size-[58vw] rounded-full opacity-70 blur-[110px]"
        style={{
          translate: "0 calc(var(--scroll-y, 0) * 0.16px)",
          background:
            "radial-gradient(circle, color-mix(in oklch, var(--primary) 46%, transparent), transparent 68%)",
        }}
      />
      <div
        className="animate-drift-slow absolute -right-[12%] top-[4%] size-[50vw] rounded-full opacity-60 blur-[120px]"
        style={{
          translate: "0 calc(var(--scroll-y, 0) * -0.1px)",
          background:
            "radial-gradient(circle, color-mix(in oklch, var(--accent) 40%, transparent), transparent 68%)",
        }}
      />
      <div
        className="animate-drift absolute bottom-[-24%] left-[26%] size-[56vw] rounded-full opacity-50 blur-[130px]"
        style={{
          animationDelay: "-12s",
          translate: "0 calc(var(--scroll-y, 0) * 0.07px)",
          background:
            "radial-gradient(circle, color-mix(in oklch, var(--info) 38%, transparent), transparent 70%)",
        }}
      />

      {/* Rotating conic sweep */}
      <div
        className="animate-sweep absolute left-1/2 top-1/2 size-[150vmax] -translate-x-1/2 -translate-y-1/2 opacity-[0.16] blur-[70px]"
        style={{
          background:
            "conic-gradient(from 0deg, transparent 0deg, color-mix(in oklch, var(--primary) 55%, transparent) 70deg, transparent 150deg, color-mix(in oklch, var(--accent) 45%, transparent) 240deg, transparent 320deg)",
        }}
      />

      {/* Breathing vertical beams */}
      <div className="absolute inset-0 flex justify-around">
        {[0, 1, 2, 3, 4].map((index) => (
          <span
            key={index}
            className="animate-beam block h-full w-px"
            style={{
              animationDelay: `${index * -1.7}s`,
              translate: "0 calc(var(--scroll-y, 0) * 0.05px)",
              background:
                "linear-gradient(to bottom, transparent, color-mix(in oklch, var(--primary) 60%, transparent) 45%, transparent)",
            }}
          />
        ))}
      </div>

      {/* Panning technical grid */}
      <div
        className="animate-grid-pan absolute inset-[-10%]"
        style={{
          opacity: "var(--grid-opacity)",
          translate: "0 calc(var(--scroll-y, 0) * 0.11px)",
          backgroundSize: "72px 72px",
          backgroundImage:
            "linear-gradient(to right, currentColor 1px, transparent 1px), linear-gradient(to bottom, currentColor 1px, transparent 1px)",
          color: "var(--primary)",
        }}
      />

      {/* Film grain */}
      <div
        className="absolute inset-0"
        style={{
          opacity: "var(--grain-opacity)",
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.82' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='160' height='160' filter='url(%23n)'/%3E%3C/svg%3E\")",
        }}
      />

      <div className="absolute inset-0 bg-linear-to-b from-background/30 via-background/70 to-background" />
    </div>
  );
}

/** Thin progress rail pinned to the top of the viewport. */
export function ScrollProgress() {
  return (
    <div
      aria-hidden
      className="fixed inset-x-0 top-0 z-50 h-0.5 origin-left bg-linear-to-r from-primary via-accent to-info"
      style={{ transform: "scaleX(var(--scroll-progress, 0))" }}
    />
  );
}
