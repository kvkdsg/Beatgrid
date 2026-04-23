// index.tsx
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";

// IMPORTANTE: Importamos los estilos compilados aquí
import "./index.css";

// Asegura que i18next/react-i18next estén inicializados antes del primer render
// (reduce flicker y evita acceder a t antes de init en setups async).
import { i18nReady } from "./i18n";

const rootElement = document.getElementById("root");
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);

function registerServiceWorkerDeferred(): void {
  // Registro manual nativo (sin `virtual:pwa-register`).
  // Basado en el patrón de registro documentado por vite-plugin-pwa.
  if (typeof window === "undefined") return;
  if (!("serviceWorker" in navigator)) return;

  // En dev normalmente no se registra SW salvo configuración específica de devOptions.
  // Mantenerlo desactivado en dev evita comportamientos confusos durante desarrollo.
  if (import.meta.env.MODE !== "production") return;

  const base = import.meta.env.BASE_URL || "/";
  const swUrl = `${base}sw.js`;

  const doRegister = async () => {
    try {
      await navigator.serviceWorker.register(swUrl, { scope: base });
    } catch {
      // Silencioso por diseño: un fallo de SW no debe romper el runtime.
    }
  };

  // STATE OF THE ART: diferir el registro fuera del camino crítico.
  // Ajuste no funcional: ampliamos la ventana de diferido para no contaminar TBT en Lighthouse.
  const ric: undefined | ((cb: IdleRequestCallback, opts?: IdleRequestOptions) => number) =
    (window as any).requestIdleCallback?.bind(window);

  if (typeof ric === "function") {
    ric(
      () => {
        void doRegister();
      },
      { timeout: 8000 }
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
      <App />
    </React.StrictMode>
  );

  /*
    STATE OF THE ART (opcional, sin impacto funcional):
    Marca que React ya montó. Útil para debug/estados visuales y futuras optimizaciones.
    No modifica rutas, estado, ni lógica de render: solo añade una clase al <html>.

    IMPORTANTE (perf/LCP):
    Esta clase se usa para ocultar el SSR shell *solo después* del mount, evitando
    una ventana donde el usuario vea “pantalla SEO” durante el gap (HTML -> React).
  */
  requestAnimationFrame(() => {
    document.documentElement.classList.add("hydrated");

    // STATE OF THE ART (SEO-safe, NO FUNCTIONAL IMPACT):
    // - NO eliminamos el SSR shell del DOM para evitar "contenido SEO efímero".
    // - El CSS ya lo hace no-interactivo/invisible tras hydrated.
    // - Mantenerlo evita que Google vea una DOM final "vacía" de texto si tu UI real es muy gráfica.
    //
    // Nota: NO añadimos aria-hidden aquí para no degradar explícitamente el contenido a nivel semántico.
    // Si quisieras optimizar a11y en el futuro, hazlo solo si confirmas que React renderiza H1/Copy equivalentes.
    void 0;
  });

  // Registro SW tras el mount (no bloquea el primer render).
  registerServiceWorkerDeferred();
}

// Render cuando i18n esté listo; si fallara por cualquier razón, renderiza igual.
void i18nReady.then(renderApp).catch(renderApp);
