import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

/**
 * Tests resolve "@/..." the same way the app does. Without this the alias only
 * works under Next's bundler, so a module that imports one of its own siblings
 * by alias is untestable — which is how a test ends up written against a
 * relative path that nothing else in the codebase uses.
 */
export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    environment: "node",
    // scripts/ too: the seed runs on every deploy, so its guard tests
    // matter as much as the app's.
    include: ["src/**/*.test.ts", "scripts/**/*.test.ts"],
  },
});
