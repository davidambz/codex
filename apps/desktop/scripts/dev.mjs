// Codex — Copyright (C) 2026 David Ambrozio
// SPDX-License-Identifier: GPL-3.0-or-later

// Dev runner: a Vite server for the renderer, the main/preload bundles,
// and an Electron window pointed at it.
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { createServer } from "vite";
import { buildElectron } from "./esbuild.mjs";

const require = createRequire(import.meta.url);
const electronPath = require("electron");

await buildElectron();
const server = await createServer({ configFile: "vite.config.ts" });
await server.listen();
const url = server.resolvedUrls?.local[0];
if (!url) throw new Error("Vite didn't report a local URL");
console.log(`Renderer at ${url}`);

const child = spawn(electronPath, ["."], {
  stdio: "inherit",
  env: { ...process.env, VITE_DEV_SERVER_URL: url },
});
child.on("exit", async (code) => {
  await server.close();
  process.exit(code ?? 0);
});
