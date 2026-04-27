// scripts/prerender.mjs
import path from "node:path";
import fs from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { getSeoData } from "../server/seo-content.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SUPPORTED_LOCALES =[
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

const DEFAULT_BOOT_WORDS = ["Beat", "Flow", "Grid", "Play"];

function getBaseUrlFromEnvOrDefault() {
  const env = String(process.env.BASE_URL || process.env.PUBLIC_BASE_URL || "").trim();
  return env || "https://beat.boton.one";
}

function escapeHtml(unsafe) {
  return String(unsafe ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function buildSafeUrl(baseUrl, p) {
  return encodeURI(`${baseUrl}${p}`);
}

function parseArgs(argv) {
  const args = {
    distDir: null,
    baseUrl: null,
    clean: false,
    locales: null,
  };

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];

    if (a === "--dist" && argv[i + 1]) {
      args.distDir = argv[++i];
      continue;
    }
    if (a === "--base-url" && argv[i + 1]) {
      args.baseUrl = argv[++i];
      continue;
    }
    if (a === "--clean") {
      args.clean = true;
      continue;
    }
    if (a === "--locales" && argv[i + 1]) {
      args.locales = argv[++i]
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      continue;
    }
  }

  return args;
}

async function pathExists(p) {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

async function rmDirIfExists(dir) {
  if (!(await pathExists(dir))) return;
  await fs.rm(dir, { recursive: true, force: true });
}

function buildHeadHtml({
  baseUrl,
  lang,
  pathWithoutLang,
  seoData,
}) {
  const lastMod = new Date().toISOString().split("T")[0]; 
  void lastMod;

  const rawCanonicalPath = `/${lang}${pathWithoutLang === "/" ? "" : pathWithoutLang}`;
  const canonicalUrl = buildSafeUrl(baseUrl, rawCanonicalPath);

  const hreflangs = SUPPORTED_LOCALES.map((loc) => {
    const p = `/${loc}${pathWithoutLang === "/" ? "" : pathWithoutLang}`;
    return `<link rel="alternate" hreflang="${loc}" href="${buildSafeUrl(baseUrl, p)}" />`;
  }).join("\n    ");

  const xDefaultPath = `/${DEFAULT_LOCALE}${pathWithoutLang === "/" ? "" : pathWithoutLang}`;
  const xDefault = `<link rel="alternate" hreflang="x-default" href="${buildSafeUrl(baseUrl, xDefaultPath)}" />`;

  const rawTitle = seoData.title;
  const rawDesc = seoData.description;
  const rawKeywords = seoData.keywords;

  const safeTitle = escapeHtml(rawTitle);
  const safeDesc = escapeHtml(rawDesc);
  const safeKeywords = escapeHtml(rawKeywords);

  const websiteSchema = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "name": "BeatGrid",
    "alternateName": ["Beat Grid", "BeatGrid Game"],
    "url": baseUrl
  };

  const gameSchema = {
    "@context": "https://schema.org",
    "@type": "VideoGame",
    "name": "BeatGrid",
    "description": rawDesc,
    "inLanguage": lang,
    "author": { 
        "@type": "Organization", 
        "name": "BotonOne",
        "url": baseUrl,
        "logo": {
            "@type": "ImageObject",
            "url": `${baseUrl}/pwa/icon-512.png` 
        }
    },
    "image": `${baseUrl}/images/og-preview.jpg`,
    "keywords": rawKeywords,
    "applicationCategory": "Game",
  };

  const safeWebsiteJsonLd = JSON.stringify(websiteSchema).replace(/</g, "\\u003c");
  const safeGameJsonLd = JSON.stringify(gameSchema).replace(/</g, "\\u003c");
  
  const boot = {
    lang,
    routeKind: "root",
    words: DEFAULT_BOOT_WORDS,
  };
  const safeBoot = JSON.stringify(boot).replace(/</g, "\\u003c");

  return `
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
    <meta property="og:image" content="${baseUrl}/images/og-preview.jpg" />
    <meta property="og:type" content="website" />
    
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${safeTitle}" />
    <meta name="twitter:description" content="${safeDesc}" />
    
    ${hreflangs}
    ${xDefault}
    
    <!-- INYECCIÓN DE SCHEMAS CORREGIDOS -->
    <script type="application/ld+json">${safeWebsiteJsonLd}</script>
    <script type="application/ld+json">${safeGameJsonLd}</script>
    
    <script>window.__BOOT__=${safeBoot};</script>
  `.trim();
}

function buildAppShellHtml({ lang, seoData }) {
  const safeH1 = escapeHtml(seoData.h1);
  const safeP = escapeHtml(seoData.p);
  const safeCta = escapeHtml(seoData.cta);

  const wordsChipsHtml = DEFAULT_BOOT_WORDS.map((w, i) => {
    const safeW = escapeHtml(w);
    const safeAria = escapeHtml(`Word ${i + 1}`);
    return `
      <div class="group relative bg-white border-4 border-black p-2 md:p-3 transition-all duration-200 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] flex flex-col justify-between">
        <div class="flex justify-start mb-0">
          <span class="text-[10px] md:text-xs font-black text-white bg-black px-1.5 py-0.5 tracking-widest border-2 border-transparent">•</span>
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
    `.trim();
  }).join("\n");

  return `
<div class="ssr-shell" id="ssr-shell" data-ssr-shell="true">
  <div class="h-100svh min-h-100svh w-full relative overflow-hidden bg-[#f0f0f0] box-border">
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

    <!-- MENU LAYER (visible) -->
    <div class="absolute inset-0 z-30 w-full h-full overflow-y-scroll overflow-x-hidden no-scrollbar layer-transition visible-layer">
      <div class="min-h-full w-full flex flex-col items-center justify-center py-8 px-4 relative">

        <!-- Lang button (static) -->
        <div class="absolute top-4 left-12 -translate-x-12 z-50 w-auto">
          <button
            type="button"
            aria-label="Language selector"
            class="relative flex items-center gap-3 bg-white border-[3px] border-black px-4 py-1.5 pr-10 font-black text-black uppercase text-xs md:text-sm tracking-widest cursor-pointer rounded-lg select-none transition-all duration-200 ease-out shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
            <span class="text-black">${escapeHtml(lang)}</span>
            <span class="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-black">
              <svg aria-hidden="true" focusable="false" class="w-4 h-4 transition-transform duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="4" d="M19 9l-7 7-7-7"></path>
              </svg>
            </span>
          </button>
        </div>

        <!-- Main card -->
        <div class="relative z-30 flex flex-col items-center gap-4 md:gap-8 text-center p-5 md:p-8 bg-white rounded-3xl border-4 md:border-[6px] border-black hard-shadow w-full max-w-2xl">
          <div class="flex items-center justify-between w-full gap-2 md:gap-4 mb-2 md:mb-0">
            <button
              type="button"
              aria-label="Previous"
              class="group relative flex items-center justify-center w-10 h-10 md:w-14 md:h-14 bg-white border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] shrink-0 rounded-lg transition-all duration-150">
              <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"
                class="w-5 h-5 md:w-7 md:h-7 text-black transition-transform group-hover:scale-110">
                <path d="M19 12H5M12 19l-7-7 7-7"></path>
              </svg>
            </button>

            <div class="flex flex-col gap-1 items-center transform -rotate-2 mx-auto">
              <h1 class="text-4xl md:text-6xl font-black text-black tracking-tighter uppercase leading-none">
                ${safeH1}
              </h1>
              <h2 class="text-xl md:text-3xl font-black text-white bg-[#ff0055] px-4 py-1 tracking-widest uppercase border-4 border-black inline-block transform rotate-1">
                ${safeP}
              </h2>
            </div>

            <button
              type="button"
              aria-label="Next"
              class="group relative flex items-center justify-center w-10 h-10 md:w-14 md:h-14 bg-white border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] shrink-0 rounded-lg transition-all duration-150">
              <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"
                class="w-5 h-5 md:w-7 md:h-7 text-black transition-transform group-hover:scale-110 rotate-180">
                <path d="M19 12H5M12 19l-7-7 7-7"></path>
              </svg>
            </button>
          </div>

          <!-- Word grid (static) -->
          <div class="flex flex-col gap-4 md:gap-6 max-w-3xl w-full">
            <div class="grid grid-cols-2 gap-3 md:gap-6">
              ${wordsChipsHtml}
            </div>

            <a
              href="/${escapeHtml(lang)}"
              class="relative overflow-hidden w-full rounded-xl py-3 md:py-5 px-4 md:px-8 text-lg md:text-2xl font-black tracking-tight uppercase transition-all border-4 border-black"
              style="background:#ffe600;color:#000;box-shadow:4px 4px 0px 0px rgba(0,0,0,1);font-family:Montserrat,sans-serif;text-decoration:none;"
            >
              <span class="relative z-10 flex items-center justify-center gap-3">${safeCta}</span>
            </a>
          </div>

          <!-- Recording toggle (static) -->
          <div class="w-full flex items-center justify-between bg-gray-50 border-4 border-black p-3 md:p-4 rounded-xl">
            <div class="flex flex-col items-start text-left">
              <span class="font-black uppercase text-sm md:text-lg text-black">Recording</span>
              <span class="text-[10px] md:text-xs font-bold text-gray-500 uppercase tracking-wide leading-tight">On</span>
            </div>
            <div class="relative w-12 md:w-16 h-7 md:h-8 rounded-full border-4 border-black bg-[#00ff99]">
              <div class="absolute top-1/2 -translate-y-1/2 w-5 md:w-6 h-5 md:h-6 bg-white border-2 border-black rounded-full shadow-sm"
                   style="left: calc(100% - 1.5rem);"></div>
            </div>
          </div>
        </div>

      </div>
    </div>
  </div>
</div>
  `.trim();
}

function injectIntoTemplate({ template, headHtml, appShellHtml, lang }) {
  if (!template.includes("<!--__INJECT_HEAD__-->") || !template.includes("<!--__INJECT_APP_SHELL__-->")) {
    throw new Error(
      "index.html template missing injection markers <!--__INJECT_HEAD__--> / <!--__INJECT_APP_SHELL__-->"
    );
  }

  const dir = lang === "ar" ? "rtl" : "ltr";

  return template
    .replace("<!--__INJECT_HEAD__-->", headHtml)
    .replace("<!--__INJECT_APP_SHELL__-->", appShellHtml)
    .replace(/<html[^>]*>/, `<html lang="${lang}" dir="${dir}">`);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  const projectRoot = path.resolve(__dirname, "..");
  const distDir = path.resolve(projectRoot, args.distDir || "dist");
  const baseUrl = String(args.baseUrl || getBaseUrlFromEnvOrDefault()).trim();

  const locales = (args.locales && args.locales.length ? args.locales : SUPPORTED_LOCALES).filter((l) =>
    SUPPORTED_LOCALES.includes(l)
  );

  if (!locales.length) {
    throw new Error("No valid locales to prerender. Check --locales or SUPPORTED_LOCALES.");
  }

  const templatePath = path.join(distDir, "index.html");
  const template = await fs.readFile(templatePath, "utf-8");

  const outRoot = distDir;

  if (args.clean) {
    for (const loc of locales) {
      await rmDirIfExists(path.join(outRoot, loc));
    }
  }

  for (const lang of locales) {
    const seoData = getSeoData(lang);

    const headHtml = buildHeadHtml({
      baseUrl,
      lang,
      pathWithoutLang: "/",
      seoData,
    });

    const appShellHtml = buildAppShellHtml({ lang, seoData });

    const finalHtml = injectIntoTemplate({
      template,
      headHtml,
      appShellHtml,
      lang,
    });

    const outDir = path.join(outRoot, lang);
    const outPath = path.join(outDir, "index.html");

    await fs.mkdir(outDir, { recursive: true });
    await fs.writeFile(outPath, finalHtml, "utf-8");
  }

  process.stdout.write(
    `✅ prerender.mjs: Generated ${locales.length} localized pages into ${distDir}/<locale>/index.html (baseUrl=${baseUrl})\n`
  );
}

main().catch((err) => {
  process.stderr.write(`❌ prerender.mjs failed: ${err?.stack || err}\n`);
  process.exitCode = 1;
});