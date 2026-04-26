import React, { useState, useRef, useEffect, useCallback, useMemo, useReducer } from 'react';
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  useParams,
  useLocation,
  useNavigate
} from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import { useTranslation } from 'react-i18next';

import type { AppState as AppStateType, GameSettings, GameTimeline, RecordingStatus, RecordingResult } from './types';
import { AppState } from './types'; 

import type { CanvasRenderer } from './lib/game/renderer';
import type { SpriteSource } from './lib/game/renderer';

import {
  DEFAULT_BPM,
  BEATS_PER_ROUND,
  SONG_OFFSET_SEC,
  CELL_LABEL_DURATION_MS,
  CELL_LABEL_FADE_IN_MS,
  GLOBAL_AUDIO_LATENCY_MS,
  SYNC_THRESHOLD_IGNORE_MS,
  SYNC_THRESHOLD_SOFT_MS,
  SYNC_NUDGE_FACTOR,
  SYNC_SAMPLE_SIZE,
  SYNC_AUDIO_EPSILON_MS,
  RECORDING_VIDEO_LAG_MS,
  RECORDING_TRIM_START_MS,
  RECORDING_TRIM_END_MS,
  BUY_ME_COFFEE_URL
} from './constants';

import { createTimeline, getGameStateAtTime, GameState } from './lib/game/engine';
import WordEditor from './components/WordEditor';
import HUD from './components/HUD';
import { findPreset, pickRandomPreset, PRESETS, wordsKey } from './presets';
import { setLocale, i18n } from './i18n';
import { AppLocale, toSupportedLocale, DEFAULT_LOCALE } from './i18n/config';

const TAU = Math.PI * 2;
const clamp01 = (v: number) => Math.max(0, Math.min(1, Number.isNaN(v) ? 0 : v));
const easeOutCubic = (x: number) => 1 - Math.pow(1 - clamp01(x), 3);
const beatPulse = (phase01: number) => {
  const tVal = Math.min(1, clamp01(phase01) * 3.5);
  return 1 - easeOutCubic(tVal);
};

const textMetricsCache = new Map<string, number>();

const VIDEO_WIDTH = 1280;
const VIDEO_HEIGHT = 720;
const BASE_W = 1600;
const BASE_H = 800;
const VERTICAL_W = 900;
const VERTICAL_H = 1600;

const CELL_IDS =['cell-0', 'cell-1', 'cell-2', 'cell-3', 'cell-4', 'cell-5', 'cell-6', 'cell-7'];

const LOCALE_LABELS: Record<AppLocale, string> = {
  en: "English", es: "Español", "pt-BR": "Português (Brasil)", fr: "Français", de: "Deutsch",
  it: "Italiano", tr: "Türkçe", id: "Bahasa Indonesia", th: "ไทย", vi: "Tiếng Việt",
  ru: "Русский", ar: "العربية", ja: "日本語", ko: "한국어", "zh-Hans": "中文（简体）",
};

const LOCALE_MENU: AppLocale[] =[
  'en', 'es', 'pt-BR', 'fr', 'de',
  'it', 'tr', 'id', 'vi', 'th',
  'ru', 'ar', 'ja', 'ko', 'zh-Hans'
];

const NavArrow: React.FC<{ direction: 'left' | 'right'; onClick: () => void; disabled?: boolean; ariaLabel: string }> = ({ direction, onClick, disabled, ariaLabel }) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    className={`group relative flex items-center justify-center w-10 h-10 md:w-14 md:h-14 bg-white border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] shrink-0 rounded-lg transition-all duration-150 ${disabled ? 'opacity-50 cursor-not-allowed shadow-none transform-none' : 'hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] hover:-translate-y-0.5 active:translate-y-0 active:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]'}`}
    aria-label={ariaLabel}
  >
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" 
        className={`w-5 h-5 md:w-7 md:h-7 text-black transition-transform group-hover:scale-110 ${direction === 'right' ? 'rotate-180' : ''}`}>
      <path d="M19 12H5M12 19l-7-7 7-7" />
    </svg>
  </button>
);

const LanguageMenu: React.FC<{ currentLocale: AppLocale, onLanguageChange: (l: AppLocale) => void }> = ({ currentLocale, onLanguageChange }) => {
  const[langOpen, setLangOpen] = useState(false);
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

const RecordingToggle: React.FC<{ enableRecording: boolean; setEnableRecording: (v: boolean) => void; disabled: boolean }> = ({ enableRecording, setEnableRecording, disabled }) => {
  const { t } = useTranslation();
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => setEnableRecording(!enableRecording)}
      aria-pressed={enableRecording}
      className={`w-full flex items-center justify-between border-4 border-black p-3 md:p-4 rounded-xl transition-colors ${enableRecording ? 'bg-green-50' : 'bg-gray-100'} ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:bg-gray-200'}`}
    >
      <div className="flex flex-col items-start text-left">
        <span className="font-black uppercase text-sm md:text-lg text-black">{t('recording.title')}</span>
        <span className="text-[10px] md:text-xs font-bold text-gray-500 uppercase tracking-wide leading-tight">{enableRecording ? t('recording.onHint') : t('recording.offHint')}</span>
      </div>
      <div className={`relative w-12 md:w-16 h-7 md:h-8 rounded-full border-4 border-black transition-colors duration-300 ${enableRecording ? 'bg-[#00ff99]' : 'bg-gray-300'}`}>
        <div className={`absolute top-1/2 -translate-y-1/2 w-5 md:w-6 h-5 md:h-6 bg-white border-2 border-black rounded-full shadow-sm transition-all duration-300 ease-spring ${enableRecording ? 'left-[calc(100%-1.5rem)] md:left-[calc(100%-1.75rem)]' : 'left-0.5 md:left-1'}`} />
      </div>
    </button>
  );
};

type UiState = {
  appState: AppStateType;
  isGeminiGenerating: boolean;
  isInIntro: boolean;
  introText: string;
  uiRoundInfo: { round: number; beat: number; totalBeats: number };
  uiOverlayState: { show: boolean; alpha: number; pattern: readonly number[] };
  isMobileVertical: boolean;
  showGenError: boolean;
  genErrorClosing: boolean;
};

const initialUiState: UiState = {
  appState: AppState.IDLE,
  isGeminiGenerating: false,
  isInIntro: false,
  introText: "",
  uiRoundInfo: { round: 1, beat: 0, totalBeats: 40 },
  uiOverlayState: { show: false, alpha: 0, pattern:[] },
  isMobileVertical: false,
  showGenError: false,
  genErrorClosing: false,
};

type RecState = {
  enableRecording: boolean;
  status: RecordingStatus & { error?: string };
  canShareNative: boolean;
};

const initialRecState: RecState = {
  enableRecording: true,
  status: { isRecording: false },
  canShareNative: false,
};

interface IRecordingService {
  startRecording(args: { canvas: HTMLCanvasElement; audioTrack?: MediaStreamTrack; videoBitsPerSecond: number }): Promise<void>;
  stopRecording(): Promise<RecordingResult>;
  cancelRecording(): void;
}

const GameContent: React.FC = () => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const { slug } = useParams();

  const [uiState, setUiState] = useReducer(
    (state: UiState, action: Partial<UiState> | ((prev: UiState) => Partial<UiState> | null)) => {
      const next = typeof action === 'function' ? action(state) : action;
      if (!next) return state;
      let hasChanges = false;
      for (const key in next) {
        if (state[key as keyof UiState] !== next[key as keyof UiState]) {
          hasChanges = true;
          break;
        }
      }
      return hasChanges ? { ...state, ...next } : state;
    },
    initialUiState
  );

  const[recState, setRecState] = useReducer(
    (state: RecState, action: Partial<RecState>) => ({ ...state, ...action }),
    initialRecState
  );

  const layoutAnim = useRef(0);
  const lastLayoutProgressRef = useRef<number>(-1);

  const audioContextRef = useRef<AudioContext | null>(null);
  const audioSourceNodeRef = useRef<MediaElementAudioSourceNode | null>(null);
  const audioDestNodeRef = useRef<MediaStreamAudioDestinationNode | null>(null);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(orientation: landscape)');
    const handleOrientationChange = (e: MediaQueryListEvent | MediaQueryList) => {
      if (e.matches) setUiState({ isMobileVertical: false });
    };
    handleOrientationChange(mediaQuery);
    mediaQuery.addEventListener('change', handleOrientationChange);
    return () => mediaQuery.removeEventListener('change', handleOrientationChange);
  },[]);

  const currentLocale = useMemo(() => 
    toSupportedLocale(i18n.resolvedLanguage ?? i18n.language) ?? DEFAULT_LOCALE,[i18n.resolvedLanguage, i18n.language]
  );

  const canvasLabelsRef = useRef({ roundLabel: 'ROUND' });
  useEffect(() => { canvasLabelsRef.current.roundLabel = t('canvas.roundLabel'); }, [t]);

  const parseSlug = (s: string) => s.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1));

  const[words, setWords] = useState<string[]>(() => {
    if (slug) {
      try {
        const decoded = parseSlug(slug);
        if (decoded.length === 4) return decoded;
      } catch { console.warn("Invalid slug, falling back to preset"); }
    }
    return [...pickRandomPreset().words];
  });

  useEffect(() => {
    if (slug && uiState.appState === AppState.IDLE) {
      const decoded = parseSlug(slug);
      if (decoded.length === 4) setWords(decoded);
    }
  },[slug, uiState.appState]);

  const genErrorAutoCloseTimerRef = useRef<number | null>(null);
  const genErrorFadeTimerRef = useRef<number | null>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const viewCanvasRef = useRef<HTMLCanvasElement>(null);
  const canvasContainerRef = useRef<HTMLDivElement>(null);

  const spritesheetRef = useRef<SpriteSource | null>(null);
  const rendererRef = useRef<CanvasRenderer | null>(null);
  const CanvasRendererClassRef = useRef<typeof CanvasRenderer | null>(null);

  const timelineRef = useRef<GameTimeline | null>(null);
  const requestRef = useRef<number | undefined>(undefined);
  
  const recordingServiceRef = useRef<IRecordingService | null>(null);
  
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const isMountedRef = useRef(true);
  const generationTokenRef = useRef(0);
  const sessionSeedRef = useRef<string | null>(null);

  const startTimeRef = useRef<number | null>(null);
  const syncRef = useRef({
    startTime: 0, visualOffset: 0, isLocked: false,
    driftSamples: [] as number[], lastAudioTime: 0, lastFrameTime: 0
  });

  const engineStateRef = useRef<GameState | undefined>(undefined);

  const cornerTLRef = useRef<HTMLDivElement>(null);
  const cornerTRRef = useRef<HTMLDivElement>(null);
  const cornerBLRef = useRef<HTMLDivElement>(null);
  const cornerBRRef = useRef<HTMLDivElement>(null);

  const compositeCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const compositeCtxRef = useRef<CanvasRenderingContext2D | null>(null);
  const cachedBgCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const isRecordingActiveRef = useRef<boolean>(false);
  const recordingStartedRef = useRef<boolean>(false);
  const recordingStoppedRef = useRef<boolean>(false);

  const pendingRecordingArgsRef = useRef<{
    canvas: HTMLCanvasElement;
    audioTrack?: MediaStreamTrack;
    videoBitsPerSecond: number;
  } | null>(null);

  const normalizedWords = useMemo(() => (words ??[]).map((w) => String(w ?? '').trim()), [words]);
  const getReadyText = t('intro.getReady');

  const handleLanguageChange = async (newLocale: AppLocale) => {
    await setLocale(newLocale);
    const currentPath = location.pathname;
    const segments = currentPath.split('/').filter(Boolean);
    if (segments.length > 0 && LOCALE_MENU.includes(segments[0] as AppLocale)) {
      segments[0] = newLocale;
    } else {
      segments.unshift(newLocale);
    }
    navigate(`/${segments.join('/')}`);
  };

  const clearGenErrorTimers = useCallback(() => {
    if (genErrorAutoCloseTimerRef.current) clearTimeout(genErrorAutoCloseTimerRef.current);
    if (genErrorFadeTimerRef.current) clearTimeout(genErrorFadeTimerRef.current);
  },[]);

  const closeGenError = useCallback(() => {
    setUiState({ genErrorClosing: true });
    genErrorFadeTimerRef.current = window.setTimeout(() => {
      setUiState({ showGenError: false, genErrorClosing: false });
    }, 300);
  },[]);

  const openGenError = useCallback(() => {
    clearGenErrorTimers(); 
    setUiState({ showGenError: true, genErrorClosing: false });
    genErrorAutoCloseTimerRef.current = window.setTimeout(() => closeGenError(), 5000);
  },[clearGenErrorTimers, closeGenError]);

  const computeCornerDance = useCallback((timeMs: number) => {
    const bpm = DEFAULT_BPM;
    const beats = (timeMs / 1000) * (bpm / 60);
    const phase = beats - Math.floor(beats);
    const pulse = beatPulse(phase);
    const swing = Math.sin(beats * TAU);
    const scale = 1 + pulse * 0.12;
    const y = (-6 * pulse) + (2.5 * swing);
    const rot = (8 * swing) + (6 * pulse);
    return { scale, y, rot };
  },[]);

  const resetCornerTransform = useCallback(() => {
    const set = (el: HTMLDivElement | null, deg: number) => {
      if (!el) return;
      el.style.transform = `translate3d(0, 0, 0) rotate(${deg}deg) scale(1)`;
    };
    set(cornerTLRef.current, -15); set(cornerTRRef.current, 15);
    set(cornerBLRef.current, -10); set(cornerBRRef.current, 10);
  },[]);

  const applyCornerDance = useCallback((timeMs: number) => {
    const { scale, y, rot } = computeCornerDance(timeMs);
    const set = (el: HTMLDivElement | null, baseRot: number, mirror: number) => {
      if (!el) return;
      el.style.transform = `translate3d(0, ${y}px, 0) rotate(${baseRot + (rot * mirror)}deg) scale(${scale})`;
    };
    set(cornerTLRef.current, -15, 1); set(cornerTRRef.current, 15, -1);
    set(cornerBLRef.current, -10, 1); set(cornerBRRef.current, 10, -1);
  }, [computeCornerDance]);

  const prepareSpriteSource = useCallback((img: HTMLImageElement): HTMLCanvasElement => {
    const w = img.naturalWidth || img.width;
    const h = img.naturalHeight || img.height;
    const offscreen = document.createElement('canvas');
    offscreen.width = w; offscreen.height = h;
    const ctx = offscreen.getContext('2d', { alpha: true });
    if (ctx) ctx.drawImage(img, 0, 0);
    return offscreen;
  },[]);

  const ensureBackgroundCache = useCallback(async () => {
    if (cachedBgCanvasRef.current) return; 

    if (!compositeCanvasRef.current) {
        const c = document.createElement('canvas'); 
        c.width = VIDEO_WIDTH; c.height = VIDEO_HEIGHT; 
        compositeCanvasRef.current = c;
        compositeCtxRef.current = c.getContext('2d', { alpha: false });
    }

    const imgA = new Image(); 
    imgA.crossOrigin = 'anonymous'; 
    imgA.src = "/images/paper.webp";
    
    try {
        await imgA.decode();
        const offscreen = document.createElement('canvas');
        offscreen.width = VIDEO_WIDTH; offscreen.height = VIDEO_HEIGHT;
        const ctx = offscreen.getContext('2d', { alpha: false });
        if (ctx) {
            if (imgA.naturalWidth > 0) {
                const scale = Math.max(VIDEO_WIDTH / imgA.naturalWidth, VIDEO_HEIGHT / imgA.naturalHeight);
                ctx.drawImage(imgA, (VIDEO_WIDTH - imgA.naturalWidth * scale) / 2, (VIDEO_HEIGHT - imgA.naturalHeight * scale) / 2, imgA.naturalWidth * scale, imgA.naturalHeight * scale);
                ctx.globalCompositeOperation = 'multiply'; 
                ctx.fillStyle = '#f0f0f0'; 
                ctx.fillRect(0, 0, VIDEO_WIDTH, VIDEO_HEIGHT);
            } else { 
                ctx.fillStyle = '#e5e5e5'; 
                ctx.fillRect(0, 0, VIDEO_WIDTH, VIDEO_HEIGHT); 
            }
            cachedBgCanvasRef.current = offscreen;
        }
    } catch (e) {
        console.warn("Could not load paper texture for background cache", e);
    }
  },[]);

  const setupAudioGraph = useCallback(() => {
    if (!audioRef.current) return null;
    
    let ctx = audioContextRef.current;

    if (!ctx || ctx.state === 'closed') {
        try {
            const Ctx = window.AudioContext || (window as Window & typeof globalThis & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
            ctx = new Ctx();
            audioContextRef.current = ctx;
        } catch (e) {
            console.error("AudioContext creation failed:", e);
            return null;
        }
    }

    if (ctx.state === 'suspended') {
        ctx.resume().catch(() => {});
    }

    if (!audioSourceNodeRef.current) {
        try {
            audioSourceNodeRef.current = ctx.createMediaElementSource(audioRef.current);
            audioSourceNodeRef.current.connect(ctx.destination);
        } catch (e) {
            console.error("Source creation failed:", e);
            return null;
        }
    }

    if (audioDestNodeRef.current && audioSourceNodeRef.current) {
        try {
            audioSourceNodeRef.current.disconnect(audioDestNodeRef.current);
        } catch {
            // ignore
        }
    }

    try {
        const newDest = ctx.createMediaStreamDestination();
        audioDestNodeRef.current = newDest;
        audioSourceNodeRef.current.connect(newDest);
        return newDest;
    } catch (e) {
        console.error("Destination creation failed:", e);
        return null;
    }
  },[]);

  useEffect(() => {
    isMountedRef.current = true;
    resetCornerTransform();
    (document as Document & { fonts?: { ready?: Promise<void> } }).fonts?.ready?.catch?.(() => { /* ignore */ });
    return () => { isMountedRef.current = false; clearGenErrorTimers(); };
  }, [resetCornerTransform, clearGenErrorTimers]);

  const cancelRafIfAny = useCallback(() => {
    if (requestRef.current !== undefined) { cancelAnimationFrame(requestRef.current); requestRef.current = undefined; }
  },[]);

  const waitNextAnimationFrame = useCallback((): Promise<void> => {
    return new Promise((resolve) => requestAnimationFrame(() => resolve()));
  },[]);

  const performAudioLock = useCallback(() => {
    const a = audioRef.current;
    if (!a) return;
    const audioMs = a.currentTime * 1000;
    const perfMs = performance.now();
    syncRef.current.startTime = perfMs - audioMs;
    syncRef.current.visualOffset = 0;
    syncRef.current.isLocked = true;
    syncRef.current.driftSamples =[];
    syncRef.current.lastAudioTime = audioMs;
  },[]);

  const renderCompositeFrame = useCallback((timeMs: number, opts?: { forceIntro?: boolean; introTextOverride?: string; gameStateOverride?: Partial<GameState> | null }) => {
    const ctx = compositeCtxRef.current;
    const composite = compositeCanvasRef.current;
    const gameCanvas = canvasRef.current;
    if (!ctx || !composite || !gameCanvas) return;

    const W = composite.width; const H = composite.height;
    
    if (cachedBgCanvasRef.current) ctx.drawImage(cachedBgCanvasRef.current, 0, 0);
    else { ctx.fillStyle = '#e5e5e5'; ctx.fillRect(0, 0, W, H); }

    const safePad = Math.round(H * 0.05); 
    const maxGameW = W - (safePad * 2); 
    const maxGameH = H - (safePad * 2);
    let gameW = gameCanvas.width; 
    let gameH = gameCanvas.height; 
    
    const scaleFactor = Math.min(maxGameW / gameW, maxGameH / gameH) * 0.9;
    gameW *= scaleFactor; gameH *= scaleFactor;
    
    const gameX = (W - gameW) / 2; 
    const gameY = (H - gameH) / 2;
    ctx.drawImage(gameCanvas, gameX, gameY, gameW, gameH);

    const currentState = opts?.gameStateOverride;
    if (currentState && currentState.showCellLabels && currentState.cellLabelsAlpha && currentState.cellLabelsAlpha > 0) {
      const pattern = currentState.currentPattern;
      if (Array.isArray(pattern) && pattern.length > 0) {
        ctx.save(); ctx.translate(gameX, gameY);
        const oCols = 4;
        const oRows = 2;
        
        const cellW = gameW / oCols; const cellH = gameH / oRows;
        ctx.globalAlpha = currentState.cellLabelsAlpha;
        
        const fontSize = Math.round(cellH * 0.14);
        ctx.font = `900 ${fontSize}px 'Montserrat', sans-serif`; 
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        
        pattern.forEach((q, i) => {
          const safeQ = Number.isFinite(q) ? Math.max(0, Math.min(3, q)) : 0;
          const label = normalizedWords[safeQ]?.toUpperCase() ?? '';
          if (!label) return;
          
          const col = i % oCols; const row = Math.floor(i / oCols);
          const x = col * cellW + cellW / 2; const y = row * cellH + (cellH - (cellH * 0.12)); 
          
          const cacheKey = `${label}-${fontSize}`;
          let textWidth = textMetricsCache.get(cacheKey);
          if (textWidth === undefined) {
             textWidth = ctx.measureText(label).width;
             textMetricsCache.set(cacheKey, textWidth);
          }

          const bgPadX = 16; const bgPadY = 8;
          const bgW = textWidth + bgPadX * 2; const bgH = (cellH * 0.14) + bgPadY * 2; 
          ctx.fillStyle = 'rgba(255, 255, 255, 0.9)'; ctx.lineWidth = 3; ctx.strokeStyle = 'black';
          ctx.beginPath();
          if (ctx.roundRect) ctx.roundRect(x - bgW/2, y - bgH/2, bgW, bgH, 8); else ctx.rect(x - bgW/2, y - bgH/2, bgW, bgH);
          ctx.fill(); ctx.stroke();
          ctx.fillStyle = 'black'; ctx.fillText(label, x, y);
        });
        ctx.restore();
      }
    }

    const { scale, y, rot } = computeCornerDance(timeMs);
    const fontPx = Math.round(H * 0.12); const margin = Math.round(H * 0.04);
    const drawEmoji = (char: string, x: number, yBase: number, baseRot: number, mirror: number) => {
      ctx.save(); ctx.translate(x, yBase + y); ctx.rotate((baseRot + (rot * mirror)) * Math.PI / 180);
      ctx.scale(scale, scale); ctx.font = `${fontPx}px serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(char, 0, 0); ctx.restore();
    };
    drawEmoji('🎉', margin + 50, margin + 50, -15, 1); drawEmoji('🎁', W - margin - 50, margin + 50, 15, -1);
    drawEmoji('😎', margin + 50, H - margin - 50, -10, 1); drawEmoji('🐸', W - margin - 50, H - margin - 50, 10, -1);

    ctx.save();
    const markFontSize = Math.round(H * 0.035); ctx.font = `900 ${markFontSize}px 'Montserrat', sans-serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
    ctx.shadowColor = 'rgba(0,0,0,1)'; ctx.shadowBlur = 0; ctx.shadowOffsetX = 3; ctx.shadowOffsetY = 3;
    const marginMarkY = Math.round(H * 0.04);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
    ctx.fillText("BEAT.BOTON.ONE", W / 2, H - marginMarkY);
    ctx.restore();

    const activeIntro = opts?.forceIntro ?? uiState.isInIntro;
    const activeState = opts?.gameStateOverride || (uiState.appState === AppState.PLAYING ? engineStateRef.current : null);

    if (!activeIntro && activeState && activeState.roundNumber) {
        ctx.save();
        const hudScale = H / 1080; const safeRound = Math.min(5, Math.max(1, Math.floor(activeState.roundNumber)));
        const totalRounds = 5; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
        const labelText = canvasLabelsRef.current.roundLabel;
        const valText = safeRound.toString(); const totalText = "/" + totalRounds;
        const labelFont = `900 ${Math.round(18 * hudScale)}px 'Montserrat', sans-serif`;
        const valFont = `900 ${Math.round(42 * hudScale)}px 'Montserrat', sans-serif`;
        const totalFont = `900 ${Math.round(28 * hudScale)}px 'Montserrat', sans-serif`;
        ctx.font = labelFont; const labelM = ctx.measureText(labelText);
        ctx.font = valFont; const valM = ctx.measureText(valText);
        ctx.font = totalFont; const totalM = ctx.measureText(totalText);
        const gap1 = 12 * hudScale; const gap2 = 4 * hudScale;
        const padX = 24 * hudScale; const padY = 12 * hudScale;
        const badgeW = padX + labelM.width + gap1 + valM.width + gap2 + totalM.width + padX;
        const badgeH = Math.max(labelM.actualBoundingBoxAscent + labelM.actualBoundingBoxDescent, valM.actualBoundingBoxAscent + valM.actualBoundingBoxDescent) + (padY * 2);
        const badgeX = (W - badgeW) / 2; const badgeY = Math.max(20, H * 0.05);
        ctx.fillStyle = 'rgba(0,0,0,1)'; ctx.beginPath();
        if(ctx.roundRect) ctx.roundRect(badgeX + 4, badgeY + 4, badgeW, badgeH, 16 * hudScale); else ctx.rect(badgeX + 4, badgeY + 4, badgeW, badgeH);
        ctx.fill();
        ctx.fillStyle = '#ffffff'; ctx.strokeStyle = '#000000'; ctx.lineWidth = 3; ctx.beginPath();
        if(ctx.roundRect) ctx.roundRect(badgeX, badgeY, badgeW, badgeH, 16 * hudScale); else ctx.rect(badgeX, badgeY, badgeW, badgeH);
        ctx.fill(); ctx.stroke();
        let cursorX = badgeX + padX; const centerY = badgeY + (badgeH / 2);
        ctx.font = labelFont; ctx.fillStyle = '#6b7280'; ctx.fillText(labelText, cursorX, centerY);
        cursorX += labelM.width + gap1;
        ctx.font = valFont; const gradient = ctx.createLinearGradient(cursorX, centerY - 20, cursorX + valM.width, centerY + 20);
        gradient.addColorStop(0, '#7c3aed'); gradient.addColorStop(1, '#3b82f6');
        ctx.fillStyle = gradient; ctx.fillText(valText, cursorX, centerY + 2);
        cursorX += valM.width + gap2;
        ctx.font = totalFont; ctx.fillStyle = '#9ca3af'; ctx.fillText(totalText, cursorX, centerY + 2);
        ctx.restore();
    }

    if (uiState.appState === AppState.PLAYING && activeIntro) {
      const textToShow = (opts?.introTextOverride ?? uiState.introText) || "";
      ctx.save();
      const frameT = timeMs / 1000; const bounce = 1 + Math.sin(frameT * 10) * 0.05;
      ctx.translate(W / 2, H / 2); ctx.scale(bounce, bounce);
      const bigFont = Math.round(H * 0.3);
      ctx.font = `900 ${bigFont}px 'Montserrat', sans-serif`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillStyle = 'rgba(0,0,0,0.2)'; ctx.fillText(textToShow, 20, 20);
      ctx.fillStyle = 'black'; ctx.fillText(textToShow, 0, 0);
      ctx.restore();
    }
    
  },[uiState.appState, uiState.isInIntro, uiState.introText, computeCornerDance, normalizedWords, canvasLabelsRef]);

  const tryStartRecordingWithTrim = useCallback(async function loop() {
    if (recordingStartedRef.current) return;

    const a = audioRef.current;
    const recorder = recordingServiceRef.current;
    const args = pendingRecordingArgsRef.current;

    if (!a || !recorder || !args) return;

    const audioMs = a.currentTime * 1000;
    if (audioMs < RECORDING_TRIM_START_MS) {
      requestAnimationFrame(() => void loop());
      return;
    }

    recordingStartedRef.current = true;
    isRecordingActiveRef.current = true;

    const now = performance.now();
    const visualRawTime = now - syncRef.current.startTime + syncRef.current.visualOffset;
    const warmupTimeMs = Math.max(0, visualRawTime) + RECORDING_VIDEO_LAG_MS;

    renderCompositeFrame(warmupTimeMs, { forceIntro: true, introTextOverride: getReadyText });
    await waitNextAnimationFrame();
    renderCompositeFrame(warmupTimeMs, { forceIntro: true, introTextOverride: getReadyText });
    await waitNextAnimationFrame();

    await recorder.startRecording({
      canvas: args.canvas,
      audioTrack: args.audioTrack,
      videoBitsPerSecond: args.videoBitsPerSecond
    });

    setRecState({ status: { isRecording: true } });
  }, [getReadyText, renderCompositeFrame, waitNextAnimationFrame]);

  const handleReset = useCallback(() => {
    cancelRafIfAny();
    isRecordingActiveRef.current = false;

    const a = audioRef.current;
    if (a) {
        a.pause();
        a.currentTime = 0;
        a.removeEventListener("playing", performAudioLock);
    }
    
    if (recordingServiceRef.current) { recordingServiceRef.current.cancelRecording(); recordingServiceRef.current = null; }
    if (recState.status.recordedUrl) URL.revokeObjectURL(recState.status.recordedUrl);
    generationTokenRef.current += 1;
    
    setUiState({
      appState: AppState.IDLE,
      uiRoundInfo: { round: 1, beat: 0, totalBeats: 40 },
      uiOverlayState: { show: false, alpha: 0, pattern:[] },
      isInIntro: false,
      introText: "",
      isGeminiGenerating: false,
      isMobileVertical: false,
      showGenError: false,
      genErrorClosing: false
    });
    setRecState({ status: { isRecording: false } });

    layoutAnim.current = 0; 
    
    startTimeRef.current = null; timelineRef.current = null; rendererRef.current = null; spritesheetRef.current = null;
    sessionSeedRef.current = null;
    engineStateRef.current = undefined; 
    resetCornerTransform();
  },[cancelRafIfAny, resetCornerTransform, recState.status.recordedUrl, performAudioLock]);

  const loadImage = useCallback(async (url: string): Promise<HTMLImageElement> => {
    const img = new Image(); img.crossOrigin = 'anonymous'; img.src = url;
    try { await img.decode(); return img; }
    catch { return new Promise((res, rej) => { img.onload = () => res(img); img.onerror = () => rej(new Error('Failed to load spritesheet.')); }); }
  },[]);

  const handleNextPreset = useCallback(() => {
    if (uiState.appState !== AppState.IDLE) return;
    const currentKey = wordsKey(words);
    const currentIndex = PRESETS.findIndex(p => wordsKey(p.words) === currentKey);
    setWords([...PRESETS[(currentIndex + 1) % PRESETS.length].words]);
  },[words, uiState.appState]);

  const handlePrevPreset = useCallback(() => {
    if (uiState.appState !== AppState.IDLE) return;
    const currentKey = wordsKey(words);
    const currentIndex = PRESETS.findIndex(p => wordsKey(p.words) === currentKey);
    setWords([...PRESETS[currentIndex === -1 ? PRESETS.length - 1 : (currentIndex - 1 + PRESETS.length) % PRESETS.length].words]);
  },[words, uiState.appState]);

  const handleShareVideo = useCallback(async () => {
    if (!recState.status.recordedBlob) return;
    const rawMime = (recState.status.mimeType || 'video/webm').toLowerCase();
    const isMp4 = rawMime.includes('mp4');
    const extension = isMp4 ? 'mp4' : 'webm';
    const file = new File([recState.status.recordedBlob], `BeatGrid_Gameplay.${extension}`, { type: isMp4 ? 'video/mp4' : 'video/webm', lastModified: Date.now() });
    try {
      const shareData = { files: [file], title: t('share.title'), text: t('share.text') };
      if (navigator.canShare(shareData)) await navigator.share(shareData);
    } catch (err: unknown) { 
      if (err instanceof Error && err.name !== 'AbortError') alert(t('errors.share.failed')); 
    }
  },[recState.status, t]);

  useEffect(() => {
    const status = recState.status;
    if (status.recordedBlob && status.mimeType && navigator.canShare) {
      const rawMime = status.mimeType.toLowerCase();
      const cleanMime = rawMime.includes('mp4') ? 'video/mp4' : 'video/webm';
      const file = new File([status.recordedBlob], `test.${cleanMime.split('/')[1]}`, { type: cleanMime, lastModified: Date.now() });
      try { 
        setRecState({ canShareNative: navigator.canShare({ files:[file] }) }); 
      } catch { 
        setRecState({ canShareNative: false }); 
      }
    } else { 
      setRecState({ canShareNative: false }); 
    }
  }, [recState.status]);

  const startGameSession = useCallback(async (currentWords: string[]) => {
    cancelRafIfAny();
    await ensureBackgroundCache();

    const seed = Math.random().toString(36).substr(2, 9); sessionSeedRef.current = seed;
    const settings: GameSettings = { words: currentWords, bpm: DEFAULT_BPM, beatsPerRound: BEATS_PER_ROUND, seed };
    timelineRef.current = createTimeline(settings);
    
    setUiState({ 
      uiRoundInfo: { round: 1, beat: 0, totalBeats: timelineRef.current.totalBeats },
      appState: AppState.PLAYING,
      isInIntro: true,
      showGenError: false,
      genErrorClosing: false
    });

    if (!rendererRef.current && canvasRef.current && spritesheetRef.current) {
        const { CanvasRenderer } = await import('./lib/game/renderer');
        CanvasRendererClassRef.current = CanvasRenderer;
        rendererRef.current = new CanvasRenderer(canvasRef.current, spritesheetRef.current);
    }
    
    const now = performance.now();
    startTimeRef.current = now; 
    syncRef.current = {
      startTime: now, visualOffset: 0, isLocked: false,
      driftSamples:[], lastAudioTime: 0, lastFrameTime: now
    };

    if (recState.enableRecording && canvasRef.current) {
      try {
        const { CanvasRecordingService } = await import('./services/recordingService');
        if (CanvasRecordingService.isSupported()) {
          if (recordingServiceRef.current) recordingServiceRef.current.cancelRecording();
          recordingServiceRef.current = new CanvasRecordingService();

          let audioTrack: MediaStreamTrack | undefined;
          const destNode = setupAudioGraph(); 
          if (destNode && destNode.stream.getAudioTracks().length > 0) {
             audioTrack = destNode.stream.getAudioTracks()[0];
          } else if (audioRef.current) {
             try {
                const a = audioRef.current as HTMLAudioElement & { captureStream?: () => MediaStream; mozCaptureStream?: () => MediaStream; };
                const s = a.captureStream ? a.captureStream() : a.mozCaptureStream?.();
                if (s) audioTrack = s.getAudioTracks()[0];
             } catch { /* ignore */ }
          }

          const targetCanvas = compositeCanvasRef.current || canvasRef.current;
          recordingStartedRef.current = false;
          recordingStoppedRef.current = false;
          pendingRecordingArgsRef.current = { canvas: targetCanvas, audioTrack, videoBitsPerSecond: 2_500_000 };
          isRecordingActiveRef.current = false;
          setRecState({ status: { isRecording: true } });
        }
      } catch (error: unknown) {
        console.error("Failed to load recording service:", error);
        isRecordingActiveRef.current = false;
        setRecState({ status: { isRecording: false, error: `Error grabación: ${error instanceof Error ? error.message : String(error)}` } });
      }
    } else {
      isRecordingActiveRef.current = false;
      setRecState({ status: { isRecording: false } });
    }

    if (audioRef.current) {
      const a = audioRef.current;
      a.currentTime = 0;
      a.volume = 1.0;
      a.muted = false;
      a.removeEventListener("playing", performAudioLock);
      a.addEventListener("playing", performAudioLock, { once: true });
      
      if (audioContextRef.current && audioContextRef.current.state === 'suspended') {
          audioContextRef.current.resume();
      }
      
      a.play().then(() => void tryStartRecordingWithTrim()).catch(() => { syncRef.current.isLocked = false; });
    }

  },[cancelRafIfAny, recState.enableRecording, performAudioLock, setupAudioGraph, ensureBackgroundCache, tryStartRecordingWithTrim]);

  const handleRestartCurrentSession = useCallback(async () => {
    cancelRafIfAny();
    await ensureBackgroundCache();

    if (!spritesheetRef.current || !canvasRef.current) { handleReset(); return; }
    isRecordingActiveRef.current = false;

    if (audioRef.current) { 
        audioRef.current.pause(); 
        audioRef.current.currentTime = 0; 
        audioRef.current.removeEventListener("playing", performAudioLock);
    }
    
    if (recordingServiceRef.current) { recordingServiceRef.current.cancelRecording(); recordingServiceRef.current = null; }
    if (recState.status.recordedUrl) URL.revokeObjectURL(recState.status.recordedUrl);

    setRecState({ status: { isRecording: false } });

    const seed = sessionSeedRef.current ?? Math.random().toString(36).substr(2, 9);
    sessionSeedRef.current = seed;
    timelineRef.current = createTimeline({ words, bpm: DEFAULT_BPM, beatsPerRound: BEATS_PER_ROUND, seed });
    engineStateRef.current = undefined; 

    setUiState({ 
      uiRoundInfo: { round: 1, beat: 0, totalBeats: timelineRef.current.totalBeats },
      appState: AppState.PLAYING,
      isInIntro: true,
      introText: "",
      showGenError: false,
      genErrorClosing: false
    });

    const now = performance.now();
    startTimeRef.current = now;
    syncRef.current = { startTime: now, visualOffset: 0, isLocked: false, driftSamples:[], lastAudioTime: 0, lastFrameTime: now };

    if (recState.enableRecording) {
      try {
        const { CanvasRecordingService } = await import('./services/recordingService');
        if (CanvasRecordingService.isSupported()) {
          recordingServiceRef.current = new CanvasRecordingService();
          let audioTrack: MediaStreamTrack | undefined;
          const destNode = setupAudioGraph(); 
          if (destNode && destNode.stream.getAudioTracks().length > 0) {
             audioTrack = destNode.stream.getAudioTracks()[0];
          } else if (audioRef.current) {
             try {
                const a = audioRef.current as HTMLAudioElement & { captureStream?: () => MediaStream; mozCaptureStream?: () => MediaStream; };
                const s = a.captureStream ? a.captureStream() : a.mozCaptureStream?.();
                if (s) audioTrack = s.getAudioTracks()[0];
             } catch { /* ignore */ }
          }
          const targetCanvas = compositeCanvasRef.current || canvasRef.current;
          recordingStartedRef.current = false;
          recordingStoppedRef.current = false;
          pendingRecordingArgsRef.current = { canvas: targetCanvas, audioTrack, videoBitsPerSecond: 2_500_000 };
          isRecordingActiveRef.current = false;
          setRecState({ status: { isRecording: true } });
        }
      } catch (error: unknown) {
        console.error("Failed to restart recording service:", error);
        isRecordingActiveRef.current = false;
        setRecState({ status: { isRecording: false, error: error instanceof Error ? error.message : String(error) } });
      }
    }

    if (audioRef.current) {
      const a = audioRef.current;
      a.currentTime = 0;
      a.muted = false;
      a.removeEventListener("playing", performAudioLock);
      a.addEventListener("playing", performAudioLock, { once: true });
      if (audioContextRef.current && audioContextRef.current.state === 'suspended') { audioContextRef.current.resume(); }
      a.play().then(() => void tryStartRecordingWithTrim()).catch(() => {});
    }

  },[cancelRafIfAny, handleReset, words, recState.status.recordedUrl, recState.enableRecording, performAudioLock, setupAudioGraph, ensureBackgroundCache, tryStartRecordingWithTrim]);

  const handleGenerate = useCallback(async () => {
    if (uiState.appState === AppState.GENERATING) return;
    const myToken = (generationTokenRef.current += 1);
    const preset = findPreset(words);
    const willUseGemini = !preset;
    
    clearGenErrorTimers();
    setUiState({ 
      isGeminiGenerating: willUseGemini, 
      appState: AppState.GENERATING,
      showGenError: false,
      genErrorClosing: false
    });
    setRecState({ status: { isRecording: false } });
    
    if (audioRef.current) {
      setupAudioGraph();
    }

    try {
      let url: string;
      if (preset) {
        url = preset.spritesheetUrl;
      } else {
        const { generateGameSpritesheet } = await import('./services/geminiService');
        url = await generateGameSpritesheet(words);
      }
      
      if (!isMountedRef.current || myToken !== generationTokenRef.current) return;
      const img = await loadImage(url);
      if (!isMountedRef.current || myToken !== generationTokenRef.current) return;
      
      const optimizedSprite = prepareSpriteSource(img);
      spritesheetRef.current = optimizedSprite;
      
      if (canvasRef.current) {
        if (!rendererRef.current) {
             const { CanvasRenderer } = await import('./lib/game/renderer');
             CanvasRendererClassRef.current = CanvasRenderer;
             rendererRef.current = new CanvasRenderer(canvasRef.current, optimizedSprite);
        } else {
            const RendererClass = CanvasRendererClassRef.current || (await import('./lib/game/renderer')).CanvasRenderer;
            CanvasRendererClassRef.current = RendererClass;
            rendererRef.current = new RendererClass(canvasRef.current, optimizedSprite);
        }
      }
      startGameSession(words);
      
    } catch (e) {
      console.error("[App] Gen Error:", e);
      if (isMountedRef.current && myToken === generationTokenRef.current) {
        setUiState({ appState: AppState.IDLE });
        if (willUseGemini) openGenError();
      }
    } finally {
      if (isMountedRef.current && myToken === generationTokenRef.current) {
        setUiState({ isGeminiGenerating: false });
      }
    }
  },[uiState.appState, words, loadImage, startGameSession, prepareSpriteSource, openGenError, setupAudioGraph, clearGenErrorTimers]);

  const projectToViewCanvas = useCallback((progress: number) => {
    const src = canvasRef.current;
    const dst = viewCanvasRef.current;
    const container = canvasContainerRef.current;
    
    if (!src || !dst) return;
    const dstCtx = dst.getContext('2d', { alpha: true });
    if (!dstCtx) return;

    const currentW = BASE_W + (VERTICAL_W - BASE_W) * progress;
    const currentH = BASE_H + (VERTICAL_H - BASE_H) * progress;
    const targetW = Math.round(currentW);
    const targetH = Math.round(currentH);

    if (dst.width !== targetW || dst.height !== targetH) {
        dst.width = targetW;
        dst.height = targetH;
    } else {
        dstCtx.clearRect(0, 0, dst.width, dst.height);
    }
    
    lastLayoutProgressRef.current = progress;

    if (container) {
        const aspectRatio = currentW / currentH;
        container.style.aspectRatio = aspectRatio.toString();
    }

    const srcCellW = src.width / 4; 
    const srcCellH = src.height / 2;

    const dstCellH_vert = 400; 
    const dstCellW_vert = 400; 
    const dstOffsetX_vert = (VERTICAL_W - (dstCellW_vert * 2)) / 2; 
    
    const dstCellW_horiz = srcCellW;
    const dstCellH_horiz = srcCellH;
    const dstOffsetX_horiz = 0;

    for (let i = 0; i < 8; i++) {
        const srcCol = i % 4;
        const srcRow = Math.floor(i / 4);
        const sx = srcCol * srcCellW;
        const sy = srcRow * srcCellH;

        const startX = dstOffsetX_horiz + (srcCol * dstCellW_horiz);
        const startY = srcRow * dstCellH_horiz;
        const startW = dstCellW_horiz;
        const startH = dstCellH_horiz;

        const dstCol_v = i % 2;
        const dstRow_v = Math.floor(i / 2); 
        
        const endX = dstOffsetX_vert + (dstCol_v * dstCellW_vert);
        const endY = dstRow_v * dstCellH_vert;
        const endW = dstCellW_vert;
        const endH = dstCellH_vert;

        const currentX = startX + (endX - startX) * progress;
        const currentY = startY + (endY - startY) * progress;
        const currentCW = startW + (endW - startW) * progress;
        const currentCH = startH + (endH - startH) * progress;

        dstCtx.drawImage(src, sx, sy, srcCellW, srcCellH, currentX, currentY, currentCW, currentCH);
    }
  },[]);

  const animate = useCallback(function loop() {
    if (uiState.appState !== AppState.PLAYING || !timelineRef.current || !canvasRef.current || !spritesheetRef.current) return;

    const targetLayout = uiState.isMobileVertical ? 1 : 0;
    const diff = targetLayout - layoutAnim.current;
    if (Math.abs(diff) > 0.001) layoutAnim.current += diff * 0.1;
    else layoutAnim.current = targetLayout;

    const now = performance.now();
    const deltaTime = now - syncRef.current.lastFrameTime;
    syncRef.current.lastFrameTime = now;

    let visualRawTime = (now - syncRef.current.startTime) + syncRef.current.visualOffset;

    if (audioRef.current && !audioRef.current.paused && syncRef.current.isLocked) {
        const audioTimeMs = audioRef.current.currentTime * 1000;
        if (audioTimeMs > 200) {
            if (Math.abs(audioTimeMs - syncRef.current.lastAudioTime) > SYNC_AUDIO_EPSILON_MS) {
                const drift = audioTimeMs - visualRawTime;
                syncRef.current.driftSamples.push(drift);
                if (syncRef.current.driftSamples.length > SYNC_SAMPLE_SIZE) syncRef.current.driftSamples.shift();
                syncRef.current.lastAudioTime = audioTimeMs;
            }
            let avgDrift = 0;
            if (syncRef.current.driftSamples.length > 0) avgDrift = syncRef.current.driftSamples.reduce((a, b) => a + b, 0) / syncRef.current.driftSamples.length;
            const absAvgDrift = Math.abs(avgDrift);
            if (absAvgDrift > SYNC_THRESHOLD_IGNORE_MS) {
                if (absAvgDrift < SYNC_THRESHOLD_SOFT_MS) {
                    const timeScaler = deltaTime / 16.666;
                    const correction = avgDrift * SYNC_NUDGE_FACTOR * timeScaler;
                    const maxCorrectionPerFrame = 10 * timeScaler;
                    const safeCorrection = Math.max(-maxCorrectionPerFrame, Math.min(maxCorrectionPerFrame, correction));
                    syncRef.current.visualOffset += safeCorrection;
                } else {
                    syncRef.current.startTime = now - audioTimeMs;
                    syncRef.current.visualOffset = 0;
                    syncRef.current.driftSamples =[]; 
                }
            }
        }
        visualRawTime = (now - syncRef.current.startTime) + syncRef.current.visualOffset;
    } else if (!audioRef.current && startTimeRef.current) {
        visualRawTime = now - startTimeRef.current;
    }

    const visualTimeMs = Math.max(0, visualRawTime + GLOBAL_AUDIO_LATENCY_MS);
    const recordingBaseTimeMs = Math.max(0, visualRawTime);
    
    const offsetMs = SONG_OFFSET_SEC * 1000;
    applyCornerDance(visualTimeMs);
    
    if (!rendererRef.current && CanvasRendererClassRef.current) rendererRef.current = new CanvasRendererClassRef.current(canvasRef.current, spritesheetRef.current);
    if (!rendererRef.current) return;

    if (isRecordingActiveRef.current) {
        const recordingTimeMs = recordingBaseTimeMs + RECORDING_VIDEO_LAG_MS;
        if (recordingTimeMs < offsetMs) {
            const timeRemaining = offsetMs - recordingTimeMs;
            const visualBeatsLeft = Math.ceil((timeRemaining / 1000) / (60 / DEFAULT_BPM));
            const recIntroText = visualBeatsLeft > 4 ? getReadyText : visualBeatsLeft.toString();
            let recIntroState: Partial<GameState> | null = null;
            if (timeRemaining <= CELL_LABEL_DURATION_MS) {
                const timeSinceWindowStart = CELL_LABEL_DURATION_MS - timeRemaining;
                const alpha = CELL_LABEL_FADE_IN_MS > 0 ? Math.min(1, Math.max(0, timeSinceWindowStart / CELL_LABEL_FADE_IN_MS)) : 1;
                recIntroState = { currentPattern: timelineRef.current.rounds[0].pattern, showCellLabels: true, cellLabelsAlpha: alpha, roundNumber: 1 };
            }
            rendererRef.current.render(canvasRef.current.width, canvasRef.current.height, timelineRef.current.rounds[0].pattern, timelineRef.current.rounds[0].pattern, 0, 0, -1);
            renderCompositeFrame(recordingTimeMs, { forceIntro: true, introTextOverride: recIntroText, gameStateOverride: recIntroState });
        } else {
            const gameTimeRec = recordingTimeMs - offsetMs;
            const recStateLoc = getGameStateAtTime(gameTimeRec, timelineRef.current);
            rendererRef.current.render(canvasRef.current.width, canvasRef.current.height, recStateLoc.currentPattern, recStateLoc.prevPattern, recStateLoc.interpolation, (recordingTimeMs % timelineRef.current.msPerBeat) / timelineRef.current.msPerBeat, recStateLoc.activeCellIndex);
            renderCompositeFrame(recordingTimeMs, { gameStateOverride: recStateLoc });
        }
    }

    if (visualTimeMs < offsetMs) {
      const timeRemaining = offsetMs - visualTimeMs;
      const visualBeatsLeft = Math.ceil((timeRemaining / 1000) / (60 / DEFAULT_BPM));
      const nextText = visualBeatsLeft > 4 ? getReadyText : visualBeatsLeft.toString();
      
      setUiState((prev) => {
        const changes: Partial<UiState> = {};
        if (!prev.isInIntro) changes.isInIntro = true;
        if (nextText !== prev.introText) changes.introText = nextText;
        
        if (timeRemaining <= CELL_LABEL_DURATION_MS) {
          const timeSinceWindowStart = CELL_LABEL_DURATION_MS - timeRemaining;
          const alpha = CELL_LABEL_FADE_IN_MS > 0 ? Math.min(1, Math.max(0, timeSinceWindowStart / CELL_LABEL_FADE_IN_MS)) : 1;
          if (prev.uiOverlayState.alpha !== alpha || !prev.uiOverlayState.show) {
            changes.uiOverlayState = { show: true, alpha, pattern: timelineRef.current!.rounds[0].pattern };
          }
        } else if (prev.uiOverlayState.show) { 
          changes.uiOverlayState = { ...prev.uiOverlayState, show: false }; 
        }
        return Object.keys(changes).length > 0 ? changes : null;
      });

      rendererRef.current.render(canvasRef.current.width, canvasRef.current.height, timelineRef.current.rounds[0].pattern, timelineRef.current.rounds[0].pattern, 0, 0, -1);
      projectToViewCanvas(layoutAnim.current);
      requestRef.current = requestAnimationFrame(loop);
      return;
    }

    const gameTimeMs = visualTimeMs - offsetMs;
    engineStateRef.current = getGameStateAtTime(gameTimeMs, timelineRef.current, engineStateRef.current);
    const state = engineStateRef.current;

    setUiState((prev) => {
      const changes: Partial<UiState> = {};
      if (prev.isInIntro) changes.isInIntro = false;
      if (state.roundNumber !== prev.uiRoundInfo.round) {
          changes.uiRoundInfo = { round: state.roundNumber, beat: 0, totalBeats: timelineRef.current!.totalBeats };
      }
      if (state.showCellLabels !== prev.uiOverlayState.show || Math.abs(state.cellLabelsAlpha - prev.uiOverlayState.alpha) > 0.05) {
          changes.uiOverlayState = { show: state.showCellLabels, alpha: state.cellLabelsAlpha, pattern: state.currentPattern };
      }
      return Object.keys(changes).length > 0 ? changes : null;
    });

    if (isRecordingActiveRef.current && recordingStartedRef.current && !recordingStoppedRef.current && timelineRef.current) {
      const totalGameMs = timelineRef.current.totalBeats * timelineRef.current.msPerBeat;
      if (gameTimeMs >= Math.max(0, totalGameMs - RECORDING_TRIM_END_MS)) {
        recordingStoppedRef.current = true;
        const finalRecTime = recordingBaseTimeMs + RECORDING_VIDEO_LAG_MS;
        rendererRef.current.render(canvasRef.current.width, canvasRef.current.height, state.currentPattern, state.prevPattern, state.interpolation, 0, -1);
        renderCompositeFrame(finalRecTime, { gameStateOverride: state });
        const activeRecorder = recordingServiceRef.current;
        recordingServiceRef.current = null;
        isRecordingActiveRef.current = false;
        if (activeRecorder) {
          activeRecorder.stopRecording()
            .then((r: RecordingResult) => setRecState({ status: { isRecording: false, recordedUrl: r.url, recordedBlob: r.blob, mimeType: r.mimeType } }))
            .catch(() => setRecState({ status: { isRecording: false, error: 'Error guardando video.' } }));
        } else {
          setRecState({ status: { isRecording: false } });
        }
      }
    }

    if (state.isFinished) {
      cancelRafIfAny();
      if (audioRef.current) { 
          audioRef.current.pause(); audioRef.current.currentTime = 0; 
          audioRef.current.removeEventListener("playing", performAudioLock);
      }
      if (isRecordingActiveRef.current && !recordingStoppedRef.current) {
          const finalRecTime = recordingBaseTimeMs + RECORDING_VIDEO_LAG_MS;
          rendererRef.current.render(canvasRef.current.width, canvasRef.current.height, state.currentPattern, state.prevPattern, state.interpolation, 0, -1);
          renderCompositeFrame(finalRecTime, { gameStateOverride: state }); 
          const activeRecorder = recordingServiceRef.current; 
          recordingServiceRef.current = null; isRecordingActiveRef.current = false;
          if (activeRecorder) {
              activeRecorder.stopRecording()
                .then((r: RecordingResult) => setRecState({ status: { isRecording: false, recordedUrl: r.url, recordedBlob: r.blob, mimeType: r.mimeType } }))
                .catch(() => setRecState({ status: { isRecording: false, error: 'Error guardando video.' } }));
          }
      } else if (!recordingStoppedRef.current) { 
          setRecState({ status: { isRecording: false } }); 
      }
      setUiState({ appState: AppState.FINISHED }); resetCornerTransform();
      return;
    }

    rendererRef.current.render(canvasRef.current.width, canvasRef.current.height, state.currentPattern, state.prevPattern, state.interpolation, (gameTimeMs % timelineRef.current.msPerBeat) / timelineRef.current.msPerBeat, state.activeCellIndex);
    projectToViewCanvas(layoutAnim.current);
    requestRef.current = requestAnimationFrame(loop);
    
  },[uiState.appState, uiState.isMobileVertical, cancelRafIfAny, applyCornerDance, resetCornerTransform, renderCompositeFrame, getReadyText, performAudioLock, projectToViewCanvas]);

  useEffect(() => {
    if (uiState.appState === AppState.PLAYING) requestRef.current = requestAnimationFrame(animate);
    return () => cancelRafIfAny();
  },[uiState.appState, animate, cancelRafIfAny]);


  const showMenu = uiState.appState === AppState.IDLE || uiState.appState === AppState.GENERATING;
  const showGame = uiState.appState === AppState.PLAYING || uiState.appState === AppState.FINISHED;
  const isGenerating = uiState.appState === AppState.GENERATING;
  const showVideoSection = !!recState.status.recordedUrl || recState.status.isRecording || !!recState.status.error;

  const overlayCols = uiState.isMobileVertical ? 2 : 4;
  const overlayRows = uiState.isMobileVertical ? 4 : 2;
  const shouldRenderOverlay = uiState.appState === AppState.PLAYING && uiState.uiOverlayState.show && uiState.uiOverlayState.pattern.length > 0;
  
  const overlayTransform = uiState.isMobileVertical ? "translateX(5.55%) scaleX(0.889)" : "translateX(0) scaleX(1)";

  return (
    <div className="h-svh min-h-svh w-full relative overflow-hidden bg-[#f0f0f0] box-border">
      
      <img 
        src="/images/paper.webp" 
        alt="" 
        fetchPriority="high" 
        decoding="async"
        className="absolute inset-0 w-full h-full object-cover mix-blend-multiply pointer-events-none z-0"
        style={{ backgroundColor: '#f0f0f0' }} 
      />

      <audio ref={audioRef} src="/audio/game-track.opus" preload="auto" crossOrigin="anonymous" />
      
      <div ref={cornerTLRef} className="absolute top-2 sm:top-6 left-2 sm:left-6 text-5xl sm:text-7xl drop-shadow-md z-20 select-none pointer-events-none emoji-safe" style={{ transform: 'translate3d(0, 0, 0) rotate(-15deg) scale(1)' }}>🎉</div>
      <div ref={cornerTRRef} className="absolute top-2 sm:top-6 right-2 sm:right-6 text-5xl sm:text-7xl drop-shadow-md z-20 select-none pointer-events-none emoji-safe" style={{ transform: 'translate3d(0, 0, 0) rotate(15deg) scale(1)' }}>🎁</div>
      <div ref={cornerBLRef} className="absolute bottom-2 sm:bottom-6 left-2 sm:left-6 text-5xl sm:text-7xl drop-shadow-md z-20 select-none pointer-events-none emoji-safe" style={{ transform: 'translate3d(0, 0, 0) rotate(-10deg) scale(1)' }}>😎</div>
      <div ref={cornerBRRef} className="absolute bottom-2 sm:bottom-6 right-2 sm:right-6 text-5xl sm:text-7xl drop-shadow-md z-20 select-none pointer-events-none emoji-safe" style={{ transform: 'translate3d(0, 0, 0) rotate(10deg) scale(1)' }}>🐸</div>

      {uiState.appState === AppState.PLAYING && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-100 md:hidden portrait:block landscape:hidden">
          <button 
            type="button"
            onClick={() => setUiState({ isMobileVertical: !uiState.isMobileVertical })}
            aria-label={uiState.isMobileVertical ? "Switch to Horizontal View" : "Switch to Vertical View"}
            className="group flex items-center justify-center w-14 h-14 bg-white border-4 border-black rounded-full shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] active:translate-y-0.5 active:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all"
          >
            <svg 
              className={`w-7 h-7 text-black transition-transform duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)] ${uiState.isMobileVertical ? 'rotate-90' : 'rotate-0'}`} 
              viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="square" strokeLinejoin="miter"
            >
              <path d="M21 12H3M3 12L8 17M3 12L8 7M21 12L16 17M21 12L16 7" />
            </svg>
          </button>
        </div>
      )}

      <div className={`absolute inset-0 z-30 w-full h-full overflow-y-scroll overflow-x-hidden no-scrollbar layer-transition ${showMenu ? 'visible-layer' : 'hidden-layer'}`}>
        <div className="min-h-full w-full flex flex-col items-center justify-center py-8 px-4 relative">
          
          {showMenu && <LanguageMenu currentLocale={currentLocale} onLanguageChange={handleLanguageChange} />}

          {/* INICIO BLOQUE DE ERROR GEMINI AÑADIDO */}
          {uiState.showGenError && (
            <div 
              role="alert"
              className={`absolute top-20 md:top-24 left-1/2 -translate-x-1/2 z-60 flex items-center gap-3 bg-[#ff0055] border-4 border-black px-4 py-3 md:px-6 md:py-4 rounded-2xl shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-all duration-300 origin-center w-[90%] max-w-md ${uiState.genErrorClosing ? 'opacity-0 scale-95 -translate-y-2' : 'opacity-100 scale-100 translate-y-0 animate-slam'}`}
            >
              <span className="text-white text-xl md:text-2xl shrink-0" aria-hidden="true">⚠️</span>
              <span className="text-white font-black text-xs md:text-sm uppercase tracking-widest flex-1 text-left" style={{ fontFamily: "'Montserrat', sans-serif" }}>
                {t('errors.genError', 'Error generating. Please try again.')}
              </span>
              <button 
                type="button" 
                onClick={closeGenError}
                aria-label="Close error message"
                className="shrink-0 bg-transparent border-none text-white hover:scale-110 active:scale-95 transition-transform focus:outline-none cursor-pointer flex items-center justify-center"
              >
                <svg className="w-5 h-5 md:w-6 md:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="4" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
          )}
          {/* FIN BLOQUE DE ERROR GEMINI */}

          <div className="relative z-30 flex flex-col items-center gap-4 md:gap-8 text-center p-5 md:p-8 bg-white rounded-3xl border-4 md:border-6 border-black hard-shadow w-full max-w-2xl mt-12 md:mt-0">
            <div className="flex items-center justify-between w-full gap-2 md:gap-4 mb-2 md:mb-0">
              <NavArrow direction="left" onClick={handlePrevPreset} disabled={isGenerating} ariaLabel={t('nav.prevPresetAria')} />
              <div className="flex flex-col gap-1 items-center transform -rotate-2 mx-auto">
                <h1 className="text-4xl md:text-6xl font-black text-black tracking-tighter uppercase leading-none">{t('hero.title')}</h1>
                <h2 className="text-xl md:text-3xl font-black text-white bg-[#ff0055] px-4 py-1 tracking-widest uppercase border-4 border-black inline-block transform rotate-1">{t('hero.subtitle')}</h2>
              </div>
              <NavArrow direction="right" onClick={handleNextPreset} disabled={isGenerating} ariaLabel={t('nav.nextPresetAria')} />
            </div>
            
            <div className="w-full">
                <WordEditor words={words} setWords={setWords} onGenerate={handleGenerate} disabled={isGenerating} isGeminiGenerating={uiState.isGeminiGenerating} />
            </div>
            
            <RecordingToggle 
              enableRecording={recState.enableRecording} 
              setEnableRecording={(val) => setRecState({ enableRecording: val })} 
              disabled={isGenerating} 
            />
          </div>
        </div>
      </div>

      {uiState.appState === AppState.FINISHED && (
        <div className="fixed inset-0 z-999 w-full h-full overflow-y-scroll no-scrollbar animate-flash-overlay backdrop-blur-md flex items-center justify-center">
           <div className="min-h-full w-full flex flex-col items-center justify-center p-4 md:p-8">
            <div className="relative bg-white p-5 md:p-8 border-[6px] border-black hard-shadow flex flex-col items-center gap-6 max-w-4xl w-full box-border animate-slam origin-center">
              <h2 className="text-4xl md:text-6xl font-black text-black uppercase tracking-tighter transform -rotate-2 text-center leading-none mt-2 animate-delay-1">{t('end.title')}</h2>
              
              {showVideoSection && (
                <div className="w-full flex flex-col items-center animate-delay-2">
                  <div className="w-full md:w-80 mx-auto border-4 border-black bg-zinc-950 relative aspect-video shadow-inner">
                    <video src={recState.status.recordedUrl} controls autoPlay loop className="w-full h-full object-contain" />
                  </div>
                </div>
              )}
              
              <div className="flex flex-col w-full gap-4 mt-2 animate-delay-3">
                <div className="flex flex-col sm:flex-row gap-3 w-full justify-center">
                  {recState.canShareNative && (
                    <button type="button" onClick={handleShareVideo} className="w-full sm:w-auto justify-center bg-[#00ff99] text-black border-4 border-black px-6 py-3 text-sm md:text-lg font-black uppercase hard-shadow hard-shadow-hover transition-all flex items-center gap-2 hover:bg-[#00cc7a]">
                      <span>🚀</span><span>{t('actions.share')}</span>
                    </button>
                  )}
                  {recState.status.recordedUrl && (
                    <a href={recState.status.recordedUrl} download={`BeatGrid_Session_${new Date().getTime()}${recState.status.mimeType?.includes('mp4') ? '.mp4' : '.webm'}`} className="w-full sm:w-auto justify-center bg-white text-black border-4 border-black px-6 py-3 text-sm md:text-lg font-black uppercase hard-shadow hard-shadow-hover transition-all flex items-center gap-2 hover:bg-gray-50">
                      <span>⬇</span><span>{t('actions.download')}</span>
                    </a>
                  )}
                  <button type="button" onClick={handleRestartCurrentSession} className="w-full sm:w-auto bg-white text-black border-4 border-black px-6 py-3 text-sm md:text-lg font-black uppercase hard-shadow hard-shadow-hover transition-all hover:bg-gray-50">
                    {t('actions.restart')}
                  </button>
                  <button type="button" onClick={handleReset} className="w-full sm:w-auto bg-[#ffe600] text-black border-4 border-black px-6 py-3 text-sm md:text-lg font-black uppercase hard-shadow hard-shadow-hover transition-all hover:bg-[#ffd500]">
                    {t('actions.new')}
                  </button>
                </div>
                <div className="flex w-full justify-center mt-1">
                  <a href={BUY_ME_COFFEE_URL} target="_blank" rel="noopener noreferrer" className="group relative flex items-center justify-center gap-2 bg-[#ff0055] text-white border-4 border-black px-8 py-2 text-xs md:text-sm font-black uppercase tracking-widest hard-shadow transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] active:translate-y-0 active:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]" style={{ fontFamily: "'Montserrat', sans-serif" }}>
                    <svg className="w-4 h-4 md:w-5 md:h-5 text-white fill-current" viewBox="0 0 24 24"><path d="M20,3H4v10c0,2.21,1.79,4,4,4h6c2.21,0,4-1.79,4-4v-3h2c1.1,0,2-0.9,2-2V5C22,3.9,21.1,3,20,3z M20,8h-2V5h2V8z M4,19h16v2H4V19z" /></svg>
                    <span>{t('actions.support')}</span>
                    <div className="absolute inset-0 bg-white opacity-0 group-hover:opacity-10 transition-opacity duration-200 pointer-events-none"></div>
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className={`absolute inset-0 flex flex-col items-center justify-center p-4 layer-transition ${showGame ? 'visible-layer' : 'hidden-layer'}`}>
        
        {uiState.appState === AppState.PLAYING && uiState.isInIntro && (
          <div className="absolute inset-0 z-50 flex items-center justify-center pointer-events-none px-4">
            <style>{`
              @keyframes rhythmicBounce {
                0%, 100% { 
                  transform: translate3d(0, 0, 0); 
                  animation-timing-function: cubic-bezier(0.8, 0, 1, 1); 
                }
                50% { 
                  transform: translate3d(0, -15%, 0); 
                  animation-timing-function: cubic-bezier(0, 0, 0.2, 1); 
                }
              }
            `}</style>
            <h1 
              key={uiState.introText} 
              className="w-full text-center wrap-break-word leading-[0.85] text-[14vw] lg:text-[12rem] font-black text-black tracking-tighter drop-shadow-xl select-none" 
              style={{ 
                fontFamily: "'Montserrat', sans-serif", 
                textShadow: "4px 4px 0px #fff, 8px 8px 0px rgba(0,0,0,0.15)", 
                maxWidth: "100%", 
                wordSpacing: "0.1em", 
                animation: "rhythmicBounce 1s infinite" 
              }}>
              {uiState.introText}
            </h1>
          </div>
        )}
        
        {uiState.appState === AppState.PLAYING && !uiState.isInIntro && (
            <HUD round={uiState.uiRoundInfo.round} beat={uiState.uiRoundInfo.beat} totalBeats={uiState.uiRoundInfo.totalBeats} words={words} />
        )}
        
        <div className="relative w-full h-[85svh] max-h-[85svh] flex items-center justify-center z-10 pointer-events-none">
          <div 
            ref={canvasContainerRef}
            className="relative w-auto h-auto max-w-full max-h-full pointer-events-auto"
            style={{ transition: 'aspect-ratio 0.1s linear' }}
          >
            <canvas ref={canvasRef} width={BASE_W} height={BASE_H} className="hidden" />
            <canvas 
               ref={viewCanvasRef}
               width={BASE_W} 
               height={BASE_H}
               style={{ background: 'transparent' }}
               className="block w-full h-full object-contain"
            />
            {shouldRenderOverlay && (
              <div 
                className="absolute inset-0 z-60" 
                style={{ opacity: uiState.uiOverlayState.alpha, transition: 'opacity 100ms linear' }}
              >
                <div 
                  className="w-full h-full will-change-transform" 
                  style={{ 
                    display: 'grid', 
                    gridTemplateColumns: `repeat(${overlayCols}, 1fr)`, 
                    gridTemplateRows: `repeat(${overlayRows}, 1fr)`, 
                    transform: overlayTransform, 
                    transformOrigin: 'center center', 
                    transition: 'transform 160ms cubic-bezier(0.16, 1, 0.3, 1)'
                  }}
                >
                  {uiState.uiOverlayState.pattern.map((q: number, i: number) => {
                    const cellKey = CELL_IDS[i] || `fallback-cell-${i}`;
                    const safeQ = Number.isFinite(q) ? Math.max(0, Math.min(3, q)) : 0;
                    const label = normalizedWords[safeQ] ?? '';
                    return (
                      <div key={cellKey} className="relative w-full h-full">
                        <div className="absolute left-1/2 bottom-[10%] -translate-x-1/2 px-2 py-1 bg-white/90 border-[3px] border-black rounded-lg hard-shadow-sm whitespace-nowrap z-10">
                          <span className="block text-[10px] sm:text-xs md:text-sm font-black tracking-wider text-black uppercase leading-none">{label.toUpperCase()}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

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
          <Route path="/:lang" element={<I18nRouteWrapper><GameContent /></I18nRouteWrapper>} />
          <Route path="/:lang/play" element={<I18nRouteWrapper><GameContent /></I18nRouteWrapper>} />
          <Route path="/:lang/share/:slug" element={<I18nRouteWrapper><GameContent /></I18nRouteWrapper>} />
          <Route path="*" element={<div>404 - Not Found</div>} />
        </Routes>
      </BrowserRouter>
    </HelmetProvider>
  );
};

export default App;