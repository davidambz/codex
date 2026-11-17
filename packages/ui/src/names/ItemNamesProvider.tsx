// IAFrame — Copyright (C) 2026 David Ambrozio
// SPDX-License-Identifier: GPL-3.0-or-later

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Settings } from "@iaframe/core";
import { usePlatform } from "../platform/PlatformContext";
import { ItemNamesContext, type ItemNames } from "./ItemNamesContext";

/** Loads the settings and the names for the chosen language; reloads them when the data changes. */
export function ItemNamesProvider({ dataVersion, children }: { dataVersion?: string; children: ReactNode }) {
  const platform = usePlatform();
  const [settings, setSettings] = useState<Settings>({ itemLanguage: "en", searchLanguages: [] });
  const [names, setNames] = useState<Record<string, string>>({});

  useEffect(() => {
    let current = true;
    void platform.getSettings().then((loaded) => current && setSettings(loaded));
    return () => {
      current = false;
    };
  }, [platform]);

  useEffect(() => {
    let current = true;
    void platform.getItemNames(settings.itemLanguage).then((loaded) => current && setNames(loaded));
    return () => {
      current = false;
    };
  }, [platform, settings.itemLanguage, dataVersion]);

  const updateSettings = useCallback(
    (patch: Partial<Settings>) => {
      setSettings((previous) => ({ ...previous, ...patch }));
      void platform.updateSettings(patch).then(setSettings);
    },
    [platform],
  );

  const value = useMemo<ItemNames>(
    () => ({
      settings,
      updateSettings,
      itemName: (english) => names[english] ?? english,
      version: [dataVersion, settings.itemLanguage, ...settings.searchLanguages].join("|"),
    }),
    [settings, updateSettings, names, dataVersion],
  );
  return <ItemNamesContext.Provider value={value}>{children}</ItemNamesContext.Provider>;
}
