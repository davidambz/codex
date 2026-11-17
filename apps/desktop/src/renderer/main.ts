// IAFrame — Copyright (C) 2026 David Ambrozio
// SPDX-License-Identifier: GPL-3.0-or-later

import { mountApp } from "@iaframe/ui";
import { createDesktopPlatform } from "./platform";

mountApp(document.getElementById("root")!, createDesktopPlatform());
