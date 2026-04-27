import i18n, { type Resource } from "i18next";
import { initReactI18next } from "react-i18next";

import {
	APP_LANGUAGE_STORAGE_KEY,
	type AppLocale,
	DEFAULT_LOCALE,
	FALLBACK_LOCALE,
	getBestLocaleFromList,
	isRtlLocale,
	SUPPORTED_LOCALES,
	toSupportedLocale,
} from "./config";

const commonLoaders = import.meta.glob("./locales/*/common.json") as Record<
	string,
	() => Promise<{ default: Record<string, unknown> }>
>;

function commonPath(locale: AppLocale): string {
	return `./locales/${locale}/common.json`;
}

const COMMON_LOADER_KEY_BY_LOWER = (() => {
	const m = new Map<string, string>();
	for (const k of Object.keys(commonLoaders)) m.set(k.toLowerCase(), k);
	return m;
})();

async function loadCommon(locale: AppLocale): Promise<Record<string, unknown>> {
	const exactKey = commonPath(locale);

	let loader = commonLoaders[exactKey];

	if (!loader) {
		const foundKey = COMMON_LOADER_KEY_BY_LOWER.get(exactKey.toLowerCase());
		if (foundKey) loader = commonLoaders[foundKey];
	}

	if (!loader) {
		if (locale !== FALLBACK_LOCALE) return loadCommon(FALLBACK_LOCALE);
		return {};
	}

	try {
		const mod = await loader();
		return (mod?.default ?? {}) as Record<string, unknown>;
	} catch {
		if (locale !== FALLBACK_LOCALE) return loadCommon(FALLBACK_LOCALE);
		return {};
	}
}

const commonPromiseByLocale = new Map<
	AppLocale,
	Promise<Record<string, unknown>>
>();

async function ensureCommonLoaded(locale: AppLocale): Promise<void> {
	if (i18n.hasResourceBundle(locale, "common")) return;

	let p = commonPromiseByLocale.get(locale);
	if (!p) {
		p = loadCommon(locale);
		commonPromiseByLocale.set(locale, p);
	}

	const data = await p;

	i18n.addResourceBundle(locale, "common", data, true, true);
}

function readPathLocale(): AppLocale | null {
	if (typeof window === "undefined") return null;
	try {
		const segment = window.location.pathname.split("/")[1];
		return toSupportedLocale(segment);
	} catch {
		return null;
	}
}

function readBootLocale(): AppLocale | null {
	if (typeof document === "undefined") return null;

	try {
		const scriptTag = document.getElementById("boot-data");
		if (!scriptTag?.textContent) return null;

		const parsed: unknown = JSON.parse(scriptTag.textContent);

		// Type-guard estricto
		if (parsed && typeof parsed === "object" && "lang" in parsed) {
			const langValue = (parsed as Record<string, unknown>).lang;
			return toSupportedLocale(
				typeof langValue === "string" ? langValue : String(langValue),
			);
		}

		return null;
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

		try {
			const fromStorage = toSupportedLocale(
				window.localStorage.getItem(APP_LANGUAGE_STORAGE_KEY),
			);
			if (fromStorage) return fromStorage;
		} catch {
			// Ignoramos la excepción silenciosamente, caerá en el locale por defecto
		}
	}

	if (typeof navigator !== "undefined") {
		return (
			getBestLocaleFromList(navigator.languages as string[]) || DEFAULT_LOCALE
		);
	}

	return DEFAULT_LOCALE;
}

let initPromise: Promise<typeof i18n> | null = null;

function initI18n(): Promise<typeof i18n> {
	if (initPromise) return initPromise;

	initPromise = (async () => {
		const initialLocale = resolveInitialLocale();

		const common = await loadCommon(initialLocale);
		const resources: Resource = { [initialLocale]: { common } };

		await i18n.use(initReactI18next).init({
			resources,
			lng: initialLocale,
			fallbackLng: FALLBACK_LOCALE,
			supportedLngs: [...SUPPORTED_LOCALES],
			load: "currentOnly",
			ns: ["common"],
			defaultNS: "common",

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

			if (!i18n.hasResourceBundle(next, "common")) {
				await ensureCommonLoaded(next);
			}

			document.documentElement.lang = next;
			document.documentElement.dir = isRtlLocale(next) ? "rtl" : "ltr";

			try {
				localStorage.setItem(APP_LANGUAGE_STORAGE_KEY, next);
			} catch {
				/* ignora silenciosamente si falla el acceso a localStorage */
			}
		});

		return i18n;
	})();

	return initPromise;
}

export { i18n };
export const i18nReady = initI18n();

export async function setLocale(locale: AppLocale): Promise<void> {
	await i18nReady;

	await ensureCommonLoaded(locale);

	await i18n.changeLanguage(locale);
}
