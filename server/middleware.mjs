// server/middleware.mjs
import express from "express";
import helmet from "helmet";
import compression from "compression";
import cors from "cors";
import rateLimit from "express-rate-limit";
import morgan from "morgan";
import path from "node:path";
import fs from "node:fs";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { Storage } from "@google-cloud/storage";
import { getSeoData } from "./seo-content.mjs";

// Importar sharp y definir opciones para el endpoint de API (producción).
import sharp from "sharp";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// --- CONFIG ---
const GCS_BUCKET_NAME = process.env.GCS_BUCKET_NAME || "botonone";
const storage = new Storage();
const BASE_URL = "https://beat.boton.one";
const SUPPORTED_LOCALES = [
  "en",
  "es",
  "pt-BR",
  "fr",
  "de",
  "ru",
  "ar",
  "ja",
  "ko",
  "zh-Hans",
  "it",
  "tr",
  "id",
  "th",
  "vi",
];
const DEFAULT_LOCALE = "en";

// Constantes necesarias para la API de imágenes
const WEBP_OPTIONS = { quality: 85, effort: 4, smartSubsample: true };

// --- SECURITY UTILS ---
const escapeHtml = (unsafe) => {
  return String(unsafe ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
};

const buildSafeUrl = (p) => encodeURI(`${BASE_URL}${p}`);

// --- HELPERS ---
function normalizeWord(s) {
  return String(s ?? "").trim().toLowerCase().normalize("NFC");
}
const VALID_WORD_REGEX = /^[\p{L}\p{N}\p{M}\s\-]+$/u;
function getCacheKey(wordsArray) {
  return crypto.createHash("md5").update(wordsArray.join("|")).digest("hex");
}

// --- CACHE HELPERS (NO FUNCTIONAL IMPACT) ---
const IMMUTABLE_1Y = "public, max-age=31536000, immutable";

// --- BOOTSTRAP (ANTI-FLICKER, NO FUNCTIONAL IMPACT) ---
const DEFAULT_BOOT_WORDS = ["Beat", "Flow", "Grid", "Play"];

// Mantiene la misma semántica Title Case que ya usas en SEO para /share/:slug.
function parseShareSlugToWordsArray(slug) {
  const raw = String(slug ?? "").trim();
  if (!raw) return null;

  const parts = raw
    .split("-")
    .map((w) => String(w ?? "").trim())
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1));

  return parts.length === 4 ? parts : null;
}

function requestAcceptsHtml(req) {
  const accept = String(req.headers.accept || "").toLowerCase();

  // Si no hay Accept, se asume navegación genérica.
  if (!accept) return true;

  // Navegación típica de browsers: incluye text/html o application/xhtml+xml.
  if (accept.includes("text/html") || accept.includes("application/xhtml+xml")) return true;

  // Wildcard: el cliente acepta cualquier tipo (ej: curl por defecto, algunos bots).
  if (accept.includes("*/*")) return true;

  return false;
}

export function createApp({ distDir = path.resolve(__dirname, "../dist") } = {}) {
  const app = express();
  let indexTemplate = "";

  try {
    const indexPath = path.join(distDir, "index.html");
    if (fs.existsSync(indexPath)) indexTemplate = fs.readFileSync(indexPath, "utf-8");
  } catch (e) {
    console.error("❌ [Server] Failed to load index.html template:", e);
  }

  // 1. MIDDLEWARES
  app.set("trust proxy", 1);

  app.use((req, res, next) => {
    req.requestId = req.headers["x-request-id"] || crypto.randomUUID();
    res.setHeader("X-Request-Id", req.requestId);
    next();
  });

  app.use(
    morgan(":method :url :status :res[content-length] - :response-time ms", {
      skip: (req) => req.url === "/healthz" || req.url.startsWith("/assets/"),
    })
  );

  app.use(
    helmet({
      contentSecurityPolicy: {
        useDefaults: true,
        directives: {
          defaultSrc: ["'self'"],
          baseUri: ["'self'"],
          imgSrc: ["'self'", "data:", "blob:", "https:", "https://storage.googleapis.com"],
          mediaSrc: ["'self'", "blob:", "https:"],
          connectSrc: [
            "'self'",
            "https://generativelanguage.googleapis.com",
            "https://storage.googleapis.com",
          ],
          scriptSrc: ["'self'", "'unsafe-inline'", "https://storage.googleapis.com"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          fontSrc: ["'self'", "data:"],
        },
      },
      crossOriginEmbedderPolicy: false,
    })
  );

  app.use(cors({ origin: false }));
  app.use(compression({ level: 6 }));
  app.use(express.json({ limit: "64kb" }));

  // ------------------------------------------------------------------------------------
  // STATE OF THE ART HARDENING
  // ------------------------------------------------------------------------------------
  app.get("/:lang/:file(favicon\\.ico|manifest\\.webmanifest|sw\\.js)", (req, res, next) => {
    const { lang, file } = req.params;
    if (!SUPPORTED_LOCALES.includes(lang)) return next();
    return res.redirect(301, `/${file}`);
  });

  app.get("/:lang/:kind(assets|fonts|images|audio|locales)/*", (req, res, next) => {
    const { lang, kind } = req.params;
    if (!SUPPORTED_LOCALES.includes(lang)) return next();
    const rest = req.params[0] || "";
    return res.redirect(301, `/${kind}/${rest}`);
  });

  // 2. INFRAESTRUCTURA
  app.get("/healthz", (_, res) => res.send("ok"));

  app.get("/favicon.ico", (_, res) => {
    const favPath = path.join(distDir, "favicon.ico");
    if (fs.existsSync(favPath)) {
      res.setHeader("Cache-Control", "public, max-age=86400");
      res.sendFile(favPath);
    } else {
      res.status(204).end();
    }
  });

  // 3. SEO: SITEMAP & ROBOTS
  app.get("/sitemap.xml", (_, res) => {
    res.setHeader("Content-Type", "application/xml");
    res.setHeader("Cache-Control", "public, max-age=3600");
    const lastMod = new Date().toISOString().split("T")[0];

    const alternatesBlock =
      SUPPORTED_LOCALES
        .map((l) => `<xhtml:link rel="alternate" hreflang="${l}" href="${buildSafeUrl(`/${l}`)}"/>`)
        .join("") +
      `<xhtml:link rel="alternate" hreflang="x-default" href="${buildSafeUrl(`/${DEFAULT_LOCALE}`)}"/>`;

    let xml =
      `<?xml version="1.0" encoding="UTF-8"?>` +
      `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">`;

    xml += `\n  <url><loc>${buildSafeUrl(
      `/${DEFAULT_LOCALE}`
    )}</loc><lastmod>${lastMod}</lastmod><priority>1.0</priority>${alternatesBlock}</url>`;

    SUPPORTED_LOCALES.filter((l) => l !== DEFAULT_LOCALE).forEach((lang) => {
      xml += `\n  <url><loc>${buildSafeUrl(
        `/${lang}`
      )}</loc><lastmod>${lastMod}</lastmod><priority>0.8</priority>${alternatesBlock}</url>`;
    });

    xml += `\n</urlset>`;
    res.send(xml.trim());
  });

  app.get("/robots.txt", (_, res) => {
    res
      .type("text/plain")
      .send(
        `User-agent: *\nAllow: /\nDisallow: /api/\nDisallow: /healthz\n\nSitemap: ${BASE_URL}/sitemap.xml`
      );
  });

  // 4. API & STATIC ASSETS
  const apiLimiter = rateLimit({ windowMs: 60000, max: 20 });

  app.post("/api/spritesheet", apiLimiter, async (req, res, next) => {
    try {
      const { words } = req.body ?? {};
      if (!Array.isArray(words) || words.length !== 4) {
        return res.status(400).json({ error: "Invalid payload" });
      }

      const cleaned = words.map(normalizeWord);
      for (const w of cleaned) {
        if (!w || w.length < 1 || w.length > 30 || !VALID_WORD_REGEX.test(w)) {
          return res.status(400).json({ error: "Invalid words" });
        }
      }

      const fileHash = getCacheKey(cleaned);
      const fileNameWebp = `sprites/${fileHash}.webp`;
      const fileNamePng = `sprites/${fileHash}.png`;
      const bucket = storage.bucket(GCS_BUCKET_NAME);
      const fileWebp = bucket.file(fileNameWebp);

      const [existsWebp] = await fileWebp.exists();
      if (existsWebp) {
        return res.status(200).json({
          url: `https://storage.googleapis.com/${GCS_BUCKET_NAME}/${fileNameWebp}`,
          cached: true,
        });
      }

      const filePng = bucket.file(fileNamePng);
      const [existsPng] = await filePng.exists();
      if (existsPng) {
        return res.status(200).json({
          url: `https://storage.googleapis.com/${GCS_BUCKET_NAME}/${fileNamePng}`,
          cached: true,
        });
      }

      const apiKey = process.env.GEMINI_API_KEY || process.env.GEMINIAPIKEY;
      if (!apiKey) return res.status(500).json({ error: "Configuration Error" });

      const { GoogleGenAI } = await import("@google/genai");
      const ai = new GoogleGenAI({ apiKey });

      const prompt =
        `Create a photorealistic 2x2 grid image (4 equal quadrants). ` +
        `STRICT NEGATIVE CONSTRAINTS: NO TEXT, NO WRITING, NO LETTERS. ` +
        `Visuals for: 1."${cleaned[0]}", 2."${cleaned[1]}", 3."${cleaned[2]}", 4."${cleaned[3]}". ` +
        `Style: Professional product photography, white background.`;

      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash-image",
        contents: [{ parts: [{ text: prompt }] }],
        config: { imageConfig: { aspectRatio: "1:1" } },
      });

      const part = response?.candidates?.[0]?.content?.parts?.find((p) => p?.inlineData?.data);
      if (!part?.inlineData?.data) throw new Error("AI Generation Failed");

      const buffer = Buffer.from(part.inlineData.data, "base64");

      let outputBuffer;
      try {
        outputBuffer = await sharp(buffer).webp(WEBP_OPTIONS).toBuffer();
      } catch {
        outputBuffer = buffer;
      }

      await fileWebp.save(outputBuffer, {
        metadata: { contentType: "image/webp", cacheControl: IMMUTABLE_1Y },
        resumable: false,
      });

      return res.status(200).json({
        url: `https://storage.googleapis.com/${GCS_BUCKET_NAME}/${fileNameWebp}`,
        cached: false,
      });
    } catch (e) {
      next(e);
    }
  });

  // Assets
  app.use("/assets", express.static(path.join(distDir, "assets"), { immutable: true, maxAge: "365d" }));
  app.use("/fonts", express.static(path.join(distDir, "fonts"), { immutable: true, maxAge: "365d" }));
  app.use("/locales", express.static(path.join(distDir, "locales"), { immutable: true, maxAge: "365d" }));

  // Imágenes
  app.use(
    "/images",
    express.static(path.join(distDir, "images"), {
      maxAge: "365d",
      setHeaders: (r) => r.setHeader("Cache-Control", IMMUTABLE_1Y),
    })
  );

  // Audio
  app.use(
    "/audio",
    express.static(path.join(distDir, "audio"), {
      maxAge: "365d",
      setHeaders: (r) => r.setHeader("Cache-Control", IMMUTABLE_1Y),
    })
  );

  app.get("/sw.js", (_, r) =>
    r.sendFile(path.join(distDir, "sw.js"), { headers: { "Cache-Control": "no-cache, must-revalidate" } })
  );

  app.get("/manifest.webmanifest", (_, r) =>
    r.sendFile(path.join(distDir, "manifest.webmanifest"), {
      headers: { "Content-Type": "application/manifest+json", "Cache-Control": "public, max-age=0" },
    })
  );

  app.use(express.static(distDir, { index: false, maxAge: "1h" }));

  // 5. SEO HANDLER
  app.get("*", (req, res) => {
    if (!requestAcceptsHtml(req)) return res.status(404).send("Not found");

    const urlPath = req.path;
    if (urlPath.includes(".") && !urlPath.endsWith(".html")) return res.status(404).send("Not found");

    const segments = urlPath.split("/").filter(Boolean);
    const firstSegment = segments[0];

    // A. Redirects & Normalization
    if (urlPath === "/" || segments.length === 0) {
      return serveHtml(req, res, DEFAULT_LOCALE, false, indexTemplate);
    }

    const exactMatch = SUPPORTED_LOCALES.find((l) => l === firstSegment);
    const caseInsensitiveMatch =
      !exactMatch && SUPPORTED_LOCALES.find((l) => l.toLowerCase() === firstSegment?.toLowerCase());

    if (caseInsensitiveMatch) {
      const newPath = `/${caseInsensitiveMatch}/${segments.slice(1).join("/")}`;
      const qs = req.url.split("?")[1] ? "?" + req.url.split("?")[1] : "";
      return res.redirect(301, newPath + qs);
    }

    if (!exactMatch) {
      const newPath = `/${DEFAULT_LOCALE}${urlPath}`;
      const qs = req.url.split("?")[1] ? "?" + req.url.split("?")[1] : "";
      return res.redirect(301, newPath + qs);
    }

    // B. Serve Content
    return serveHtml(req, res, firstSegment, true, indexTemplate);
  });

  function serveHtml(req, res, lang, isLocalizedUrl, template) {
    try {
      const seoData = getSeoData(lang);

      const pathWithoutLang = isLocalizedUrl ? "/" + req.path.split("/").slice(2).join("/") : req.path;
      const normalizedPathWithoutLang = pathWithoutLang === "" ? "/" : pathWithoutLang;

      // Canonical SIEMPRE apunta a la URL con idioma
      const rawCanonicalPath = `/${lang}${normalizedPathWithoutLang === "/" ? "" : normalizedPathWithoutLang}`;
      const canonicalUrl = buildSafeUrl(rawCanonicalPath);

      const hreflangs = SUPPORTED_LOCALES
        .map((loc) => {
          const p = `/${loc}${normalizedPathWithoutLang === "/" ? "" : normalizedPathWithoutLang}`;
          return `<link rel="alternate" hreflang="${loc}" href="${buildSafeUrl(p)}" />`;
        })
        .join("\n    ");

      // x-default apunta a "/en" (o DEFAULT_LOCALE) siempre
      const xDefaultPath = `/${DEFAULT_LOCALE}${
        normalizedPathWithoutLang === "/" ? "" : normalizedPathWithoutLang
      }`;
      const xDefault = `<link rel="alternate" hreflang="x-default" href="${buildSafeUrl(xDefaultPath)}" />`;

      // Data Prep
      let rawTitle = seoData.title;
      let rawDesc = seoData.description;
      let rawKeywords = seoData.keywords;

      // BOOT (anti-flicker)
      const isShare = normalizedPathWithoutLang.startsWith("/share/");
      let bootWords = DEFAULT_BOOT_WORDS;

      if (isShare) {
        const segs = req.path.split("/").filter(Boolean);
        const slug = segs[2];
        const shareWords = parseShareSlugToWordsArray(slug);
        if (shareWords) bootWords = shareWords;

        // Mantiene tu SEO dinámico existente
        if (slug) {
          const words = slug
            .split("-")
            .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
            .join(" / ");
          rawTitle = `Beat Challenge: ${words} | BeatGrid`;
          rawDesc = `Can you flow with these words? ${words}. Play BeatGrid now!`;
        }
      }

      const safeTitle = escapeHtml(rawTitle);
      const safeDesc = escapeHtml(rawDesc);
      const safeKeywords = escapeHtml(rawKeywords);
      const safeH1 = escapeHtml(seoData.h1);
      const safeP = escapeHtml(seoData.p);
      const safeCta = escapeHtml(seoData.cta);

      // --- CORRECCIÓN SEO: IMPLEMENTACIÓN DE SCHEMA WEBSITE Y CORRECCIÓN DE LOGO ---
      // Esto soluciona que Google muestre "boton.one" en lugar de "BeatGrid"

      // 1. Schema WebSite: Define el nombre oficial del sitio
      const websiteSchema = {
        "@context": "https://schema.org",
        "@type": "WebSite",
        name: "BeatGrid",
        alternateName: ["Beat Grid", "BeatGrid Game"],
        url: BASE_URL,
      };

      // 2. Schema VideoGame: Define la entidad del juego y corrige el logo de la organización
      // Apuntamos al icono de 512px en /pwa/ que SÍ existe en tu estructura de carpetas
      const gameSchema = {
        "@context": "https://schema.org",
        "@type": "VideoGame",
        name: "BeatGrid",
        description: rawDesc,
        inLanguage: lang,
        author: {
          "@type": "Organization",
          name: "BotonOne",
          url: BASE_URL,
          logo: {
            "@type": "ImageObject",
            url: `${BASE_URL}/pwa/icon-512.png`,
          },
        },
        image: `${BASE_URL}/images/og-preview.jpg`,
        keywords: rawKeywords,
        applicationCategory: "Game",
      };

      const safeWebsiteJsonLd = JSON.stringify(websiteSchema).replace(/</g, "\\u003c");
      const safeGameJsonLd = JSON.stringify(gameSchema).replace(/</g, "\\u003c");

      // Bootstrapped state
      const boot = {
        lang,
        routeKind: isShare ? "share" : "root",
        words: bootWords,
      };
      const safeBoot = JSON.stringify(boot).replace(/</g, "\\u003c");

      const headHtml = `
    <title>${safeTitle}</title>
    <meta name="description" content="${safeDesc}" />
    <meta name="keywords" content="${safeKeywords}" />
    <link rel="canonical" href="${canonicalUrl}" />
    <meta name="robots" content="index, follow, max-image-preview:large" />
    
    <meta property="og:title" content="${safeTitle}" />
    <meta property="og:description" content="${safeDesc}" />
    <meta property="og:locale" content="${lang}" />
    <meta property="og:site_name" content="BeatGrid" />
    <meta property="og:url" content="${canonicalUrl}" />
    <meta property="og:image" content="${BASE_URL}/images/og-preview.jpg" />
    <meta property="og:type" content="website" />
    
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${safeTitle}" />
    <meta name="twitter:description" content="${safeDesc}" />
    
    ${hreflangs}
    ${xDefault}
    
    <script type="application/ld+json">${safeWebsiteJsonLd}</script>
    <script type="application/ld+json">${safeGameJsonLd}</script>
    
    <script>window.__BOOT__=${safeBoot};</script>
      `;

      // SSR shell alineado con el layout inicial
      const appShellHtml = `
<div class="ssr-shell" id="ssr-shell" data-ssr-shell="true">
  <div class="h-100svh min-h-100svh w-full relative overflow-hidden bg-f0f0f0 box-border">
    <img
      src="/images/paper.webp"
      alt=""
      fetchpriority="high"
      decoding="async"
      class="absolute inset-0 w-full h-full object-cover mix-blend-multiply pointer-events-none z-0"
      style="background-color:#f0f0f0"
    />

    <audio preload="none" crossorigin="anonymous"></audio>

    <!-- CORNER ELEMENTS -->
    <div class="absolute top-2 sm:top-6 left-2 sm:left-6 text-5xl sm:text-7xl drop-shadow-md z-20 select-none pointer-events-none emoji-safe"
         style="transform: translate3d(0,0,0) rotate(-15deg) scale(1);">🍀</div>
    <div class="absolute top-2 sm:top-6 right-2 sm:right-6 text-5xl sm:text-7xl drop-shadow-md z-20 select-none pointer-events-none emoji-safe"
         style="transform: translate3d(0,0,0) rotate(15deg) scale(1);">⚡</div>
    <div class="absolute bottom-2 sm:bottom-6 left-2 sm:left-6 text-5xl sm:text-7xl drop-shadow-md z-20 select-none pointer-events-none emoji-safe"
         style="transform: translate3d(0,0,0) rotate(-10deg) scale(1);">🔥</div>
    <div class="absolute bottom-2 sm:bottom-6 right-2 sm:right-6 text-5xl sm:text-7xl drop-shadow-md z-20 select-none pointer-events-none emoji-safe"
         style="transform: translate3d(0,0,0) rotate(10deg) scale(1);">🎧</div>

    <!-- MENU LAYER (showMenu) -->
    <div class="absolute inset-0 z-30 w-full h-full overflow-y-scroll overflow-x-hidden no-scrollbar layer-transition visible-layer">
      <div class="min-h-full w-full flex flex-col items-center justify-center py-8 px-4 relative">

        <!-- Lang button (static, no dropdown logic in SSR) -->
        <div class="absolute top-4 left-12 -translate-x-12 z-50 w-auto">
          <button
            type="button"
            aria-label="Language selector"
            class="relative flex items-center gap-3 bg-white border-3px border-black px-4 py-1.5 pr-10 font-black text-black uppercase text-xs md:text-sm tracking-widest cursor-pointer rounded-lg select-none transition-all duration-200 ease-out shadow-4px4px0px0pxrgba(0,0,0,1)">
            <span class="text-black">${escapeHtml(String(lang || DEFAULT_LOCALE))}</span>
            <span class="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-black">
              <svg aria-hidden="true" focusable="false" class="w-4 h-4 transition-transform duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="4" d="M19 9l-7 7-7-7"></path>
              </svg>
            </span>
          </button>
        </div>

        <!-- Main card -->
        <div class="relative z-30 flex flex-col items-center gap-4 md:gap-8 text-center p-5 md:p-8 bg-white rounded-3xl border-4px md:border-6px border-black hard-shadow w-full max-w-2xl">
          <div class="flex items-center justify-between w-full gap-2 md:gap-4 mb-2 md:mb-0">
            <button
              type="button"
              aria-label="Previous"
              class="group relative flex items-center justify-center w-10 h-10 md:w-14 md:h-14 bg-white border-4 border-black shadow-4px4px0px0pxrgba(0,0,0,1) flex-shrink-0 rounded-lg transition-all duration-150">
              <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"
                class="w-5 h-5 md:w-7 md:h-7 text-black transition-transform group-hover:scale-110">
                <path d="M19 12H5M12 19l-7-7 7-7"></path>
              </svg>
            </button>

            <div class="flex flex-col gap-1 items-center transform -rotate-2 mx-auto">
              <h1 class="text-4xl md:text-6xl font-black text-black tracking-tighter uppercase leading-none">
                ${safeH1}
              </h1>
              <h2 class="text-xl md:text-3xl font-black text-white bg-ff0055 px-4 py-1 tracking-widest uppercase border-4 border-black inline-block transform rotate-1">
                ${safeP}
              </h2>
            </div>

            <button
              type="button"
              aria-label="Next"
              class="group relative flex items-center justify-center w-10 h-10 md:w-14 md:h-14 bg-white border-4 border-black shadow-4px4px0px0pxrgba(0,0,0,1) flex-shrink-0 rounded-lg transition-all duration-150">
              <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"
                class="w-5 h-5 md:w-7 md:h-7 text-black transition-transform group-hover:scale-110 rotate-180">
                <path d="M19 12H5M12 19l-7-7 7-7"></path>
              </svg>
            </button>
          </div>

          <!-- WordEditor (static skeleton matching structure/classes) -->
          <div class="flex flex-col gap-4 md:gap-6 max-w-3xl w-full">
            <div class="grid grid-cols-2 gap-3 md:gap-6">
              ${bootWords
                .map((w, i) => {
                  const safeW = escapeHtml(String(w ?? ""));
                  const safeAria = escapeHtml(`Word ${i + 1}`);
                  return `
                <div class="group relative bg-white border-4 border-black p-2 md:p-3 transition-all duration-200 shadow-4px4px0px0pxrgba(0,0,0,1) flex flex-col justify-between">
                  <div class="flex justify-start mb-0">
                    <span class="text-10px md:text-xs font-black text-white bg-black px-1.5 py-0.5 tracking-widest border-2 border-transparent">${i + 1}/4</span>
                  </div>
                  <input
                    type="text"
                    value="${safeW}"
                    autocomplete="off"
                    spellcheck="false"
                    aria-label="${safeAria}"
                    class="w-full bg-transparent border-b-4 border-gray-200 rounded-none px-0 py-0 md:py-1 text-xl md:text-2xl font-black text-black uppercase tracking-tight focus:outline-none focus:border-black transition-colors text-center placeholder:text-gray-300"
                    style="font-family: Montserrat, sans-serif;"
                    readonly
                  />
                </div>
              `;
                })
                .join("")}
            </div>

            <button
              type="button"
              class="relative overflow-hidden w-full rounded-xl py-3 md:py-5 px-4 md:px-8 text-lg md:text-2xl font-black tracking-tight uppercase transition-all border-4 border-black"
              style="background:#ffe600;color:#000;box-shadow:4px 4px 0px 0px rgba(0,0,0,1);font-family:Montserrat,sans-serif;"
            >
              <span class="relative z-10 flex items-center justify-center gap-3">${safeCta}</span>
            </button>
          </div>

          <!-- Recording toggle (static) -->
          <div class="w-full flex items-center justify-between bg-gray-50 border-4 border-black p-3 md:p-4 rounded-xl">
            <div class="flex flex-col items-start text-left">
              <span class="font-black uppercase text-sm md:text-lg text-black">Recording</span>
              <span class="text-10px md:text-xs font-bold text-gray-500 uppercase tracking-wide leading-tight">On</span>
            </div>
            <div class="relative w-12 md:w-16 h-7 md:h-8 rounded-full border-4 border-black bg-00ff99">
              <div class="absolute top-1/2 -translate-y-1/2 w-5 md:w-6 h-5 md:h-6 bg-white border-2 border-black rounded-full shadow-sm"
                   style="left: calc(100% - 1.5rem);"></div>
            </div>
          </div>
        </div>

      </div>
    </div>
  </div>
</div>
      `;

      // Reemplazo robusto de la etiqueta HTML entera
      const finalHtml = template
        .replace("<!--__INJECT_HEAD__-->", headHtml)
        .replace("<!--__INJECT_APP_SHELL__-->", appShellHtml)
        .replace(/<html[^>]*>/, `<html lang="${lang}" dir="${lang === "ar" ? "rtl" : "ltr"}">`);

      res.setHeader("Content-Language", lang);

      // Se mantiene (compat) aunque aquí no cambies contenido por Accept-Language.
      if (!isLocalizedUrl) res.setHeader("Vary", "Accept-Language");

      res.setHeader("Cache-Control", "public, max-age=0, must-revalidate");
      return res.status(200).send(finalHtml);
    } catch (e) {
      console.error("SSR Error:", e);
      return res.sendFile(path.join(distDir, "index.html"));
    }
  }

  app.use((err, req, res, next) => {
    console.error(`[${req.requestId}] Error:`, err);
    res.status(500).json({ error: "Internal Server Error" });
  });

  return app;
}