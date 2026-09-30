import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: { environment: "node" },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      // Next.js stubs this for server bundles; Vitest needs a no-op.
      "server-only": path.resolve(__dirname, "./test/stubs/server-only.ts"),
    },
  },
});
