import GamePage from "@features/game/GamePage";
import { HelmetProvider } from "react-helmet-async";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { DEFAULT_LOCALE } from "@/i18n/config";
import { LocalizedRoute } from "./LocalizedRoute";

export const AppRouter = () => {
	return (
		<HelmetProvider>
			<BrowserRouter>
				<Routes>
					<Route
						path="/"
						element={<Navigate to={`/${DEFAULT_LOCALE}/`} replace />}
					/>
					<Route
						path="/:lang"
						element={
							<LocalizedRoute>
								<GamePage />
							</LocalizedRoute>
						}
					/>
					<Route
						path="/:lang/play"
						element={
							<LocalizedRoute>
								<GamePage />
							</LocalizedRoute>
						}
					/>
					<Route
						path="/:lang/share/:slug"
						element={
							<LocalizedRoute>
								<GamePage />
							</LocalizedRoute>
						}
					/>
					<Route path="*" element={<div>404 - Not Found</div>} />
				</Routes>
			</BrowserRouter>
		</HelmetProvider>
	);
};
