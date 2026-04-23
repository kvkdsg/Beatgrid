import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import tailwindcss from "@tailwindcss/vite";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// --- PLUGIN: ASYNC CSS LOADING (OPT-IN, NO TOCA CSS CRÍTICO) ---
// Versión endurecida: SOLO transforma links marcados explícitamente.
// Motivo: diferir el CSS principal puede aumentar el render delay del LCP.
const asyncCssPlugin = () => {
  return {
    name: "async-css",
    transformIndexHtml(html: string) {
      // Match robusto: captura <link ... rel="stylesheet" ...>
      return html.replace(/<link\b[^>]*\brel=["']stylesheet["'][^>]*>/gi, (tag) => {
        // OPT-IN: solo links que incluyan data-async (ej: <link rel="stylesheet" href="..." data-async>)
        const isOptIn = /\bdata-async\b/i.test(tag);
        if (!isOptIn) return tag;

        // Extrae href (simple, suficiente para output de Vite)
        const hrefMatch = tag.match(/\bhref=["']([^"']+)["']/i);
        const href = hrefMatch?.[1];
        if (!href) return tag;

        return `
<link rel="preload" href="${href}" as="style" onload="this.onload=null;this.rel='stylesheet'">
<noscript><link rel="stylesheet" href="${href}"></noscript>
        `.trim();
      });
    },
  };
};

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    asyncCssPlugin(), // <--- INYECTADO: Solución Render Blocking (opt-in)
    VitePWA({
      // Manual: el plugin NO inyecta registro; tú registras el SW con la API nativa.
      injectRegister: null,

      registerType: "autoUpdate",
      strategies: "generateSW",
      manifestFilename: "manifest.webmanifest",
      includeAssets: ["favicon.ico", "images/*.jpg", "images/*.webp", "audio/*.opus", "fonts/*.woff2"],
      manifest: {
        id: "beatgrid-game",
        name: "BeatGrid - Say the Word on Beat",
        short_name: "BeatGrid",
        description: "Viral rhythm game driven by AI. Keep the beat, record, and share.",
        theme_color: "#050505",
        background_color: "#050505",
        display: "standalone",
        orientation: "any",
        start_url: "/",
        scope: "/",
        categories: ["games", "music"],
        icons: [
          { src: "/pwa/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "/pwa/icon-512.png", sizes: "512x512", type: "image/png" },
          { src: "/pwa/icon-512-maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
      workbox: {
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        skipWaiting: true,
        globPatterns: ["**/*.{js,css,html,ico,png,svg,webp,opus,woff2}"],
        globIgnores: ["**/*.map", "**/node_modules/**"],
        maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
        navigateFallbackDenylist: [/^\/robots.txt$/, /^\/sitemap.xml$/, /^\/api\//],
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname.startsWith("/api/"),
            handler: "NetworkOnly",
          },
          {
            urlPattern: ({ url }) => url.pathname === "/robots.txt" || url.pathname === "/sitemap.xml",
            handler: "NetworkOnly",
          },
          {
            urlPattern: ({ url, request }) =>
              url.origin === "https://storage.googleapis.com" || request.destination === "image",
            handler: "StaleWhileRevalidate",
            options: {
              cacheName: "images-cache",
              expiration: { maxEntries: 50, maxAgeSeconds: 30 * 24 * 60 * 60 },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
        ],
      },
    }),
  ],
  resolve: { alias: { "@": path.resolve(__dirname, ".") } },
  server: { port: 3000, host: "0.0.0.0" },
  build: {
    outDir: "dist",
    target: "es2020",
    sourcemap: false,
    cssCodeSplit: true,
    assetsInlineLimit: 0, // CRÍTICO: Evita base64 inlining, fuerza archivos cacheables.
    minify: "esbuild", // Más rápido y eficiente que terser por defecto.
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          if (id.includes("node_modules")) {
            // OPTIMIZACIÓN MAIN THREAD: Separar react-dom (pesado) del core.
            if (id.includes("react-dom")) return "vendor-react-dom";
            if (id.includes("react")) return "vendor-react-core";
            if (id.includes("scheduler")) return "vendor-react-scheduler";

            // i18n aislado
            if (id.includes("i18next")) return "vendor-i18n";

            // Media libs pesadas
            if (id.includes("ffmpeg") || id.includes("webm") || id.includes("sharp")) return "vendor-media";

            // Resto de utilidades
            return "vendor-utils";
          }
        },
      },
    },
  },
});
