import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

interface WordEditorProps {
  words: string[];
  setWords: (words: string[]) => void;
  onGenerate: () => void;
  disabled?: boolean;
  isGeminiGenerating?: boolean;
}

const ACCENT_COLORS = [
  'focus-within:border-[#ff0055]',
  'focus-within:border-[#00ff99]',
  'focus-within:border-[#00ccff]',
  'focus-within:border-[#ffcc00]',
];

const ETA_MS = 7000;

// IDs estables para evitar el anti-patrón de usar el índice como key
const WORD_SLOTS =[
  { id: 'slot-0' },
  { id: 'slot-1' },
  { id: 'slot-2' },
  { id: 'slot-3' },
];

const WordEditor: React.FC<WordEditorProps> = ({
  words,
  setWords,
  onGenerate,
  disabled,
  isGeminiGenerating,
}) => {
  const { t } = useTranslation();

  const isLoading = !!disabled;
  const isFormInvalid = useMemo(() => {
    return words.some((w) => !w.trim());
  }, [words]);

  const showEta = isLoading && !!isGeminiGenerating;
  const[etaSec, setEtaSec] = useState<number | null>(null);

  const handleChange = (index: number, value: string) => {
    const newWords = [...words];
    newWords[index] = value;
    setWords(newWords);
  };

  // Efecto saneado: un único setter y sin resetear estados derivables artificialmente
  useEffect(() => {
    if (!showEta) return;

    const start = performance.now();
    let lastSec = -1;

    const tick = () => {
      const elapsed = performance.now() - start;
      const remaining = Math.max(0, ETA_MS - elapsed);
      const sec = Math.max(0, Math.ceil(remaining / 1000));

      if (sec !== lastSec) {
        lastSec = sec;
        setEtaSec(sec);
      }

      if (remaining <= 0) {
        window.clearInterval(id);
      }
    };

    tick();
    const id = window.setInterval(tick, 120);

    return () => window.clearInterval(id);
  }, [showEta]);

  return (
    <div className="flex flex-col gap-4 md:gap-6 max-w-3xl w-full">
      <div className="grid grid-cols-2 gap-3 md:gap-6">
        {WORD_SLOTS.map((slot, i) => {
          const word = words[i] ?? '';
          return (
            <div
              key={slot.id}
              className={`group relative bg-white border-4 border-black p-2 md:p-3 transition-all duration-200
                shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]
                hover:-translate-y-1 hover:shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]
                flex flex-col justify-between
                ${ACCENT_COLORS[i]}`}
            >
              <div className="flex justify-start mb-0">
                <span className="text-[10px] md:text-xs font-black text-white bg-zinc-950 px-1.5 py-0.5 tracking-widest border-2 border-transparent">
                  {i + 1}/4
                </span>
              </div>

              <input
                type="text"
                value={word}
                onChange={(e) => handleChange(i, e.target.value)}
                disabled={disabled}
                autoComplete="off"
                spellCheck={false}
                className="w-full bg-transparent border-b-4 border-gray-200 rounded-none px-0 py-0 md:py-1 text-xl md:text-2xl font-black text-black uppercase tracking-tight
                           focus:outline-none focus:border-black disabled:opacity-50 transition-colors placeholder:text-gray-300 text-center"
                placeholder={t('wordEditor.placeholder', { index: i + 1 })}
                style={{ fontFamily: "'Montserrat', sans-serif" }}
              />
            </div>
          );
        })}
      </div>

      <button
        type="button"
        onClick={() => {
          if (isLoading || isFormInvalid) return;
          onGenerate();
        }}
        disabled={isFormInvalid}
        aria-disabled={isLoading || isFormInvalid}
        aria-busy={isLoading ? true : undefined}
        className={`relative overflow-hidden w-full rounded-xl py-3 md:py-5 px-4 md:px-8 text-lg md:text-2xl font-black tracking-tight uppercase transition-all border-4 border-black
          ${isFormInvalid ? 'opacity-50 cursor-not-allowed' : isLoading ? 'cursor-not-allowed' : ''}`}
        style={{
          background: isFormInvalid ? '#e5e7eb' : '#ffe600',
          color: isFormInvalid ? '#9ca3af' : '#000000',
          boxShadow: isFormInvalid ? 'none' : '4px 4px 0px 0px rgba(0,0,0,1)',
          transform: isFormInvalid ? 'none' : 'translate(0, 0)',
          fontFamily: "'Montserrat', sans-serif",
        }}
      >
        {showEta && (
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 gen-sweep-overlay"
          />
        )}

        <span className="relative z-10 flex items-center justify-center gap-3">
          <span>{isLoading ? t('wordEditor.generating') : t('wordEditor.start')}</span>

          {showEta && (
            <span className="tabular-nums text-sm md:text-lg font-black opacity-80">
              {etaSec ?? 6}
            </span>
          )}
        </span>
      </button>
    </div>
  );
};

export default WordEditor;