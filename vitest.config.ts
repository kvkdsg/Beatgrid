import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./setupTests.ts"],
    include: ["**/*.test.{ts,tsx,js,mjs}"],
    exclude:["node_modules", "dist"],
    alias: {
  "@app": path.resolve(__dirname, "app"),
  "@features": path.resolve(__dirname, "features"),
  "@shared": path.resolve(__dirname, "shared"),
  "@": path.resolve(__dirname, "."),
},
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      exclude: ["node_modules/", "setupTests.ts", "dist/"],
    },
  },
});