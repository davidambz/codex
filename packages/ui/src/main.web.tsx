// IAFrame — Copyright (C) 2026 David Ambrozio
// SPDX-License-Identifier: GPL-3.0-or-later

import { mountApp } from "./index.tsx";
import { createWebPlatform } from "./platform/web.ts";

mountApp(document.getElementById("root")!, createWebPlatform());
