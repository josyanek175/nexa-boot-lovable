import { defineConfig } from "@lovable.dev/vite-tanstack-config";

export default defineConfig({
  server: {
    host: true
  },
  preview: {
    host: true,
    allowedHosts: true
  },
  build: {
    outDir: "dist"
  }
});
