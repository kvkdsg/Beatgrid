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

    const LOCALE_ALIASES: Readonly<Record<string, AppLocale>> = Object.freeze({
      en: 'en', 'en-us': 'en', 'en-gb': 'en', 'en-au': 'en', 'en-ca': 'en',

      es: 'es', 'es-es': 'es', 'es-mx': 'es', 'es-ar': 'es', 'es-419': 'es', 'es-us': 'es',

      pt: 'pt-BR', 'pt-br': 'pt-BR', 'pt-pt': 'pt-BR',

      fr: 'fr', 'fr-fr': 'fr', 'fr-ca': 'fr', 'fr-ch': 'fr', 'fr-be': 'fr',

      de: 'de', 'de-de': 'de', 'de-at': 'de', 'de-ch': 'de',

      it: 'it', 'it-it': 'it', 'it-ch': 'it',

      ru: 'ru', 'ru-ru': 'ru',

      ar: 'ar', 'ar-sa': 'ar', 'ar-ae': 'ar', 'ar-eg': 'ar',

      ja: 'ja', 'ja-jp': 'ja',

      ko: 'ko', 'ko-kr': 'ko',

      zh: 'zh-Hans', 'zh-cn': 'zh-Hans', 'zh-sg': 'zh-Hans', 
      'zh-hans': 'zh-Hans', 'zh-hans-cn': 'zh-Hans',

      tr: 'tr', 'tr-tr': 'tr',

      id: 'id', 'id-id': 'id', 'in': 'id', 'in-id': 'id',

      th: 'th', 'th-th': 'th',

      vi: 'vi', 'vi-vn': 'vi'
    });

    export function isSupportedLocale(locale: string): locale is AppLocale {
      return (SUPPORTED_LOCALES as readonly string[]).includes(locale);
    }

    function normalizeRawLocale(input: string): string {
      return input.trim().replace(/_/g, '-').toLowerCase();
    }

    export function toSupportedLocale(raw: string | null | undefined): AppLocale | null {
      if (!raw) return null;

      const n = normalizeRawLocale(raw);

      if (LOCALE_ALIASES[n]) {
        return LOCALE_ALIASES[n];
      }

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