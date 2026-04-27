import React from 'react';
import { useTranslation } from 'react-i18next';
import { AppLocale } from '@/i18n/config';
import LanguageMenu from '@shared/i18n/ui/LanguageMenu';
import NavArrow from './NavArrow';
import WordEditor from './WordEditor';
import RecordingToggle from './RecordingToggle';

interface MainMenuProps {
  show: boolean;
  currentLocale: AppLocale;
  onLanguageChange: (l: AppLocale) => void;
  showGenError: boolean;
  genErrorClosing: boolean;
  onCloseGenError: () => void;
  isGenerating: boolean;
  onPrevPreset: () => void;
  onNextPreset: () => void;
  words: string[];
  setWords: (w: string[]) => void;
  onGenerate: () => void;
  isGeminiGenerating: boolean;
  enableRecording: boolean;
  setEnableRecording: (val: boolean) => void;
}

const MainMenu: React.FC<MainMenuProps> = ({
  show, currentLocale, onLanguageChange, showGenError, genErrorClosing, onCloseGenError,
  isGenerating, onPrevPreset, onNextPreset, words, setWords, onGenerate, isGeminiGenerating,
  enableRecording, setEnableRecording
}) => {
  const { t } = useTranslation();

  return (
    <div className={`absolute inset-0 z-30 w-full h-full overflow-y-scroll overflow-x-hidden no-scrollbar layer-transition ${show ? 'visible-layer' : 'hidden-layer'}`}>
      <div className="min-h-full w-full flex flex-col items-center justify-center py-8 px-4 relative">
        
        {show && <LanguageMenu currentLocale={currentLocale} onLanguageChange={onLanguageChange} />}

        {showGenError && (
          <div 
            role="alert"
            className={`absolute top-20 md:top-24 left-1/2 -translate-x-1/2 z-60 flex items-center gap-3 bg-[#ff0055] border-4 border-black px-4 py-3 md:px-6 md:py-4 rounded-2xl shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-all duration-300 origin-center w-[90%] max-w-md ${genErrorClosing ? 'opacity-0 scale-95 -translate-y-2' : 'opacity-100 scale-100 translate-y-0 animate-slam'}`}
          >
            <span className="text-white text-xl md:text-2xl shrink-0" aria-hidden="true">⚠️</span>
            <span className="text-white font-black text-xs md:text-sm uppercase tracking-widest flex-1 text-left" style={{ fontFamily: "'Montserrat', sans-serif" }}>
              {t('errors.genError', 'Error generating. Please try again.')}
            </span>
            <button 
              type="button" 
              onClick={onCloseGenError}
              aria-label="Close error message"
              className="shrink-0 bg-transparent border-none text-white hover:scale-110 active:scale-95 transition-transform focus:outline-none cursor-pointer flex items-center justify-center"
            >
              <svg className="w-5 h-5 md:w-6 md:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="4" d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>
        )}

        <div className="relative z-30 flex flex-col items-center gap-4 md:gap-8 text-center p-5 md:p-8 bg-white rounded-3xl border-4 md:border-6 border-black hard-shadow w-full max-w-2xl mt-12 md:mt-0">
          <div className="flex items-center justify-between w-full gap-2 md:gap-4 mb-2 md:mb-0">
            <NavArrow direction="left" onClick={onPrevPreset} disabled={isGenerating} ariaLabel={t('nav.prevPresetAria')} />
            <div className="flex flex-col gap-1 items-center transform -rotate-2 mx-auto">
              <h1 className="text-4xl md:text-6xl font-black text-black tracking-tighter uppercase leading-none">{t('hero.title')}</h1>
              <h2 className="text-xl md:text-3xl font-black text-white bg-[#ff0055] px-4 py-1 tracking-widest uppercase border-4 border-black inline-block transform rotate-1">{t('hero.subtitle')}</h2>
            </div>
            <NavArrow direction="right" onClick={onNextPreset} disabled={isGenerating} ariaLabel={t('nav.nextPresetAria')} />
          </div>
          
          <div className="w-full">
              <WordEditor words={words} setWords={setWords} onGenerate={onGenerate} disabled={isGenerating} isGeminiGenerating={isGeminiGenerating} />
          </div>
          
          <RecordingToggle 
            enableRecording={enableRecording} 
            setEnableRecording={setEnableRecording} 
            disabled={isGenerating} 
          />
        </div>
      </div>
    </div>
  );
};

export default MainMenu;