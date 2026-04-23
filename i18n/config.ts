    export const APP_LANGUAGE_STORAGE_KEY = 'bg.locale' as const;

    export const SUPPORTED_LOCALES = [
      'en',
      'es',
      'pt-BR',
      'fr',
      'de',
      'it',
      'ru',
      'ar',
      'ja',
      'ko',
      'zh-Hans',
      'tr',
      'id',
      'th',
      'vi'
    ] as const;

    export type AppLocale = (typeof SUPPORTED_LOCALES)[number];

    export const DEFAULT_LOCALE: AppLocale = 'en';
    export const FALLBACK_LOCALE: AppLocale = 'en';

    // [CORRECCIÓN]: Mapa exhaustivo de alias normalizados (minúsculas) a Carpetas Reales (Case Sensitive)
    const LOCALE_ALIASES: Readonly<Record<string, AppLocale>> = Object.freeze({
      // English
      en: 'en', 'en-us': 'en', 'en-gb': 'en', 'en-au': 'en', 'en-ca': 'en',

      // Spanish
      es: 'es', 'es-es': 'es', 'es-mx': 'es', 'es-ar': 'es', 'es-419': 'es', 'es-us': 'es',

      // Portuguese (Brazil - Folder is pt-BR)
      pt: 'pt-BR', 'pt-br': 'pt-BR', 'pt-pt': 'pt-BR',

      // French
      fr: 'fr', 'fr-fr': 'fr', 'fr-ca': 'fr', 'fr-ch': 'fr', 'fr-be': 'fr',

      // German
      de: 'de', 'de-de': 'de', 'de-at': 'de', 'de-ch': 'de',

      // Italian
      it: 'it', 'it-it': 'it', 'it-ch': 'it',

      // Russian
      ru: 'ru', 'ru-ru': 'ru',

      // Arabic
      ar: 'ar', 'ar-sa': 'ar', 'ar-ae': 'ar', 'ar-eg': 'ar',

      // Japanese
      ja: 'ja', 'ja-jp': 'ja',

      // Korean
      ko: 'ko', 'ko-kr': 'ko',

      // Chinese (Simplified - Folder is zh-Hans)
      zh: 'zh-Hans', 'zh-cn': 'zh-Hans', 'zh-sg': 'zh-Hans', 
      'zh-hans': 'zh-Hans', 'zh-hans-cn': 'zh-Hans',

      // Turkish
      tr: 'tr', 'tr-tr': 'tr',

      // Indonesian
      id: 'id', 'id-id': 'id', 'in': 'id', 'in-id': 'id',

      // Thai
      th: 'th', 'th-th': 'th',

      // Vietnamese
      vi: 'vi', 'vi-vn': 'vi'
    });

    export function isSupportedLocale(locale: string): locale is AppLocale {
      return (SUPPORTED_LOCALES as readonly string[]).includes(locale);
    }

    function normalizeRawLocale(input: string): string {
      return input.trim().replace(/_/g, '-').toLowerCase();
    }

    /**
     * Convierte input (navigator/localStorage) al nombre EXACTO de la carpeta.
     */
    export function toSupportedLocale(raw: string | null | undefined): AppLocale | null {
      if (!raw) return null;

      const n = normalizeRawLocale(raw);

      // 1. Búsqueda exacta en alias (prioridad máxima para resolver mayúsculas correctas)
      if (LOCALE_ALIASES[n]) {
        return LOCALE_ALIASES[n];
      }

      // 2. Fallback al idioma base (ej: "fr-be" -> "fr" -> check alias "fr")
      const base = n.split('-')[0];
      if (LOCALE_ALIASES[base]) {
        return LOCALE_ALIASES[base];
      }

      return null;
    }

    export function getBestLocaleFromList(locales: readonly string[]): AppLocale {
      for (const l of locales) {
        const supported = toSupportedLocale(l);
        if (supported) return supported;
      }
      return DEFAULT_LOCALE;
    }

    export function isRtlLocale(locale: AppLocale): boolean {
      return locale === 'ar';
    }

    export function toHtmlLang(locale: AppLocale): string {
      return locale;
    }