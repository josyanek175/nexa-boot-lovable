import { defineConfig } from "@lovable.dev/vite-tanstack-config";

export default defineConfig({
  server: {
    host: true
  },
  preview: {
    host: true,
    allowedHosts: ['nexa.72.61.133.41.nip.io']
  },
  build: {
    outDir: "dist"
  }
});
