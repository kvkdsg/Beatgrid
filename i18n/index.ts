import i18n, { type Resource } from "i18next";
import { initReactI18next } from "react-i18next";

import {
  APP_LANGUAGE_STORAGE_KEY,
  DEFAULT_LOCALE,
  FALLBACK_LOCALE,
  SUPPORTED_LOCALES,
  type AppLocale,
  getBestLocaleFromList,
  isRtlLocale,
  toSupportedLocale,
} from "./config";

/**
 * window.__BOOT__ se inyecta desde SSR/prerender para alinear HTML inicial con el arranque del cliente.
 * Tipado defensivo: no asume forma ni existencia.
 */
declare global {
  interface Window {
    __BOOT__?: {
      lang?: string;
      // Se permiten campos adicionales sin tiparlos para no acoplar el cliente al servidor.
      [k: string]: unknown;
    };
  }
}

// --- VITE (BUNDLER-NATIVE) LOADER ---
// Carga JSON desde el bundle vía import dinámico (sin fetch, coherente con Vite dev/prod).
// Importante: Vite genera keys case-sensitive exactamente como están en disco.
const commonLoaders = import.meta.glob("./locales/*/common.json") as Record<
  string,
  () => Promise<{ default: Record<string, unknown> }>
>;

function commonPath(locale: AppLocale): string {
  return `./locales/${locale}/common.json`;
}

/**
 * STATE OF THE ART (NO FUNCTIONAL IMPACT):
 * Precomputamos un índice case-insensitive para evitar coste de Object.keys/find
 * en cada llamada a loadCommon (micro-optimización de main-thread).
 */
const COMMON_LOADER_KEY_BY_LOWER = (() => {
  const m = new Map<string, string>();
  for (const k of Object.keys(commonLoaders)) m.set(k.toLowerCase(), k);
  return m;
})();

async function loadCommon(locale: AppLocale): Promise<Record<string, unknown>> {
  const exactKey = commonPath(locale);

  let loader = commonLoaders[exactKey];

  // Recuperación ante mismatch de mayúsculas/minúsculas (Linux/Docker case-sensitive).
  if (!loader) {
    const foundKey = COMMON_LOADER_KEY_BY_LOWER.get(exactKey.toLowerCase());
    if (foundKey) loader = commonLoaders[foundKey];
  }

  if (!loader) {
    // Mantiene tu semántica: fallback al FALLBACK_LOCALE si el locale no existe.
    if (locale !== FALLBACK_LOCALE) return loadCommon(FALLBACK_LOCALE);
    return {};
  }

  try {
    const mod = await loader();
    return (mod?.default ?? {}) as Record<string, unknown>;
  } catch {
    // Mantiene tu semántica: no romper runtime; fallback si procede.
    if (locale !== FALLBACK_LOCALE) return loadCommon(FALLBACK_LOCALE);
    return {};
  }
}

/**
 * STATE OF THE ART (ANTI-FLICKER, NO FUNCTIONAL IMPACT):
 * Garantiza que el namespace "common" del locale objetivo esté disponible en memoria
 * ANTES de ejecutar i18n.changeLanguage(locale), eliminando la ventana donde i18next
 * caería a fallbackLng por ausencia temporal de recursos.
 *
 * - No altera la semántica de fallback: si el JSON del locale no existe o falla, loadCommon
 *   sigue devolviendo el fallback y se registra bajo el locale pedido (igual que tu handler actual).
 * - Se cachea la Promesa por locale para deduplicar imports si el usuario cambia rápido de idioma.
 */
const commonPromiseByLocale = new Map<AppLocale, Promise<Record<string, unknown>>>();

async function ensureCommonLoaded(locale: AppLocale): Promise<void> {
  // Si ya está registrado, no hay nada que hacer.
  if (i18n.hasResourceBundle(locale, "common")) return;

  let p = commonPromiseByLocale.get(locale);
  if (!p) {
    p = loadCommon(locale);
    commonPromiseByLocale.set(locale, p);
  }

  const data = await p;

  // addResourceBundle es idempotente con deep/overwrite (últimos 2 flags en true) según tu semántica actual.
  i18n.addResourceBundle(locale, "common", data, true, true);
}

// --- DETECCIÓN MANUAL (se mantiene tu lógica) ---
function readPathLocale(): AppLocale | null {
  if (typeof window === "undefined") return null;
  try {
    const segment = window.location.pathname.split("/")[1];
    return toSupportedLocale(segment);
  } catch {
    return null;
  }
}

/**
 * Boot locale (SSR/prerender):
 * - NO cambia la precedencia funcional existente: el path sigue siendo prioridad.
 * - Solo actúa como “hint” cuando no hay lang en path.
 */
function readBootLocale(): AppLocale | null {
  if (typeof window === "undefined") return null;
  try {
    const bootLang = window.__BOOT__?.lang;
    return toSupportedLocale(bootLang);
  } catch {
    return null;
  }
}

function resolveInitialLocale(): AppLocale {
  const fromPath = readPathLocale();
  if (fromPath) return fromPath;

  const fromBoot = readBootLocale();
  if (fromBoot) return fromBoot;

  if (typeof window !== "undefined") {
    const url = new URL(window.location.href);

    const fromQuery = toSupportedLocale(url.searchParams.get("lang"));
    if (fromQuery) return fromQuery;

    const fromStorage = toSupportedLocale(window.localStorage.getItem(APP_LANGUAGE_STORAGE_KEY));
    if (fromStorage) return fromStorage;
  }

  if (typeof navigator !== "undefined") {
    return getBestLocaleFromList(navigator.languages as string[]) || DEFAULT_LOCALE;
  }

  return DEFAULT_LOCALE;
}

// --- INIT ---
let initPromise: Promise<typeof i18n> | null = null;

export function initI18n(): Promise<typeof i18n> {
  if (initPromise) return initPromise;

  initPromise = (async () => {
    const initialLocale = resolveInitialLocale();

    // Mantiene tu semántica: el primer render espera a i18nReady,
    // así que cargamos "common" de initialLocale antes de init.
    const common = await loadCommon(initialLocale);
    const resources: Resource = { [initialLocale]: { common } };

    /**
     * STATE OF THE ART (NO FUNCTIONAL IMPACT):
     * Se elimina i18next-browser-languagedetector porque:
     * - Ya se fija lng explícitamente con resolveInitialLocale().
     * - Ya se persiste el idioma en localStorage en languageChanged.
     * Resultado: menos JS inicial + menos coste/ruido en main-thread.
     */
    await i18n.use(initReactI18next).init({
      resources,
      lng: initialLocale,
      fallbackLng: FALLBACK_LOCALE,
      supportedLngs: [...SUPPORTED_LOCALES],
      load: "currentOnly",
      ns: ["common"],
      defaultNS: "common",

      /**
       * Se mantiene el bloque "detection" por compatibilidad futura y coherencia documental,
       * pero NO tiene efecto sin el plugin LanguageDetector.
       */
      detection: {
        order: ["path", "htmlTag", "localStorage", "navigator"],
        lookupFromPathIndex: 0,
        caches: ["localStorage"],
        htmlTag: document.documentElement,
      },

      interpolation: { escapeValue: false },
      react: { useSuspense: false },
    });

    document.documentElement.lang = initialLocale;
    document.documentElement.dir = isRtlLocale(initialLocale) ? "rtl" : "ltr";

    i18n.on("languageChanged", async (lng) => {
      const next = toSupportedLocale(lng) ?? DEFAULT_LOCALE;

      // Mantiene tu semántica original: si no existe bundle, se carga on-demand.
      // Con la corrección anti-flicker, setLocale() ya habrá garantizado esto antes del changeLanguage,
      // por lo que normalmente este bloque será un no-op durante cambios vía setLocale.
      if (!i18n.hasResourceBundle(next, "common")) {
        await ensureCommonLoaded(next);
      }

      document.documentElement.lang = next;
      document.documentElement.dir = isRtlLocale(next) ? "rtl" : "ltr";

      localStorage.setItem(APP_LANGUAGE_STORAGE_KEY, next);
    });

    return i18n;
  })();

  return initPromise;
}

export { i18n };
export const i18nReady = initI18n();

export async function setLocale(locale: AppLocale): Promise<void> {
  await i18nReady;

  // ANTI-FLICKER: precarga determinista del namespace requerido.
  await ensureCommonLoaded(locale);

  // Conserva la API y el comportamiento: cambia idioma exactamente igual,
  // pero ya sin ventana de fallbackLng por recursos ausentes.
  await i18n.changeLanguage(locale);
}
