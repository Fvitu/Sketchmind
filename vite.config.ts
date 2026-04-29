import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { VitePWA } from "vite-plugin-pwa";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
  },
  envPrefix: ["VITE_", "NEXT_PUBLIC_"],
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      injectRegister: "auto",
      // Disable SW in development — keeps HMR working cleanly
      devOptions: { enabled: false },
      // The manifest is served from /public/manifest.json; don't auto-generate one
      manifest: false,
      workbox: {
        // Precache the built app shell
        globPatterns: ["**/*.{js,css,html,ico,png,svg,woff,woff2}"],
        // Navigation fallback: serve index.html for all SPA routes
        navigateFallback: "/index.html",
        // Never use cache for these — they need live network data
        navigateFallbackDenylist: [
          /^\/api\//,                        // Express API
        ],
        runtimeCaching: [
          // ── Never cache auth/API/collab (always network) ────────────────
          {
            urlPattern: /https:\/\/.*\.supabase\.co\/auth\/.*/i,
            handler: "NetworkOnly",
          },
          {
            urlPattern: /https:\/\/.*\.supabase\.co\/rest\/.*/i,
            handler: "NetworkOnly",
          },
          {
            urlPattern: /https:\/\/api\.liveblocks\.io\/.*/i,
            handler: "NetworkOnly",
          },
          // ── Never cache the canvas editor routes ─────────────────────────
          {
            urlPattern: /\/board\/.+/,
            handler: "NetworkOnly",
          },
          // ── Supabase storage (avatars, thumbnails) — stale-while-revalidate
          {
            urlPattern: /https:\/\/.*\.supabase\.co\/storage\/.*/i,
            handler: "StaleWhileRevalidate",
            options: {
              cacheName: "supabase-storage-cache",
              expiration: { maxEntries: 60, maxAgeSeconds: 60 * 60 * 24 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          // ── Google Fonts stylesheets ─────────────────────────────────────
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: "CacheFirst",
            options: {
              cacheName: "google-fonts-stylesheets",
              expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          // ── Google Fonts resources ───────────────────────────────────────
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: "CacheFirst",
            options: {
              cacheName: "google-fonts-resources",
              expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          // ── Static image assets ──────────────────────────────────────────
          {
            urlPattern: /\.(?:png|jpg|jpeg|svg|gif|webp|ico)$/i,
            handler: "CacheFirst",
            options: {
              cacheName: "static-image-cache",
              expiration: { maxEntries: 120, maxAgeSeconds: 60 * 60 * 24 * 30 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    dedupe: ["react", "react-dom", "react/jsx-runtime", "react/jsx-dev-runtime", "@tanstack/react-query", "@tanstack/query-core"],
  },
}));