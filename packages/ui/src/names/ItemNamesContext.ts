// IAFrame — Copyright (C) 2026 David Ambrozio
// SPDX-License-Identifier: GPL-3.0-or-later

import { createContext, useContext } from "react";
import type { Settings } from "@iaframe/core";

export interface ItemNames {
  settings: Settings;
  updateSettings: (patch: Partial<Settings>) => void;
  /** An item's name in the chosen language (its English name when there's no translation). */
  itemName: (english: string) => string;
  /** Changes whenever names or search languages do, for effects that depend on them. */
  version: string;
}

export const ItemNamesContext = createContext<ItemNames>({
  settings: { itemLanguage: "en", searchLanguages: [] },
  updateSettings: () => {},
  itemName: (english) => english,
  version: "",
});

export function useItemNames(): ItemNames {
  return useContext(ItemNamesContext);
}
