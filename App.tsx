import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useParams, useLocation } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import { i18n, setLocale } from './i18n';
import { AppLocale, DEFAULT_LOCALE } from './i18n/config';
import { LOCALE_MENU } from './components/locales';
import GamePage from './features/game/GamePage';

const I18nRouteWrapper = ({ children }: { children: React.ReactNode }) => {
  const { lang } = useParams();
  const location = useLocation();
  
  useEffect(() => {
    if (lang && i18n.language !== lang && LOCALE_MENU.includes(lang as AppLocale)) {
      setLocale(lang as AppLocale);
    }
  }, [lang]);
  
  if (!lang || !LOCALE_MENU.includes(lang as AppLocale)) {
    return <Navigate to={`/${DEFAULT_LOCALE}${location.pathname}`} replace />;
  }
  
  return <>{children}</>;
};

const App = () => {
  return (
    <HelmetProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Navigate to={`/${DEFAULT_LOCALE}/`} replace />} />
          <Route path="/:lang" element={<I18nRouteWrapper><GamePage /></I18nRouteWrapper>} />
          <Route path="/:lang/play" element={<I18nRouteWrapper><GamePage /></I18nRouteWrapper>} />
          <Route path="/:lang/share/:slug" element={<I18nRouteWrapper><GamePage /></I18nRouteWrapper>} />
          <Route path="*" element={<div>404 - Not Found</div>} />
        </Routes>
      </BrowserRouter>
    </HelmetProvider>
  );
};

export default App;