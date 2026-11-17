// IAFrame — Copyright (C) 2026 David Ambrozio
// SPDX-License-Identifier: GPL-3.0-or-later

import { useCallback, useEffect, useState } from "react";
import type { DataStatus } from "@iaframe/core";
import { usePlatform } from "../platform/PlatformContext";

/** The data feed's state, kept live, and a way to ask for fresh data. */
export function useDataStatus(): { status: DataStatus; update: () => void } {
  const platform = usePlatform();
  const [status, setStatus] = useState<DataStatus>({ busy: false });

  useEffect(() => {
    let cancelled = false;
    void platform.getDataStatus().then((initial) => {
      if (!cancelled) setStatus(initial);
    });
    const unsubscribe = platform.onDataStatus((next) => {
      if (!cancelled) setStatus(next);
    });
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [platform]);

  const update = useCallback(() => {
    void platform.updateData().then(setStatus);
  }, [platform]);

  return { status, update };
}
