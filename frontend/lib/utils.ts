import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Formats a 0..1 model confidence as a percentage string. */
export function pct(value: number | null | undefined) {
  return value == null ? null : `${Math.round(value * 100)}%`;
}

/** Compact relative time ("3h ago") with a graceful fallback. */
export function relativeTime(iso: string) {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return iso;
  const diff = Date.now() - then;
  const units: [Intl.RelativeTimeFormatUnit, number][] = [
    ["second", 1000],
    ["minute", 60_000],
    ["hour", 3_600_000],
    ["day", 86_400_000],
    ["week", 604_800_000],
    ["month", 2_629_800_000],
    ["year", 31_557_600_000],
  ];
  const fmt = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });
  let chosen: [Intl.RelativeTimeFormatUnit, number] = units[0];
  for (const unit of units) if (Math.abs(diff) >= unit[1]) chosen = unit;
  return fmt.format(-Math.round(diff / chosen[1]), chosen[0]);
}
