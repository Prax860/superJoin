"use client";

import * as React from "react";
import { animate, stagger, utils } from "animejs";

export const prefersReducedMotion = () =>
  typeof window !== "undefined" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

type RevealOptions = {
  /** CSS selector for the children to stagger. Omit to animate the root. */
  selector?: string;
  delay?: number;
  distance?: number;
  /** Re-run every time the element scrolls back into view. */
  repeat?: boolean;
};

/**
 * Reveals an element (or a staggered set of children) with anime.js as it
 * scrolls into view.
 *
 * The child set is re-scanned via MutationObserver rather than being read once
 * on mount: paginating or filtering swaps in brand-new DOM nodes, and those
 * arrive already carrying `.will-reveal` (opacity 0). Without the rescan they
 * would never be observed and would stay permanently invisible.
 */
export function useReveal<T extends HTMLElement = HTMLDivElement>({
  selector,
  delay = 0,
  distance = 18,
  repeat = false,
}: RevealOptions = {}) {
  const ref = React.useRef<T | null>(null);

  React.useEffect(() => {
    const root = ref.current;
    if (!root) return;

    const reduced = prefersReducedMotion();
    const known = new WeakSet<Element>();

    const collect = (): HTMLElement[] =>
      selector ? Array.from(root.querySelectorAll<HTMLElement>(selector)) : [root];

    const observer = new IntersectionObserver(
      (entries) => {
        const arrived = entries
          .filter((entry) => entry.isIntersecting)
          .map((entry) => entry.target as HTMLElement);
        if (arrived.length === 0) return;

        animate(arrived, {
          opacity: [0, 1],
          translateY: [distance, 0],
          duration: 720,
          delay: stagger(58, { start: delay }),
          ease: "out(3)",
        });

        if (!repeat) arrived.forEach((target) => observer.unobserve(target));
      },
      { threshold: 0.06, rootMargin: "0px 0px -6% 0px" },
    );

    // Prime any node we have not seen before, then watch for more.
    const scan = () => {
      for (const target of collect()) {
        if (known.has(target)) continue;
        known.add(target);
        if (reduced) {
          utils.set(target, { opacity: 1, translateY: 0 });
          continue;
        }
        utils.set(target, { opacity: 0, translateY: distance });
        observer.observe(target);
      }
    };

    scan();

    const mutations = new MutationObserver(scan);
    mutations.observe(root, { childList: true, subtree: Boolean(selector) });

    return () => {
      observer.disconnect();
      mutations.disconnect();
    };
  }, [selector, delay, distance, repeat]);

  return ref;
}

/**
 * Pulls an element a little way toward the cursor while hovered — used on the
 * primary call-to-action so it feels physically attracted to the pointer.
 */
export function useMagnetic<T extends HTMLElement = HTMLButtonElement>(strength = 0.32) {
  const ref = React.useRef<T | null>(null);

  React.useEffect(() => {
    const el = ref.current;
    if (!el || prefersReducedMotion()) return;

    const onMove = (event: MouseEvent) => {
      const rect = el.getBoundingClientRect();
      animate(el, {
        translateX: (event.clientX - (rect.left + rect.width / 2)) * strength,
        translateY: (event.clientY - (rect.top + rect.height / 2)) * strength,
        duration: 420,
        ease: "out(3)",
      });
    };
    const onLeave = () => {
      animate(el, { translateX: 0, translateY: 0, duration: 620, ease: "outElastic(1, 0.5)" });
    };

    el.addEventListener("mousemove", onMove);
    el.addEventListener("mouseleave", onLeave);
    return () => {
      el.removeEventListener("mousemove", onMove);
      el.removeEventListener("mouseleave", onLeave);
    };
  }, [strength]);

  return ref;
}

/**
 * Publishes scroll position as CSS custom properties on <html>:
 *   --scroll-progress  0..1 through the document
 *   --scroll-y         pixels scrolled
 * Driving background parallax from CSS this way keeps it off the React render
 * path — no state updates, one rAF-throttled write per frame.
 */
export function useScrollDriver() {
  React.useEffect(() => {
    if (prefersReducedMotion()) return;
    const root = document.documentElement;
    let frame = 0;

    const write = () => {
      frame = 0;
      const max = root.scrollHeight - window.innerHeight;
      const y = window.scrollY;
      root.style.setProperty("--scroll-y", `${y}`);
      root.style.setProperty("--scroll-progress", `${max > 0 ? y / max : 0}`);
      root.dataset.scrolled = y > 12 ? "true" : "false";
    };

    const onScroll = () => {
      if (frame) return;
      frame = requestAnimationFrame(write);
    };

    write();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    return () => {
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);
}

/**
 * Counts an element's number up only once it is actually on screen, so metrics
 * further down the page animate when the reader reaches them.
 */
export function useInView<T extends HTMLElement = HTMLDivElement>(rootMargin = "0px") {
  const ref = React.useRef<T | null>(null);
  const [inView, setInView] = React.useState(false);

  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          observer.disconnect();
        }
      },
      { threshold: 0.15, rootMargin },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [rootMargin]);

  return [ref, inView] as const;
}
