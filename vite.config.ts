import { defineConfig } from "vite";

export default defineConfig({
  base: "./",
  build: { outDir: "dist/web", emptyOutDir: true, chunkSizeWarningLimit: 1500 },
  test: { include: ["tests/**/*.test.ts"] },
} as Parameters<typeof defineConfig>[0]);
