// IAFrame — Copyright (C) 2026 David Ambrozio
// SPDX-License-Identifier: GPL-3.0-or-later

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import type { Platform } from "@iaframe/core";
import { App } from "./App.tsx";

export function mountApp(root: HTMLElement, platform: Platform) {
  createRoot(root).render(
    <StrictMode>
      <App platform={platform} />
    </StrictMode>,
  );
}
