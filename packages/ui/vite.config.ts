/// <reference types="vitest/config" />
import { fileURLToPath } from "node:url";
import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";

// `npm run dev:web`: the UI in a browser, backed by the real data service
// on data/iaframe.db (built by `npm run ingest`, or on first request).
function dataApi(): Plugin {
  return {
    name: "iaframe-data-api",
    apply: "serve",
    async configureServer(server) {
      const { createDataService } = await import("@iaframe/store");
      const { ITEM_KINDS, isItemLanguage, itemLanguageForLocale } = await import("@iaframe/core");
      const kinds = (value: string) =>
        value ? ITEM_KINDS.filter((kind) => value.split(",").includes(kind)) : undefined;
      const data = createDataService({
        dbPath: fileURLToPath(new URL("../../data/iaframe.db", import.meta.url)),
        settingsPath: fileURLToPath(new URL("../../data/settings.json", import.meta.url)),
        defaultSettings: { itemLanguage: itemLanguageForLocale(Intl.DateTimeFormat().resolvedOptions().locale) },
      });
      void data.update();
      server.httpServer?.on("close", () => data.close());
      server.middlewares.use("/api", async (req, res) => {
        const url = new URL(req.url ?? "/", "http://localhost");
        const p = (name: string) => url.searchParams.get(name) ?? "";
        const routes: Record<string, () => unknown> = {
          "/search": () => data.search(p("q"), Number(p("limit")) || 10, kinds(p("kinds"))),
          "/item": () => data.getItem(p("name")),
          "/deep": () => data.getDropsDeep(p("name")),
          "/source": () => data.getSource(p("key")),
          "/status": () => data.status(),
          "/settings": () =>
            req.method === "POST" ? data.updateSettings(JSON.parse(p("patch") || "{}")) : data.settings(),
          "/names": () => {
            const lang = p("lang");
            return isItemLanguage(lang) ? data.getItemNames(lang) : {};
          },
          "/update": () => data.update(true),
        };
        const route = routes[url.pathname];
        if (!route) {
          res.statusCode = 404;
          res.end();
          return;
        }
        const body = await route();
        res.setHeader("Content-Type", "application/json");
        res.end(body === undefined ? "" : JSON.stringify(body));
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), dataApi()],
  base: "./",
  test: {
    name: "ui",
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
  },
});
