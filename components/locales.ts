import { AppLocale } from '../i18n/config';

export const LOCALE_LABELS: Record<AppLocale, string> = {
  en: "English", es: "Español", "pt-BR": "Português (Brasil)", fr: "Français", de: "Deutsch",
  it: "Italiano", tr: "Türkçe", id: "Bahasa Indonesia", th: "ไทย", vi: "Tiếng Việt",
  ru: "Русский", ar: "العربية", ja: "日本語", ko: "한국어", "zh-Hans": "中文（简体）",
};

export const LOCALE_MENU: AppLocale[] =[
  'en', 'es', 'pt-BR', 'fr', 'de',
  'it', 'tr', 'id', 'vi', 'th',
  'ru', 'ar', 'ja', 'ko', 'zh-Hans'
];