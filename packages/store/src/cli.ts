// IAFrame — Copyright (C) 2026 David Ambrozio
// SPDX-License-Identifier: GPL-3.0-or-later

// npm run ingest [-- --force] [-- --db path] [-- --lang pt,es]
// Builds data/iaframe.db at the repo root from WFCD's latest drop data.

import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { isItemLanguage } from "@iaframe/core";
import { ingest } from "./ingest.ts";

const args = process.argv.slice(2);
const dbFlag = args.indexOf("--db");
const dbPath =
  dbFlag >= 0 ? resolve(args[dbFlag + 1]) : fileURLToPath(new URL("../../../data/iaframe.db", import.meta.url));

const langFlag = args.indexOf("--lang");
const languages = langFlag >= 0 ? (args[langFlag + 1] ?? "").split(",").filter(isItemLanguage) : [];

const started = performance.now();
const result = await ingest({ dbPath, force: args.includes("--force"), languages });
const seconds = ((performance.now() - started) / 1000).toFixed(1);

switch (result.status) {
  case "up-to-date":
    console.log(`Already up to date (${result.hash}): ${dbPath}`);
    break;
  case "updated":
    console.log(
      `Built ${dbPath} in ${seconds}s: ${result.items} items, ${result.drops} drops, ${result.equipment} Warframes, weapons and companions` +
        (result.skipped ? `, ${result.skipped} rows without a chance skipped` : ""),
    );
    if (result.namesError) console.warn(`Item names not refreshed (kept the previous ones): ${result.namesError}`);
    if (result.catalogError) console.warn(`Catalog not refreshed (kept the previous one): ${result.catalogError}`);
    break;
  case "rejected":
    console.error(`WFCD data ${result.hash} rejected, database left as it was:`);
    for (const problem of result.problems) console.error(`  - ${problem}`);
    process.exitCode = 1;
}
