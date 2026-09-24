import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// In dev, Vite serves the UI and forwards API and WebSocket traffic to the Node server on :8080.
export default defineConfig({
  plugins: [react()],
  // Card art stays as image files (cached for good, fetched in parallel), not text inside the scripts.
  build: { assetsInlineLimit: 0 },
  server: {
    proxy: {
      "/api": "http://127.0.0.1:8080",
      "/ws": { target: "ws://127.0.0.1:8080", ws: true },
    },
  },
});
