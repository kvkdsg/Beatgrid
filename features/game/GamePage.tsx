import React, { useState, useRef, useEffect, useCallback, useMemo, useReducer } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

import type { AppState as AppStateType, GameTimeline } from '../../types';
import { AppState } from '../../types'; 
import type { CanvasRenderer, SpriteSource } from '../../lib/game/renderer';

import {
  DEFAULT_BPM, BEATS_PER_ROUND, SONG_OFFSET_SEC, CELL_LABEL_DURATION_MS,
  CELL_LABEL_FADE_IN_MS, GLOBAL_AUDIO_LATENCY_MS, SYNC_THRESHOLD_IGNORE_MS,
  SYNC_THRESHOLD_SOFT_MS, SYNC_NUDGE_FACTOR, SYNC_SAMPLE_SIZE, SYNC_AUDIO_EPSILON_MS,
  RECORDING_VIDEO_LAG_MS, RECORDING_TRIM_START_MS, RECORDING_TRIM_END_MS
} from '../../constants';

import { createTimeline, getGameStateAtTime, GameState } from '../../lib/game/engine';
import { findPreset, pickRandomPreset, PRESETS, wordsKey } from '../../presets';
import { setLocale } from '../../i18n';
import { AppLocale, toSupportedLocale, DEFAULT_LOCALE } from '../../i18n/config';

import MainMenu from '../../components/MainMenu';
import { GameStage } from './components/GameStage';
import { VideoResultPanel } from './components/VideoResultPanel';
import { useRecordingFlow } from './hooks/useRecordingFlow';
import { useGameAudio } from './hooks/useGameAudio';
import { LOCALE_MENU } from '../../components/locales';

// --- MATH UTILS ---
const TAU = Math.PI * 2;
const clamp01 = (v: number) => Math.max(0, Math.min(1, Number.isNaN(v) ? 0 : v));
const easeOutCubic = (x: number) => 1 - Math.pow(1 - clamp01(x), 3);
const beatPulse = (phase01: number) => {
  const tVal = Math.min(1, clamp01(phase01) * 3.5);
  return 1 - easeOutCubic(tVal);
};

const textMetricsCache = new Map<string, number>();

const VIDEO_WIDTH = 1280; const VIDEO_HEIGHT = 720;
const BASE_W = 1600; const BASE_H = 800;
const VERTICAL_W = 900; const VERTICAL_H = 1600;

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
  appState: AppState.IDLE, isGeminiGenerating: false, isInIntro: false, introText: "",
  uiRoundInfo: { round: 1, beat: 0, totalBeats: 40 }, uiOverlayState: { show: false, alpha: 0, pattern:[] },
  isMobileVertical: false, showGenError: false, genErrorClosing: false,
};

const GamePage: React.FC = () => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const { slug } = useParams();

  const[uiState, setUiState] = useReducer(
    (state: UiState, action: Partial<UiState> | ((prev: UiState) => Partial<UiState> | null)) => {
      const next = typeof action === 'function' ? action(state) : action;
      if (!next) return state;
      let hasChanges = false;
      for (const key in next) { if (state[key as keyof UiState] !== next[key as keyof UiState]) { hasChanges = true; break; } }
      return hasChanges ? { ...state, ...next } : state;
    },
    initialUiState
  );

  const { audioRef, audioContextRef, setupAudioGraph } = useGameAudio();
  
  const recFlow = useRecordingFlow();
  const { enableRecording, setEnableRecording, status: recStatus, setStatus: setRecStatus, canShareNative } = recFlow;

  const layoutAnim = useRef(0);
  const lastLayoutProgressRef = useRef<number>(-1);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(orientation: landscape)');
    const handleOrientationChange = (e: MediaQueryListEvent | MediaQueryList) => { if (e.matches) setUiState({ isMobileVertical: false }); };
    handleOrientationChange(mediaQuery);
    mediaQuery.addEventListener('change', handleOrientationChange);
    return () => mediaQuery.removeEventListener('change', handleOrientationChange);
  },[]);

  const currentLocale = useMemo(() => toSupportedLocale(i18n.resolvedLanguage ?? i18n.language) ?? DEFAULT_LOCALE,[i18n.resolvedLanguage, i18n.language]);

  const canvasLabelsRef = useRef({ roundLabel: 'ROUND' });
  useEffect(() => { canvasLabelsRef.current.roundLabel = t('canvas.roundLabel'); }, [t]);

  const parseSlug = (s: string) => s.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1));
  const[words, setWords] = useState<string[]>(() => {
    if (slug) {
      try { const decoded = parseSlug(slug); if (decoded.length === 4) return decoded; } catch { /* ignore */ }
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
  const compositeCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const compositeCtxRef = useRef<CanvasRenderingContext2D | null>(null);
  const cachedBgCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const spritesheetRef = useRef<SpriteSource | null>(null);
  const rendererRef = useRef<CanvasRenderer | null>(null);
  const CanvasRendererClassRef = useRef<typeof CanvasRenderer | null>(null);

  const timelineRef = useRef<GameTimeline | null>(null);
  const requestRef = useRef<number | undefined>(undefined);
  
  const isMountedRef = useRef(true);
  const generationTokenRef = useRef(0);
  const sessionSeedRef = useRef<string | null>(null);

  const startTimeRef = useRef<number | null>(null);
  const syncRef = useRef({ startTime: 0, visualOffset: 0, isLocked: false, driftSamples:[] as number[], lastAudioTime: 0, lastFrameTime: 0 });
  const engineStateRef = useRef<GameState | undefined>(undefined);

  const cornerTLRef = useRef<HTMLDivElement>(null);
  const cornerTRRef = useRef<HTMLDivElement>(null);
  const cornerBLRef = useRef<HTMLDivElement>(null);
  const cornerBRRef = useRef<HTMLDivElement>(null);

  const normalizedWords = useMemo(() => (words ??[]).map((w) => String(w ?? '').trim()), [words]);
  const getReadyText = t('intro.getReady');

  const handleLanguageChange = async (newLocale: AppLocale) => {
    await setLocale(newLocale);
    const currentPath = location.pathname;
    const segments = currentPath.split('/').filter(Boolean);
    if (segments.length > 0 && LOCALE_MENU.includes(segments[0] as AppLocale)) segments[0] = newLocale;
    else segments.unshift(newLocale);
    navigate(`/${segments.join('/')}`);
  };

  const clearGenErrorTimers = useCallback(() => {
    if (genErrorAutoCloseTimerRef.current) clearTimeout(genErrorAutoCloseTimerRef.current);
    if (genErrorFadeTimerRef.current) clearTimeout(genErrorFadeTimerRef.current);
  },[]);

  const closeGenError = useCallback(() => {
    setUiState({ genErrorClosing: true });
    genErrorFadeTimerRef.current = window.setTimeout(() => setUiState({ showGenError: false, genErrorClosing: false }), 300);
  },[]);

  const openGenError = useCallback(() => {
    clearGenErrorTimers(); 
    setUiState({ showGenError: true, genErrorClosing: false });
    genErrorAutoCloseTimerRef.current = window.setTimeout(() => closeGenError(), 5000);
  },[clearGenErrorTimers, closeGenError]);

  const computeCornerDance = useCallback((timeMs: number) => {
    const bpm = DEFAULT_BPM; const beats = (timeMs / 1000) * (bpm / 60); const phase = beats - Math.floor(beats);
    const pulse = beatPulse(phase); const swing = Math.sin(beats * TAU); const scale = 1 + pulse * 0.12;
    const y = (-6 * pulse) + (2.5 * swing); const rot = (8 * swing) + (6 * pulse);
    return { scale, y, rot };
  },[]);

  const resetCornerTransform = useCallback(() => {
    const set = (el: HTMLDivElement | null, deg: number) => { if (el) el.style.transform = `translate3d(0, 0, 0) rotate(${deg}deg) scale(1)`; };
    set(cornerTLRef.current, -15); set(cornerTRRef.current, 15);
    set(cornerBLRef.current, -10); set(cornerBRRef.current, 10);
  },[]);

  const applyCornerDance = useCallback((timeMs: number) => {
    const { scale, y, rot } = computeCornerDance(timeMs);
    const set = (el: HTMLDivElement | null, baseRot: number, mirror: number) => {
      if (el) el.style.transform = `translate3d(0, ${y}px, 0) rotate(${baseRot + (rot * mirror)}deg) scale(${scale})`;
    };
    set(cornerTLRef.current, -15, 1); set(cornerTRRef.current, 15, -1);
    set(cornerBLRef.current, -10, 1); set(cornerBRRef.current, 10, -1);
  },[computeCornerDance]);

  const prepareSpriteSource = useCallback((img: HTMLImageElement): HTMLCanvasElement => {
    const offscreen = document.createElement('canvas'); offscreen.width = img.naturalWidth || img.width; offscreen.height = img.naturalHeight || img.height;
    const ctx = offscreen.getContext('2d', { alpha: true }); if (ctx) ctx.drawImage(img, 0, 0);
    return offscreen;
  },[]);

  const ensureBackgroundCache = useCallback(async () => {
    if (cachedBgCanvasRef.current) return; 
    if (!compositeCanvasRef.current) {
        const c = document.createElement('canvas'); c.width = VIDEO_WIDTH; c.height = VIDEO_HEIGHT; 
        compositeCanvasRef.current = c; compositeCtxRef.current = c.getContext('2d', { alpha: false });
    }
    const imgA = new Image(); imgA.crossOrigin = 'anonymous'; imgA.src = "/images/paper.webp";
    try {
        await imgA.decode();
        const offscreen = document.createElement('canvas'); offscreen.width = VIDEO_WIDTH; offscreen.height = VIDEO_HEIGHT;
        const ctx = offscreen.getContext('2d', { alpha: false });
        if (ctx) {
            if (imgA.naturalWidth > 0) {
                const scale = Math.max(VIDEO_WIDTH / imgA.naturalWidth, VIDEO_HEIGHT / imgA.naturalHeight);
                ctx.drawImage(imgA, (VIDEO_WIDTH - imgA.naturalWidth * scale) / 2, (VIDEO_HEIGHT - imgA.naturalHeight * scale) / 2, imgA.naturalWidth * scale, imgA.naturalHeight * scale);
                ctx.globalCompositeOperation = 'multiply'; ctx.fillStyle = '#f0f0f0'; ctx.fillRect(0, 0, VIDEO_WIDTH, VIDEO_HEIGHT);
            } else { ctx.fillStyle = '#e5e5e5'; ctx.fillRect(0, 0, VIDEO_WIDTH, VIDEO_HEIGHT); }
            cachedBgCanvasRef.current = offscreen;
        }
    } catch (e) { console.warn("Background cache error", e); }
  },[]);

  useEffect(() => {
    isMountedRef.current = true; resetCornerTransform();
    (document as Document & { fonts?: { ready?: Promise<void> } }).fonts?.ready?.catch?.(() => {});
    return () => { isMountedRef.current = false; clearGenErrorTimers(); };
  },[resetCornerTransform, clearGenErrorTimers]);

  const cancelRafIfAny = useCallback(() => { if (requestRef.current !== undefined) { cancelAnimationFrame(requestRef.current); requestRef.current = undefined; } },[]);
  const waitNextAnimationFrame = useCallback((): Promise<void> => new Promise((r) => requestAnimationFrame(() => r())),[]);

  const performAudioLock = useCallback(() => {
    if (!audioRef.current) return;
    const audioMs = audioRef.current.currentTime * 1000; const perfMs = performance.now();
    syncRef.current.startTime = perfMs - audioMs; syncRef.current.visualOffset = 0;
    syncRef.current.isLocked = true; syncRef.current.driftSamples =[]; syncRef.current.lastAudioTime = audioMs;
  }, [audioRef]);

  const renderCompositeFrame = useCallback((timeMs: number, opts?: { forceIntro?: boolean; introTextOverride?: string; gameStateOverride?: Partial<GameState> | null }) => {
    const ctx = compositeCtxRef.current; const composite = compositeCanvasRef.current; const gameCanvas = canvasRef.current;
    if (!ctx || !composite || !gameCanvas) return;
    const W = composite.width; const H = composite.height;
    
    if (cachedBgCanvasRef.current) ctx.drawImage(cachedBgCanvasRef.current, 0, 0);
    else { ctx.fillStyle = '#e5e5e5'; ctx.fillRect(0, 0, W, H); }

    const safePad = Math.round(H * 0.05); const maxGameW = W - (safePad * 2); const maxGameH = H - (safePad * 2);
    let gameW = gameCanvas.width; let gameH = gameCanvas.height; 
    const scaleFactor = Math.min(maxGameW / gameW, maxGameH / gameH) * 0.9;
    gameW *= scaleFactor; gameH *= scaleFactor;
    const gameX = (W - gameW) / 2; const gameY = (H - gameH) / 2;
    ctx.drawImage(gameCanvas, gameX, gameY, gameW, gameH);

    const currentState = opts?.gameStateOverride;
    if (currentState && currentState.showCellLabels && currentState.cellLabelsAlpha && currentState.cellLabelsAlpha > 0) {
      const pattern = currentState.currentPattern;
      if (Array.isArray(pattern) && pattern.length > 0) {
        ctx.save(); ctx.translate(gameX, gameY);
        const cellW = gameW / 4; const cellH = gameH / 2; ctx.globalAlpha = currentState.cellLabelsAlpha;
        const fontSize = Math.round(cellH * 0.14); ctx.font = `900 ${fontSize}px 'Montserrat', sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        
        pattern.forEach((q, i) => {
          const safeQ = Number.isFinite(q) ? Math.max(0, Math.min(3, q)) : 0; const label = normalizedWords[safeQ]?.toUpperCase() ?? '';
          if (!label) return;
          const col = i % 4; const row = Math.floor(i / 4);
          const x = col * cellW + cellW / 2; const y = row * cellH + (cellH - (cellH * 0.12)); 
          const cacheKey = `${label}-${fontSize}`;
          let textWidth = textMetricsCache.get(cacheKey);
          if (textWidth === undefined) { textWidth = ctx.measureText(label).width; textMetricsCache.set(cacheKey, textWidth); }
          const bgW = textWidth + 32; const bgH = (cellH * 0.14) + 16; 
          ctx.fillStyle = 'rgba(255, 255, 255, 0.9)'; ctx.lineWidth = 3; ctx.strokeStyle = 'black';
          ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(x - bgW/2, y - bgH/2, bgW, bgH, 8); else ctx.rect(x - bgW/2, y - bgH/2, bgW, bgH);
          ctx.fill(); ctx.stroke(); ctx.fillStyle = 'black'; ctx.fillText(label, x, y);
        });
        ctx.restore();
      }
    }

    const { scale, y, rot } = computeCornerDance(timeMs);
    const fontPx = Math.round(H * 0.12); const margin = Math.round(H * 0.04);
    const drawEmoji = (char: string, x: number, yBase: number, baseRot: number, mirror: number) => {
      ctx.save(); ctx.translate(x, yBase + y); ctx.rotate((baseRot + (rot * mirror)) * Math.PI / 180);
      ctx.scale(scale, scale); ctx.font = `${fontPx}px serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(char, 0, 0); ctx.restore();
    };
    drawEmoji('🎉', margin + 50, margin + 50, -15, 1); drawEmoji('🎁', W - margin - 50, margin + 50, 15, -1);
    drawEmoji('😎', margin + 50, H - margin - 50, -10, 1); drawEmoji('🐸', W - margin - 50, H - margin - 50, 10, -1);

    ctx.save();
    const markFontSize = Math.round(H * 0.035); ctx.font = `900 ${markFontSize}px 'Montserrat', sans-serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'bottom'; ctx.shadowColor = 'rgba(0,0,0,1)'; ctx.shadowBlur = 0; ctx.shadowOffsetX = 3; ctx.shadowOffsetY = 3;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.95)'; ctx.fillText("BEAT.BOTON.ONE", W / 2, H - Math.round(H * 0.04));
    ctx.restore();

    const activeIntro = opts?.forceIntro ?? uiState.isInIntro;
    const activeState = opts?.gameStateOverride || (uiState.appState === AppState.PLAYING ? engineStateRef.current : null);

    if (!activeIntro && activeState && activeState.roundNumber) {
        ctx.save();
        const hudScale = H / 1080; const safeRound = Math.min(5, Math.max(1, Math.floor(activeState.roundNumber)));
        const labelText = canvasLabelsRef.current.roundLabel; const valText = safeRound.toString(); const totalText = "/5";
        const labelFont = `900 ${Math.round(18 * hudScale)}px 'Montserrat', sans-serif`; const valFont = `900 ${Math.round(42 * hudScale)}px 'Montserrat', sans-serif`; const totalFont = `900 ${Math.round(28 * hudScale)}px 'Montserrat', sans-serif`;
        ctx.font = labelFont; const labelM = ctx.measureText(labelText); ctx.font = valFont; const valM = ctx.measureText(valText); ctx.font = totalFont; const totalM = ctx.measureText(totalText);
        const gap1 = 12 * hudScale; const gap2 = 4 * hudScale; const padX = 24 * hudScale; const padY = 12 * hudScale;
        const badgeW = padX + labelM.width + gap1 + valM.width + gap2 + totalM.width + padX;
        const badgeH = Math.max(labelM.actualBoundingBoxAscent + labelM.actualBoundingBoxDescent, valM.actualBoundingBoxAscent + valM.actualBoundingBoxDescent) + (padY * 2);
        const badgeX = (W - badgeW) / 2; const badgeY = Math.max(20, H * 0.05);
        ctx.fillStyle = 'rgba(0,0,0,1)'; ctx.beginPath(); if(ctx.roundRect) ctx.roundRect(badgeX + 4, badgeY + 4, badgeW, badgeH, 16 * hudScale); else ctx.rect(badgeX + 4, badgeY + 4, badgeW, badgeH); ctx.fill();
        ctx.fillStyle = '#ffffff'; ctx.strokeStyle = '#000000'; ctx.lineWidth = 3; ctx.beginPath(); if(ctx.roundRect) ctx.roundRect(badgeX, badgeY, badgeW, badgeH, 16 * hudScale); else ctx.rect(badgeX, badgeY, badgeW, badgeH); ctx.fill(); ctx.stroke();
        let cursorX = badgeX + padX; const centerY = badgeY + (badgeH / 2);
        ctx.font = labelFont; ctx.fillStyle = '#6b7280'; ctx.fillText(labelText, cursorX, centerY); cursorX += labelM.width + gap1;
        ctx.font = valFont; const gradient = ctx.createLinearGradient(cursorX, centerY - 20, cursorX + valM.width, centerY + 20); gradient.addColorStop(0, '#7c3aed'); gradient.addColorStop(1, '#3b82f6');
        ctx.fillStyle = gradient; ctx.fillText(valText, cursorX, centerY + 2); cursorX += valM.width + gap2;
        ctx.font = totalFont; ctx.fillStyle = '#9ca3af'; ctx.fillText(totalText, cursorX, centerY + 2);
        ctx.restore();
    }

    if (uiState.appState === AppState.PLAYING && activeIntro) {
      const textToShow = (opts?.introTextOverride ?? uiState.introText) || "";
      ctx.save();
      const frameT = timeMs / 1000;
      const introScale = 1 + Math.sin(frameT * 10) * 0.05;
      ctx.translate(W / 2, H / 2); ctx.scale(introScale, introScale);
      const bigFont = Math.round(H * 0.3); ctx.font = `900 ${bigFont}px 'Montserrat', sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillStyle = 'rgba(0,0,0,0.2)'; ctx.fillText(textToShow, 20, 20); ctx.fillStyle = 'black'; ctx.fillText(textToShow, 0, 0);
      ctx.restore();
    }
  },[uiState.appState, uiState.isInIntro, uiState.introText, computeCornerDance, normalizedWords, canvasLabelsRef]);

  const tryStartRecordingWithTrim = useCallback(async function loop() {
    if (recFlow.recordingStartedRef.current) return;
    const a = audioRef.current; const recorder = recFlow.recordingServiceRef.current; const args = recFlow.pendingRecordingArgsRef.current;
    if (!a || !recorder || !args) return;
    const audioMs = a.currentTime * 1000;
    if (audioMs < RECORDING_TRIM_START_MS) { requestAnimationFrame(() => void loop()); return; }

    recFlow.recordingStartedRef.current = true; recFlow.isRecordingActiveRef.current = true;
    const now = performance.now(); const visualRawTime = now - syncRef.current.startTime + syncRef.current.visualOffset;
    const warmupTimeMs = Math.max(0, visualRawTime) + RECORDING_VIDEO_LAG_MS;

    renderCompositeFrame(warmupTimeMs, { forceIntro: true, introTextOverride: getReadyText }); await waitNextAnimationFrame();
    renderCompositeFrame(warmupTimeMs, { forceIntro: true, introTextOverride: getReadyText }); await waitNextAnimationFrame();

    await recorder.startRecording(args);
    setRecStatus({ isRecording: true });
  },[getReadyText, renderCompositeFrame, waitNextAnimationFrame, audioRef, recFlow, setRecStatus]);

  const handleReset = useCallback(() => {
    cancelRafIfAny(); recFlow.resetRecordingState();
    const a = audioRef.current;
    if (a) { a.pause(); a.currentTime = 0; a.removeEventListener("playing", performAudioLock); }
    generationTokenRef.current += 1;
    
    setUiState({
      appState: AppState.IDLE, uiRoundInfo: { round: 1, beat: 0, totalBeats: 40 }, uiOverlayState: { show: false, alpha: 0, pattern:[] },
      isInIntro: false, introText: "", isGeminiGenerating: false, isMobileVertical: false, showGenError: false, genErrorClosing: false
    });
    layoutAnim.current = 0; startTimeRef.current = null; timelineRef.current = null; rendererRef.current = null; spritesheetRef.current = null;
    sessionSeedRef.current = null; engineStateRef.current = undefined; resetCornerTransform();
  },[cancelRafIfAny, resetCornerTransform, performAudioLock, audioRef, recFlow]);

  const loadImage = useCallback(async (url: string): Promise<HTMLImageElement> => {
    const img = new Image(); img.crossOrigin = 'anonymous'; img.src = url;
    try { await img.decode(); return img; } catch { return new Promise((res, rej) => { img.onload = () => res(img); img.onerror = () => rej(new Error('Failed to load.')); }); }
  },[]);

  const handleNextPreset = useCallback(() => {
    if (uiState.appState !== AppState.IDLE) return;
    const currentIndex = PRESETS.findIndex(p => wordsKey(p.words) === wordsKey(words));
    setWords([...PRESETS[(currentIndex + 1) % PRESETS.length].words]);
  },[words, uiState.appState]);

  const handlePrevPreset = useCallback(() => {
    if (uiState.appState !== AppState.IDLE) return;
    const currentIndex = PRESETS.findIndex(p => wordsKey(p.words) === wordsKey(words));
    setWords([...PRESETS[currentIndex === -1 ? PRESETS.length - 1 : (currentIndex - 1 + PRESETS.length) % PRESETS.length].words]);
  },[words, uiState.appState]);

  const handleShareVideo = useCallback(async () => {
    if (!recStatus.recordedBlob) return;
    const rawMime = (recStatus.mimeType || 'video/webm').toLowerCase();
    const isMp4 = rawMime.includes('mp4'); const extension = isMp4 ? 'mp4' : 'webm';
    const file = new File([recStatus.recordedBlob], `BeatGrid_Gameplay.${extension}`, { type: isMp4 ? 'video/mp4' : 'video/webm', lastModified: Date.now() });
    try { const shareData = { files: [file], title: t('share.title'), text: t('share.text') }; if (navigator.canShare(shareData)) await navigator.share(shareData); } catch (err: unknown) { if (err instanceof Error && err.name !== 'AbortError') alert(t('errors.share.failed')); }
  },[recStatus, t]);

  const startGameSession = useCallback(async (currentWords: string[]) => {
    cancelRafIfAny(); await ensureBackgroundCache();
    const seed = Math.random().toString(36).substr(2, 9); sessionSeedRef.current = seed;
    timelineRef.current = createTimeline({ words: currentWords, bpm: DEFAULT_BPM, beatsPerRound: BEATS_PER_ROUND, seed });
    
    setUiState({ uiRoundInfo: { round: 1, beat: 0, totalBeats: timelineRef.current.totalBeats }, appState: AppState.PLAYING, isInIntro: true, showGenError: false, genErrorClosing: false });

    if (!rendererRef.current && canvasRef.current && spritesheetRef.current) {
        const { CanvasRenderer } = await import('../../lib/game/renderer');
        CanvasRendererClassRef.current = CanvasRenderer;
        rendererRef.current = new CanvasRenderer(canvasRef.current, spritesheetRef.current);
    }
    
    const now = performance.now(); startTimeRef.current = now; 
    syncRef.current = { startTime: now, visualOffset: 0, isLocked: false, driftSamples:[], lastAudioTime: 0, lastFrameTime: now };

    if (enableRecording && canvasRef.current) {
      try {
        const { CanvasRecordingService } = await import('../../services/recordingService');
        if (CanvasRecordingService.isSupported()) {
          recFlow.recordingServiceRef.current = new CanvasRecordingService();
          let audioTrack: MediaStreamTrack | undefined;
          const destNode = setupAudioGraph(); 
          if (destNode && destNode.stream.getAudioTracks().length > 0) audioTrack = destNode.stream.getAudioTracks()[0];
          else if (audioRef.current) { try { const a = audioRef.current as HTMLAudioElement & { captureStream?: () => MediaStream; mozCaptureStream?: () => MediaStream; }; const s = a.captureStream ? a.captureStream() : a.mozCaptureStream?.(); if (s) audioTrack = s.getAudioTracks()[0]; } catch { /* ignore */ } }
          
          recFlow.recordingStartedRef.current = false; recFlow.recordingStoppedRef.current = false;
          recFlow.pendingRecordingArgsRef.current = { canvas: compositeCanvasRef.current || canvasRef.current, audioTrack, videoBitsPerSecond: 2_500_000 };
          recFlow.isRecordingActiveRef.current = false;
          setRecStatus({ isRecording: true });
        }
      } catch (error: unknown) {
        recFlow.isRecordingActiveRef.current = false; setRecStatus({ isRecording: false, error: `Error grabación: ${error instanceof Error ? error.message : String(error)}` });
      }
    } else { recFlow.isRecordingActiveRef.current = false; setRecStatus({ isRecording: false }); }

    if (audioRef.current) {
      const a = audioRef.current; a.currentTime = 0; a.volume = 1.0; a.muted = false;
      a.removeEventListener("playing", performAudioLock); a.addEventListener("playing", performAudioLock, { once: true });
      if (audioContextRef.current?.state === 'suspended') audioContextRef.current.resume();
      a.play().then(() => void tryStartRecordingWithTrim()).catch(() => { syncRef.current.isLocked = false; });
    }
  },[cancelRafIfAny, enableRecording, performAudioLock, setupAudioGraph, ensureBackgroundCache, tryStartRecordingWithTrim, audioRef, audioContextRef, recFlow, setRecStatus]);

  const handleRestartCurrentSession = useCallback(async () => {
    cancelRafIfAny(); await ensureBackgroundCache();
    if (!spritesheetRef.current || !canvasRef.current) { handleReset(); return; }
    recFlow.resetRecordingState();
    if (audioRef.current) { audioRef.current.pause(); audioRef.current.currentTime = 0; audioRef.current.removeEventListener("playing", performAudioLock); }
    
    const seed = sessionSeedRef.current ?? Math.random().toString(36).substr(2, 9); sessionSeedRef.current = seed;
    timelineRef.current = createTimeline({ words, bpm: DEFAULT_BPM, beatsPerRound: BEATS_PER_ROUND, seed }); engineStateRef.current = undefined; 
    setUiState({ uiRoundInfo: { round: 1, beat: 0, totalBeats: timelineRef.current.totalBeats }, appState: AppState.PLAYING, isInIntro: true, introText: "", showGenError: false, genErrorClosing: false });
    const now = performance.now(); startTimeRef.current = now; syncRef.current = { startTime: now, visualOffset: 0, isLocked: false, driftSamples:[], lastAudioTime: 0, lastFrameTime: now };

    if (enableRecording) {
      try {
        const { CanvasRecordingService } = await import('../../services/recordingService');
        if (CanvasRecordingService.isSupported()) {
          recFlow.recordingServiceRef.current = new CanvasRecordingService();
          let audioTrack: MediaStreamTrack | undefined;
          const destNode = setupAudioGraph(); 
          if (destNode && destNode.stream.getAudioTracks().length > 0) audioTrack = destNode.stream.getAudioTracks()[0];
          else if (audioRef.current) { try { const a = audioRef.current as HTMLAudioElement & { captureStream?: () => MediaStream; mozCaptureStream?: () => MediaStream; }; const s = a.captureStream ? a.captureStream() : a.mozCaptureStream?.(); if (s) audioTrack = s.getAudioTracks()[0]; } catch { /* ignore */ } }
          recFlow.pendingRecordingArgsRef.current = { canvas: compositeCanvasRef.current || canvasRef.current, audioTrack, videoBitsPerSecond: 2_500_000 };
          setRecStatus({ isRecording: true });
        }
      } catch (error: unknown) { setRecStatus({ isRecording: false, error: error instanceof Error ? error.message : String(error) }); }
    }

    if (audioRef.current) {
      const a = audioRef.current; a.currentTime = 0; a.muted = false;
      a.removeEventListener("playing", performAudioLock); a.addEventListener("playing", performAudioLock, { once: true });
      if (audioContextRef.current?.state === 'suspended') audioContextRef.current.resume();
      a.play().then(() => void tryStartRecordingWithTrim()).catch(() => {});
    }
  },[cancelRafIfAny, handleReset, words, enableRecording, performAudioLock, setupAudioGraph, ensureBackgroundCache, tryStartRecordingWithTrim, audioRef, audioContextRef, recFlow, setRecStatus]);

  const handleGenerate = useCallback(async () => {
    if (uiState.appState === AppState.GENERATING) return;
    const myToken = (generationTokenRef.current += 1); const preset = findPreset(words); const willUseGemini = !preset;
    clearGenErrorTimers(); setUiState({ isGeminiGenerating: willUseGemini, appState: AppState.GENERATING, showGenError: false, genErrorClosing: false });
    setRecStatus({ isRecording: false }); if (audioRef.current) setupAudioGraph();

    try {
      let url: string;
      if (preset) url = preset.spritesheetUrl;
      else { const { generateGameSpritesheet } = await import('../../services/geminiService'); url = await generateGameSpritesheet(words); }
      
      if (!isMountedRef.current || myToken !== generationTokenRef.current) return;
      const img = await loadImage(url);
      if (!isMountedRef.current || myToken !== generationTokenRef.current) return;
      
      const optimizedSprite = prepareSpriteSource(img); spritesheetRef.current = optimizedSprite;
      
      if (canvasRef.current) {
        if (!rendererRef.current) {
             const { CanvasRenderer } = await import('../../lib/game/renderer');
             CanvasRendererClassRef.current = CanvasRenderer; rendererRef.current = new CanvasRenderer(canvasRef.current, optimizedSprite);
        } else {
            const RendererClass = CanvasRendererClassRef.current || (await import('../../lib/game/renderer')).CanvasRenderer;
            CanvasRendererClassRef.current = RendererClass; rendererRef.current = new RendererClass(canvasRef.current, optimizedSprite);
        }
      }
      startGameSession(words);
    } catch {
      if (isMountedRef.current && myToken === generationTokenRef.current) { setUiState({ appState: AppState.IDLE }); if (willUseGemini) openGenError(); }
    } finally {
      if (isMountedRef.current && myToken === generationTokenRef.current) setUiState({ isGeminiGenerating: false });
    }
  },[uiState.appState, words, loadImage, startGameSession, prepareSpriteSource, openGenError, setupAudioGraph, clearGenErrorTimers, audioRef, setRecStatus]);

  const projectToViewCanvas = useCallback((progress: number) => {
    const src = canvasRef.current; const dst = viewCanvasRef.current; const container = canvasContainerRef.current;
    if (!src || !dst) return; const dstCtx = dst.getContext('2d', { alpha: true }); if (!dstCtx) return;
    const currentW = BASE_W + (VERTICAL_W - BASE_W) * progress; const currentH = BASE_H + (VERTICAL_H - BASE_H) * progress;
    if (dst.width !== Math.round(currentW) || dst.height !== Math.round(currentH)) { dst.width = Math.round(currentW); dst.height = Math.round(currentH); } else dstCtx.clearRect(0, 0, dst.width, dst.height);
    lastLayoutProgressRef.current = progress;
    if (container) container.style.aspectRatio = (currentW / currentH).toString();
    const srcCellW = src.width / 4; const srcCellH = src.height / 2;
    for (let i = 0; i < 8; i++) {
        const sx = (i % 4) * srcCellW; const sy = Math.floor(i / 4) * srcCellH;
        const startX = (i % 4) * srcCellW; const startY = Math.floor(i / 4) * srcCellH;
        const endX = ((VERTICAL_W - 800) / 2) + ((i % 2) * 400); const endY = Math.floor(i / 2) * 400;
        dstCtx.drawImage(src, sx, sy, srcCellW, srcCellH, startX + (endX - startX) * progress, startY + (endY - startY) * progress, srcCellW + (400 - srcCellW) * progress, srcCellH + (400 - srcCellH) * progress);
    }
  },[]);

  const animate = useCallback(function loop() {
    if (uiState.appState !== AppState.PLAYING || !timelineRef.current || !canvasRef.current || !spritesheetRef.current) return;
    const targetLayout = uiState.isMobileVertical ? 1 : 0; const diff = targetLayout - layoutAnim.current;
    if (Math.abs(diff) > 0.001) layoutAnim.current += diff * 0.1; else layoutAnim.current = targetLayout;

    const now = performance.now(); const deltaTime = now - syncRef.current.lastFrameTime; syncRef.current.lastFrameTime = now;
    let visualRawTime = (now - syncRef.current.startTime) + syncRef.current.visualOffset;

    if (audioRef.current && !audioRef.current.paused && syncRef.current.isLocked) {
        const audioTimeMs = audioRef.current.currentTime * 1000;
        if (audioTimeMs > 200) {
            if (Math.abs(audioTimeMs - syncRef.current.lastAudioTime) > SYNC_AUDIO_EPSILON_MS) {
                syncRef.current.driftSamples.push(audioTimeMs - visualRawTime);
                if (syncRef.current.driftSamples.length > SYNC_SAMPLE_SIZE) syncRef.current.driftSamples.shift();
                syncRef.current.lastAudioTime = audioTimeMs;
            }
            const avgDrift = syncRef.current.driftSamples.length > 0 ? syncRef.current.driftSamples.reduce((a, b) => a + b, 0) / syncRef.current.driftSamples.length : 0;
            if (Math.abs(avgDrift) > SYNC_THRESHOLD_IGNORE_MS) {
                if (Math.abs(avgDrift) < SYNC_THRESHOLD_SOFT_MS) syncRef.current.visualOffset += Math.max(-10 * (deltaTime / 16.6), Math.min(10 * (deltaTime / 16.6), avgDrift * SYNC_NUDGE_FACTOR * (deltaTime / 16.6)));
                else { syncRef.current.startTime = now - audioTimeMs; syncRef.current.visualOffset = 0; syncRef.current.driftSamples =[]; }
            }
        }
        visualRawTime = (now - syncRef.current.startTime) + syncRef.current.visualOffset;
    } else if (!audioRef.current && startTimeRef.current) visualRawTime = now - startTimeRef.current;

    const visualTimeMs = Math.max(0, visualRawTime + GLOBAL_AUDIO_LATENCY_MS); const recordingBaseTimeMs = Math.max(0, visualRawTime);
    const offsetMs = SONG_OFFSET_SEC * 1000; applyCornerDance(visualTimeMs);
    
    if (!rendererRef.current && CanvasRendererClassRef.current) rendererRef.current = new CanvasRendererClassRef.current(canvasRef.current, spritesheetRef.current);
    if (!rendererRef.current) return;

    if (recFlow.isRecordingActiveRef.current) {
        const recordingTimeMs = recordingBaseTimeMs + RECORDING_VIDEO_LAG_MS;
        if (recordingTimeMs < offsetMs) {
            const timeRemaining = offsetMs - recordingTimeMs; const alpha = timeRemaining <= CELL_LABEL_DURATION_MS ? (CELL_LABEL_FADE_IN_MS > 0 ? Math.min(1, Math.max(0, (CELL_LABEL_DURATION_MS - timeRemaining) / CELL_LABEL_FADE_IN_MS)) : 1) : 0;
            rendererRef.current.render(canvasRef.current.width, canvasRef.current.height, timelineRef.current.rounds[0].pattern, timelineRef.current.rounds[0].pattern, 0, 0, -1);
            renderCompositeFrame(recordingTimeMs, { forceIntro: true, introTextOverride: Math.ceil((timeRemaining / 1000) / (60 / DEFAULT_BPM)) > 4 ? getReadyText : Math.ceil((timeRemaining / 1000) / (60 / DEFAULT_BPM)).toString(), gameStateOverride: timeRemaining <= CELL_LABEL_DURATION_MS ? { currentPattern: timelineRef.current.rounds[0].pattern, showCellLabels: true, cellLabelsAlpha: alpha, roundNumber: 1 } : null });
        } else {
            const recStateLoc = getGameStateAtTime(recordingTimeMs - offsetMs, timelineRef.current);
            rendererRef.current.render(canvasRef.current.width, canvasRef.current.height, recStateLoc.currentPattern, recStateLoc.prevPattern, recStateLoc.interpolation, (recordingTimeMs % timelineRef.current.msPerBeat) / timelineRef.current.msPerBeat, recStateLoc.activeCellIndex);
            renderCompositeFrame(recordingTimeMs, { gameStateOverride: recStateLoc });
        }
    }

    if (visualTimeMs < offsetMs) {
      const timeRemaining = offsetMs - visualTimeMs;
      setUiState((prev) => {
        const changes: Partial<UiState> = {};
        if (!prev.isInIntro) changes.isInIntro = true;
        const nt = Math.ceil((timeRemaining / 1000) / (60 / DEFAULT_BPM)) > 4 ? getReadyText : Math.ceil((timeRemaining / 1000) / (60 / DEFAULT_BPM)).toString();
        if (nt !== prev.introText) changes.introText = nt;
        if (timeRemaining <= CELL_LABEL_DURATION_MS) {
          const alpha = CELL_LABEL_FADE_IN_MS > 0 ? Math.min(1, Math.max(0, (CELL_LABEL_DURATION_MS - timeRemaining) / CELL_LABEL_FADE_IN_MS)) : 1;
          if (prev.uiOverlayState.alpha !== alpha || !prev.uiOverlayState.show) changes.uiOverlayState = { show: true, alpha, pattern: timelineRef.current!.rounds[0].pattern };
        } else if (prev.uiOverlayState.show) changes.uiOverlayState = { ...prev.uiOverlayState, show: false };
        return Object.keys(changes).length > 0 ? changes : null;
      });
      rendererRef.current.render(canvasRef.current.width, canvasRef.current.height, timelineRef.current.rounds[0].pattern, timelineRef.current.rounds[0].pattern, 0, 0, -1);
      projectToViewCanvas(layoutAnim.current); requestRef.current = requestAnimationFrame(loop); return;
    }

    const gameTimeMs = visualTimeMs - offsetMs;
    engineStateRef.current = getGameStateAtTime(gameTimeMs, timelineRef.current, engineStateRef.current);
    const state = engineStateRef.current;

    setUiState((prev) => {
      const changes: Partial<UiState> = {}; if (prev.isInIntro) changes.isInIntro = false;
      if (state.roundNumber !== prev.uiRoundInfo.round) changes.uiRoundInfo = { round: state.roundNumber, beat: 0, totalBeats: timelineRef.current!.totalBeats };
      if (state.showCellLabels !== prev.uiOverlayState.show || Math.abs(state.cellLabelsAlpha - prev.uiOverlayState.alpha) > 0.05) changes.uiOverlayState = { show: state.showCellLabels, alpha: state.cellLabelsAlpha, pattern: state.currentPattern };
      return Object.keys(changes).length > 0 ? changes : null;
    });

    if (recFlow.isRecordingActiveRef.current && recFlow.recordingStartedRef.current && !recFlow.recordingStoppedRef.current && timelineRef.current) {
      if (gameTimeMs >= Math.max(0, timelineRef.current.totalBeats * timelineRef.current.msPerBeat - RECORDING_TRIM_END_MS)) {
        recFlow.recordingStoppedRef.current = true;
        rendererRef.current.render(canvasRef.current.width, canvasRef.current.height, state.currentPattern, state.prevPattern, state.interpolation, 0, -1);
        renderCompositeFrame(recordingBaseTimeMs + RECORDING_VIDEO_LAG_MS, { gameStateOverride: state });
        const activeRecorder = recFlow.recordingServiceRef.current; recFlow.recordingServiceRef.current = null; recFlow.isRecordingActiveRef.current = false;
        if (activeRecorder) activeRecorder.stopRecording().then((r) => setRecStatus({ isRecording: false, recordedUrl: r.url, recordedBlob: r.blob, mimeType: r.mimeType })).catch(() => setRecStatus({ isRecording: false, error: 'Error guardando video.' }));
        else setRecStatus({ isRecording: false });
      }
    }

    if (state.isFinished) {
      cancelRafIfAny(); if (audioRef.current) { audioRef.current.pause(); audioRef.current.currentTime = 0; audioRef.current.removeEventListener("playing", performAudioLock); }
      if (recFlow.isRecordingActiveRef.current && !recFlow.recordingStoppedRef.current) {
          rendererRef.current.render(canvasRef.current.width, canvasRef.current.height, state.currentPattern, state.prevPattern, state.interpolation, 0, -1);
          renderCompositeFrame(recordingBaseTimeMs + RECORDING_VIDEO_LAG_MS, { gameStateOverride: state }); 
          const activeRecorder = recFlow.recordingServiceRef.current; recFlow.recordingServiceRef.current = null; recFlow.isRecordingActiveRef.current = false;
          if (activeRecorder) activeRecorder.stopRecording().then((r) => setRecStatus({ isRecording: false, recordedUrl: r.url, recordedBlob: r.blob, mimeType: r.mimeType })).catch(() => setRecStatus({ isRecording: false, error: 'Error guardando video.' }));
      } else if (!recFlow.recordingStoppedRef.current) setRecStatus({ isRecording: false });
      setUiState({ appState: AppState.FINISHED }); resetCornerTransform(); return;
    }

    rendererRef.current.render(canvasRef.current.width, canvasRef.current.height, state.currentPattern, state.prevPattern, state.interpolation, (gameTimeMs % timelineRef.current.msPerBeat) / timelineRef.current.msPerBeat, state.activeCellIndex);
    projectToViewCanvas(layoutAnim.current); requestRef.current = requestAnimationFrame(loop);
  },[uiState.appState, uiState.isMobileVertical, cancelRafIfAny, applyCornerDance, resetCornerTransform, renderCompositeFrame, getReadyText, performAudioLock, projectToViewCanvas, audioRef, recFlow, setRecStatus]);

  useEffect(() => {
    if (uiState.appState === AppState.PLAYING) requestRef.current = requestAnimationFrame(animate);
    return () => cancelRafIfAny();
  },[uiState.appState, animate, cancelRafIfAny]);

  return (
    <div className="h-svh min-h-svh w-full relative overflow-hidden bg-[#f0f0f0] box-border">
      <img src="/images/paper.webp" alt="" fetchPriority="high" decoding="async" className="absolute inset-0 w-full h-full object-cover mix-blend-multiply pointer-events-none z-0" style={{ backgroundColor: '#f0f0f0' }} />
      <audio ref={audioRef} src="/audio/game-track.opus" preload="auto" crossOrigin="anonymous" />
      
      {uiState.appState === AppState.PLAYING && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-100 md:hidden portrait:block landscape:hidden">
          <button type="button" onClick={() => setUiState({ isMobileVertical: !uiState.isMobileVertical })} aria-label={uiState.isMobileVertical ? "Switch to Horizontal View" : "Switch to Vertical View"} className="group flex items-center justify-center w-14 h-14 bg-white border-4 border-black rounded-full shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] active:translate-y-0.5 active:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all">
            <svg className={`w-7 h-7 text-black transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] ${uiState.isMobileVertical ? 'rotate-90' : 'rotate-0'}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="square" strokeLinejoin="miter"><path d="M21 12H3M3 12L8 17M3 12L8 7M21 12L16 17M21 12L16 7" /></svg>
          </button>
        </div>
      )}

      <MainMenu 
        show={uiState.appState === AppState.IDLE || uiState.appState === AppState.GENERATING}
        currentLocale={currentLocale} onLanguageChange={handleLanguageChange}
        showGenError={uiState.showGenError} genErrorClosing={uiState.genErrorClosing} onCloseGenError={closeGenError}
        isGenerating={uiState.appState === AppState.GENERATING} onPrevPreset={handlePrevPreset} onNextPreset={handleNextPreset}
        words={words} setWords={setWords} onGenerate={handleGenerate} isGeminiGenerating={uiState.isGeminiGenerating}
        enableRecording={enableRecording} setEnableRecording={setEnableRecording}
      />

      {uiState.appState === AppState.FINISHED && (
        <VideoResultPanel 
          showVideoSection={!!recStatus.recordedUrl || recStatus.isRecording || !!recStatus.error}
          recordedUrl={recStatus.recordedUrl} mimeType={recStatus.mimeType} canShareNative={canShareNative}
          onShareVideo={handleShareVideo} onRestartSession={handleRestartCurrentSession} onReset={handleReset}
        />
      )}

      <GameStage 
        show={uiState.appState === AppState.PLAYING || uiState.appState === AppState.FINISHED}
        isMobileVertical={uiState.isMobileVertical} isInIntro={uiState.isInIntro} introText={uiState.introText}
        round={uiState.uiRoundInfo.round} beat={uiState.uiRoundInfo.beat} totalBeats={uiState.uiRoundInfo.totalBeats} words={words}
        canvasContainerRef={canvasContainerRef} canvasRef={canvasRef} viewCanvasRef={viewCanvasRef}
        shouldRenderOverlay={uiState.appState === AppState.PLAYING && uiState.uiOverlayState.show && uiState.uiOverlayState.pattern.length > 0}
        overlayAlpha={uiState.uiOverlayState.alpha} overlayPattern={uiState.uiOverlayState.pattern} normalizedWords={normalizedWords}
        cornerRefs={{ tl: cornerTLRef, tr: cornerTRRef, bl: cornerBLRef, br: cornerBRRef }}
      />
    </div>
  );
};

export default GamePage;