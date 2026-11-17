// IAFrame — Copyright (C) 2026 David Ambrozio
// SPDX-License-Identifier: GPL-3.0-or-later

import { expectedRuns, runsForConfidence } from "./odds.ts";

describe("odds", () => {
  it("averages 1/p attempts", () => {
    expect(expectedRuns(25)).toBe(4);
    expect(expectedRuns(2)).toBe(50);
    expect(expectedRuns(100)).toBe(1);
  });

  it("counts the attempts for 90% of players", () => {
    // ln(0.1) / ln(0.98) = 113.97
    expect(runsForConfidence(2)).toBe(114);
    expect(runsForConfidence(11, 0.5)).toBe(6);
    expect(runsForConfidence(100)).toBe(1);
    expect(runsForConfidence(99.9)).toBe(1);
  });

  it("treats no chance as never", () => {
    expect(expectedRuns(0)).toBe(Number.POSITIVE_INFINITY);
    expect(runsForConfidence(0)).toBe(Number.POSITIVE_INFINITY);
  });
});
