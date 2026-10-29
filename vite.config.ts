import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";
import { contentPlugin } from "./src/content/vite-plugin";

export default defineConfig({
  // Relative paths so the same build runs from a web server and inside Capacitor.
  base: "./",
  plugins: [
    contentPlugin(),
    react(),
    VitePWA({
      registerType: "prompt",
      manifest: {
        name: "Català",
        short_name: "Català",
        lang: "ca",
        start_url: ".",
        display: "standalone",
        background_color: "#f6f7f3",
        theme_color: "#13a89e",
        icons: [
          { src: "icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "icon-512.png", sizes: "512x512", type: "image/png" },
          { src: "icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,png,webp,woff2}"],
        // The 60 units ship in one bundle (~2.9 MB); raise the 2 MiB default.
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
      },
    }),
  ],
});
