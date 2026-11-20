// Codex — Copyright (C) 2026 David Ambrozio
// SPDX-License-Identifier: GPL-3.0-or-later

import { formatChance, formatCount, formatDate } from "./format";

describe("format", () => {
  it("shows chances with more decimals as they get rarer", () => {
    expect(formatChance(12.5, "en")).toBe("12.5%");
    expect(formatChance(2.2567, "en")).toBe("2.26%");
    expect(formatChance(0.3318, "en")).toBe("0.332%");
    expect(formatChance(0.0001, "en")).toBe("<0.001%");
    expect(formatChance(12.5, "pt-BR")).toBe("12,5%");
  });

  it("shows attempt counts", () => {
    expect(formatCount(8, "en")).toBe("8");
    expect(formatCount(1.5, "en")).toBe("1.5");
    expect(formatCount(1234.4, "en")).toBe("1,234");
    expect(formatCount(Number.POSITIVE_INFINITY, "en")).toBe("—");
  });

  it("shows dates in the user's language", () => {
    expect(formatDate("2026-11-17T12:00:00Z", "en")).toBe("Nov 17, 2026");
    expect(formatDate("2026-11-17T12:00:00Z", "pt-BR")).toMatch(/17 de nov\.? de 2026/);
  });
});
