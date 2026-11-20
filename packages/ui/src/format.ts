// Codex — Copyright (C) 2026 David Ambrozio
// SPDX-License-Identifier: GPL-3.0-or-later

/** "12.5%", "2.26%", "0.332%": more decimals the rarer it gets, never rounded to 0. */
export function formatChance(chance: number, locale: string): string {
  if (chance > 0 && chance < 0.001) return `<${formatNumber(0.001, locale, 3)}%`;
  const digits = chance >= 10 ? 1 : chance >= 1 ? 2 : 3;
  return `${formatNumber(chance, locale, digits)}%`;
}

/** Attempt counts: "8", "1.5", "1,234"; never-dropping is a dash. */
export function formatCount(count: number, locale: string): string {
  if (!Number.isFinite(count)) return "—";
  return formatNumber(count, locale, count < 10 ? 1 : 0);
}

/** A big amount, short: "30K", "30 mil". */
export function formatCompact(count: number, locale: string): string {
  if (!Number.isFinite(count)) return "—";
  return new Intl.NumberFormat(locale, { notation: "compact", maximumFractionDigits: 1 }).format(count);
}

export function formatDate(iso: string, locale: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", year: "numeric" }).format(date);
}

function formatNumber(value: number, locale: string, maxDigits: number): string {
  return new Intl.NumberFormat(locale, { maximumFractionDigits: maxDigits }).format(value);
}
