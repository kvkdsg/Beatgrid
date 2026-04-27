import { AppRouter } from "@app/router/AppRouter";
import React from "react";
import ReactDOM from "react-dom/client";
import "@/index.css";
import { i18nReady } from "@/i18n";

const rootElement = document.getElementById("root");
if (!rootElement) {
	throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);

function registerServiceWorkerDeferred(): void {
	if (typeof window === "undefined") return;
	if (!("serviceWorker" in navigator)) return;
	if (import.meta.env.MODE !== "production") return;

	const base = import.meta.env.BASE_URL || "/";
	const swUrl = `${base}sw.js`;

	const doRegister = async () => {
		try {
			await navigator.serviceWorker.register(swUrl, { scope: base });
		} catch {
			// Fail silent
		}
	};

	const ric = (
		window as unknown as {
			requestIdleCallback?: (
				cb: IdleRequestCallback,
				opts?: IdleRequestOptions,
			) => number;
		}
	).requestIdleCallback?.bind(window);

	if (typeof ric === "function") {
		ric(
			() => {
				void doRegister();
			},
			{ timeout: 8000 },
		);
	} else {
		setTimeout(() => {
			void doRegister();
		}, 5000);
	}
}

function renderApp() {
	root.render(
		<React.StrictMode>
			<AppRouter />
		</React.StrictMode>,
	);

	requestAnimationFrame(() => {
		document.documentElement.classList.add("hydrated");
	});

	registerServiceWorkerDeferred();
}

void i18nReady.then(renderApp).catch(renderApp);
