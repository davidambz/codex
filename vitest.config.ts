import { defineConfig } from "vitest/config";

// One test run across the workspace: each package declares its own
// environment (core and store are plain Node, ui needs jsdom + React).
export default defineConfig({
  test: {
    projects: ["packages/*"],
    passWithNoTests: true,
  },
});
