import { LOCALE_MENU } from "@shared/i18n/model/locales";
import type React from "react";
import { useEffect } from "react";
import { Navigate, useLocation, useParams } from "react-router-dom";
import { i18n, setLocale } from "@/i18n";
import { type AppLocale, DEFAULT_LOCALE } from "@/i18n/config";

export const LocalizedRoute = ({ children }: { children: React.ReactNode }) => {
	const { lang } = useParams();
	const location = useLocation();

	useEffect(() => {
		if (
			lang &&
			i18n.language !== lang &&
			LOCALE_MENU.includes(lang as AppLocale)
		) {
			setLocale(lang as AppLocale);
		}
	}, [lang]);

	if (!lang || !LOCALE_MENU.includes(lang as AppLocale)) {
		return <Navigate to={`/${DEFAULT_LOCALE}${location.pathname}`} replace />;
	}

	return <>{children}</>;
};
