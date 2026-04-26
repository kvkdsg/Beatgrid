import React, { useState, useRef, useEffect } from 'react';
import { AppLocale } from '../i18n/config';
import { LOCALE_LABELS, LOCALE_MENU } from './locales';

interface LanguageMenuProps {
  currentLocale: AppLocale;
  onLanguageChange: (l: AppLocale) => void;
}

const LanguageMenu: React.FC<LanguageMenuProps> = ({ currentLocale, onLanguageChange }) => {
  const [langOpen, setLangOpen] = useState(false);
  const langRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const onDown = (e: MouseEvent) => { if (langRef.current && !langRef.current.contains(e.target as Node)) setLangOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setLangOpen(false); };
    document.addEventListener('mousedown', onDown); 
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  },[]);

  return (
    <div ref={langRef} className="absolute top-4 left-1/2 -translate-x-1/2 z-50 w-auto">
      <button 
        type="button" 
        aria-haspopup="menu"
        aria-expanded={langOpen}
        onClick={() => setLangOpen((v) => !v)} 
        className={`relative flex items-center gap-3 bg-white border-[3px] border-black px-4 py-1.5 pr-10 font-black text-black uppercase text-xs md:text-sm tracking-widest cursor-pointer rounded-lg select-none transition-all duration-200 ease-out hover:bg-[#ffd500] ${langOpen ? "translate-y-0.5 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] bg-[#ffe600]" : "shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:-translate-y-0.5 hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]"}`}>
        <span className="text-black">{LOCALE_LABELS[currentLocale]}</span>
        <span className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-black">
          <svg className={`w-4 h-4 transition-transform duration-300 ${langOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="4" d="M19 9l-7 7-7-7" /></svg>
        </span>
      </button>
      
      <div 
        role="menu"
        aria-hidden={!langOpen}
        className={`absolute top-full left-1/2 -translate-x-1/2 mt-3 p-3 bg-white border-3 border-black rounded-xl shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] origin-top transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] grid grid-flow-col gap-2 grid-rows-8 grid-cols-2 w-[90vw] max-w-[24rem] md:grid-rows-5 md:grid-cols-3 md:w-xl md:max-w-none 
          ${langOpen ? "opacity-100 scale-100 translate-y-0 pointer-events-auto" : "opacity-0 scale-95 -translate-y-2 pointer-events-none"}`}
      >
        {LOCALE_MENU.map((locale) => (
          <button 
            key={locale} 
            type="button" 
            role="menuitem"
            onClick={() => { onLanguageChange(locale); setLangOpen(false); }} 
            className={`w-full text-center md:text-left px-1 py-2 md:px-3 md:py-2.5 font-black text-black text-[10px] md:text-xs tracking-tighter uppercase border-2 md:border-3 border-black rounded-lg transition-all duration-75 truncate ${currentLocale === locale ? "bg-[#ffe600] shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] translate-y-0.5" : "bg-white hover:bg-[#f0f0f0] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:translate-y-0.5"}`}>
            <span className="block truncate">{LOCALE_LABELS[locale]}</span>
          </button>
        ))}
      </div>
    </div>
  );
};

export default LanguageMenu;