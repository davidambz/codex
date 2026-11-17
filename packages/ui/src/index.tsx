// IAFrame — Copyright (C) 2026 David Ambrozio
// SPDX-License-Identifier: GPL-3.0-or-later

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import type { Platform } from "@iaframe/core";
import { App } from "./App.tsx";
import { I18nProvider } from "./i18n/I18nProvider.tsx";
import { PlatformContext } from "./platform/PlatformContext.ts";
import "./styles/global.css";

export function mountApp(root: HTMLElement, platform: Platform) {
  createRoot(root).render(
    <StrictMode>
      <PlatformContext.Provider value={platform}>
        <I18nProvider>
          <App />
        </I18nProvider>
      </PlatformContext.Provider>
    </StrictMode>,
  );
}
