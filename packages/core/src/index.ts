// IAFrame — Copyright (C) 2026 David Ambrozio
// SPDX-License-Identifier: GPL-3.0-or-later

export * from "./types.ts";
export { parseDropData, type RawDropData } from "./wfcd/parse.ts";
export { kindFromName, parseRelicName, splitQuantity } from "./wfcd/names.ts";
