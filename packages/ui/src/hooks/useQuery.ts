// IAFrame — Copyright (C) 2026 David Ambrozio
// SPDX-License-Identifier: GPL-3.0-or-later

import { useEffect, useState } from "react";

/** Runs `load` whenever `deps` change and keeps the latest answer; stale answers are dropped. */
export function useQuery<T>(load: () => Promise<T>, deps: readonly unknown[]): T | undefined {
  const [value, setValue] = useState<{ deps: readonly unknown[]; data: T }>();
  useEffect(() => {
    let current = true;
    void load().then((data) => {
      if (current) setValue({ deps, data });
    });
    return () => {
      current = false;
    };
    // The caller lists what `load` depends on, the same contract as useEffect's own deps.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  // Don't show the previous item's data for a frame after switching.
  return value && value.deps.every((dep, i) => Object.is(dep, deps[i])) ? value.data : undefined;
}
