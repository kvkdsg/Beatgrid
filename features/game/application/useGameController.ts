import { useCallback, useRef, useEffect } from 'react';
import { AppState } from '../model/game.types';
import type { AppState as AppStateType } from '../model/game.types';
import { createTimeline } from '../domain/engine/engine';
import { DEFAULT_BPM, BEATS_PER_ROUND } from '../model/game.constants';
import { findPreset } from '../model/presets';
import { useGameSession } from './useGameSession';
import { useRecordingFlow } from '../hooks/useRecordingFlow';

export type UiState = {
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

export const initialUiState: UiState = {
  appState: AppState.IDLE, isGeminiGenerating: false, isInIntro: false, introText: "",
  uiRoundInfo: { round: 1, beat: 0, totalBeats: 40 }, uiOverlayState: { show: false, alpha: 0, pattern:[] },
  isMobileVertical: false, showGenError: false, genErrorClosing: false,
};

interface GameControllerDeps {
  words: string[];
  uiState: UiState;
  setUiState: React.Dispatch<Partial<UiState> | ((prev: UiState) => Partial<UiState> | null)>;
  audioRef: React.RefObject<HTMLAudioElement | null>;
  audioContextRef: React.RefObject<AudioContext | null>;
  setupAudioGraph: () => MediaStreamAudioDestinationNode | null;
  recFlow: ReturnType<typeof useRecordingFlow>;
  sessionRefs: ReturnType<typeof useGameSession>;
  ensureBackgroundCache: () => Promise<void>;
  loadImage: (url: string) => Promise<HTMLImageElement>;
  prepareSpriteSource: (img: HTMLImageElement) => HTMLCanvasElement;
  tryStartRecordingWithTrim: () => Promise<void>;
  performAudioLock: () => void;
  cancelRafIfAny: () => void;
  resetCornerTransform: () => void;
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  compositeCanvasRef: React.RefObject<HTMLCanvasElement | null>;
  startTimeRef: React.MutableRefObject<number | null>;
  syncRef: React.MutableRefObject<{
    startTime: number;
    visualOffset: number;
    isLocked: boolean;
    driftSamples: number[];
    lastAudioTime: number;
    lastFrameTime: number;
  }>;
  layoutAnimRef: React.MutableRefObject<number>;
}

export function useGameController({
  words,
  uiState,
  setUiState,
  audioRef,
  audioContextRef,
  setupAudioGraph,
  recFlow: {
    enableRecording, setStatus: setRecStatus, resetRecordingState,
    recordingServiceRef, pendingRecordingArgsRef, isRecordingActiveRef,
    recordingStartedRef, recordingStoppedRef
  },
  sessionRefs: {
    timelineRef, sessionSeedRef, engineStateRef, spritesheetRef,
    rendererRef, CanvasRendererClassRef
  },
  ensureBackgroundCache,
  loadImage,
  prepareSpriteSource,
  tryStartRecordingWithTrim,
  performAudioLock,
  cancelRafIfAny,
  resetCornerTransform,
  canvasRef,
  compositeCanvasRef,
  startTimeRef,
  syncRef,
  layoutAnimRef
}: GameControllerDeps) {
  const isMountedRef = useRef(true);
  const generationTokenRef = useRef(0);
  const genErrorAutoCloseTimerRef = useRef<number | null>(null);
  const genErrorFadeTimerRef = useRef<number | null>(null);

  const clearGenErrorTimers = useCallback(() => {
    if (genErrorAutoCloseTimerRef.current) clearTimeout(genErrorAutoCloseTimerRef.current);
    if (genErrorFadeTimerRef.current) clearTimeout(genErrorFadeTimerRef.current);
  },[]);

  useEffect(() => {
    isMountedRef.current = true;
    return () => { 
      isMountedRef.current = false; 
      clearGenErrorTimers(); 
    };
  }, [clearGenErrorTimers]);

  const closeGenError = useCallback(() => {
    setUiState({ genErrorClosing: true });
    genErrorFadeTimerRef.current = window.setTimeout(() => setUiState({ showGenError: false, genErrorClosing: false }), 300);
  }, [setUiState]);

  const openGenError = useCallback(() => {
    clearGenErrorTimers(); 
    setUiState({ showGenError: true, genErrorClosing: false });
    genErrorAutoCloseTimerRef.current = window.setTimeout(() => closeGenError(), 5000);
  }, [clearGenErrorTimers, closeGenError, setUiState]);

  const handleReset = useCallback(() => {
    cancelRafIfAny(); 
    resetRecordingState();
    const a = audioRef.current;
    if (a) { a.pause(); a.currentTime = 0; a.removeEventListener("playing", performAudioLock); }
    generationTokenRef.current += 1;
    
    setUiState({
      appState: AppState.IDLE, uiRoundInfo: { round: 1, beat: 0, totalBeats: 40 }, uiOverlayState: { show: false, alpha: 0, pattern:[] },
      isInIntro: false, introText: "", isGeminiGenerating: false, isMobileVertical: false, showGenError: false, genErrorClosing: false
    });
    
    layoutAnimRef.current = 0; 
    startTimeRef.current = null; 
    timelineRef.current = null; 
    rendererRef.current = null; 
    spritesheetRef.current = null;
    sessionSeedRef.current = null; 
    engineStateRef.current = undefined; 
    resetCornerTransform();
  },[cancelRafIfAny, resetRecordingState, audioRef, performAudioLock, setUiState, layoutAnimRef, startTimeRef, timelineRef, rendererRef, spritesheetRef, sessionSeedRef, engineStateRef, resetCornerTransform]);

  const startGameSession = useCallback(async (currentWords: string[]) => {
    cancelRafIfAny(); await ensureBackgroundCache();
    const seed = Math.random().toString(36).substr(2, 9); 
    sessionSeedRef.current = seed;
    timelineRef.current = createTimeline({ words: currentWords, bpm: DEFAULT_BPM, beatsPerRound: BEATS_PER_ROUND, seed });
    
    setUiState({ uiRoundInfo: { round: 1, beat: 0, totalBeats: timelineRef.current.totalBeats }, appState: AppState.PLAYING, isInIntro: true, showGenError: false, genErrorClosing: false });

    if (!rendererRef.current && canvasRef.current && spritesheetRef.current) {
        const { CanvasRenderer } = await import('../rendering/renderer');
        CanvasRendererClassRef.current = CanvasRenderer;
        rendererRef.current = new CanvasRenderer(canvasRef.current, spritesheetRef.current);
    }
    
    const now = performance.now(); startTimeRef.current = now; 
    syncRef.current = { startTime: now, visualOffset: 0, isLocked: false, driftSamples:[], lastAudioTime: 0, lastFrameTime: now };

    if (enableRecording && canvasRef.current) {
      try {
        const { CanvasRecordingService } = await import('../recording/recordingService');
        if (CanvasRecordingService.isSupported()) {
          recordingServiceRef.current = new CanvasRecordingService();
          let audioTrack: MediaStreamTrack | undefined;
          const destNode = setupAudioGraph(); 
          if (destNode && destNode.stream.getAudioTracks().length > 0) audioTrack = destNode.stream.getAudioTracks()[0];
          else if (audioRef.current) { try { const a = audioRef.current as HTMLAudioElement & { captureStream?: () => MediaStream; mozCaptureStream?: () => MediaStream; }; const s = a.captureStream ? a.captureStream() : a.mozCaptureStream?.(); if (s) audioTrack = s.getAudioTracks()[0]; } catch { /* ignore */ } }
          
          recordingStartedRef.current = false; recordingStoppedRef.current = false;
          pendingRecordingArgsRef.current = { canvas: compositeCanvasRef.current || canvasRef.current, audioTrack, videoBitsPerSecond: 2_500_000 };
          isRecordingActiveRef.current = false;
          setRecStatus({ isRecording: true });
        }
      } catch (error: unknown) {
        isRecordingActiveRef.current = false; setRecStatus({ isRecording: false, error: `Error grabación: ${error instanceof Error ? error.message : String(error)}` });
      }
    } else { isRecordingActiveRef.current = false; setRecStatus({ isRecording: false }); }

    if (audioRef.current) {
      const a = audioRef.current; a.currentTime = 0; a.volume = 1.0; a.muted = false;
      a.removeEventListener("playing", performAudioLock); a.addEventListener("playing", performAudioLock, { once: true });
      if (audioContextRef.current?.state === 'suspended') audioContextRef.current.resume();
      a.play().then(() => void tryStartRecordingWithTrim()).catch(() => { syncRef.current.isLocked = false; });
    }
  },[cancelRafIfAny, ensureBackgroundCache, sessionSeedRef, timelineRef, setUiState, rendererRef, canvasRef, spritesheetRef, CanvasRendererClassRef, startTimeRef, syncRef, enableRecording, recordingServiceRef, setupAudioGraph, audioRef, recordingStartedRef, recordingStoppedRef, pendingRecordingArgsRef, compositeCanvasRef, isRecordingActiveRef, setRecStatus, performAudioLock, audioContextRef, tryStartRecordingWithTrim]);

  const handleRestartCurrentSession = useCallback(async () => {
    cancelRafIfAny(); await ensureBackgroundCache();
    if (!spritesheetRef.current || !canvasRef.current) { handleReset(); return; }
    resetRecordingState();
    if (audioRef.current) { audioRef.current.pause(); audioRef.current.currentTime = 0; audioRef.current.removeEventListener("playing", performAudioLock); }
    
    const seed = sessionSeedRef.current ?? Math.random().toString(36).substr(2, 9); sessionSeedRef.current = seed;
    timelineRef.current = createTimeline({ words: words, bpm: DEFAULT_BPM, beatsPerRound: BEATS_PER_ROUND, seed }); 
    engineStateRef.current = undefined; 
    setUiState({ uiRoundInfo: { round: 1, beat: 0, totalBeats: timelineRef.current.totalBeats }, appState: AppState.PLAYING, isInIntro: true, introText: "", showGenError: false, genErrorClosing: false });
    const now = performance.now(); startTimeRef.current = now; syncRef.current = { startTime: now, visualOffset: 0, isLocked: false, driftSamples:[], lastAudioTime: 0, lastFrameTime: now };

    if (enableRecording) {
      try {
        const { CanvasRecordingService } = await import('../recording/recordingService');
        if (CanvasRecordingService.isSupported()) {
          recordingServiceRef.current = new CanvasRecordingService();
          let audioTrack: MediaStreamTrack | undefined;
          const destNode = setupAudioGraph(); 
          if (destNode && destNode.stream.getAudioTracks().length > 0) audioTrack = destNode.stream.getAudioTracks()[0];
          else if (audioRef.current) { try { const a = audioRef.current as HTMLAudioElement & { captureStream?: () => MediaStream; mozCaptureStream?: () => MediaStream; }; const s = a.captureStream ? a.captureStream() : a.mozCaptureStream?.(); if (s) audioTrack = s.getAudioTracks()[0]; } catch { /* ignore */ } }
          pendingRecordingArgsRef.current = { canvas: compositeCanvasRef.current || canvasRef.current, audioTrack, videoBitsPerSecond: 2_500_000 };
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
  },[cancelRafIfAny, ensureBackgroundCache, spritesheetRef, canvasRef, handleReset, resetRecordingState, audioRef, performAudioLock, sessionSeedRef, timelineRef, words, engineStateRef, setUiState, startTimeRef, syncRef, enableRecording, recordingServiceRef, setupAudioGraph, pendingRecordingArgsRef, compositeCanvasRef, setRecStatus, audioContextRef, tryStartRecordingWithTrim]);

  const handleGenerate = useCallback(async () => {
    if (uiState.appState === AppState.GENERATING) return;
    const myToken = (generationTokenRef.current += 1); const preset = findPreset(words); const willUseGemini = !preset;
    clearGenErrorTimers(); setUiState({ isGeminiGenerating: willUseGemini, appState: AppState.GENERATING, showGenError: false, genErrorClosing: false });
    setRecStatus({ isRecording: false }); if (audioRef.current) setupAudioGraph();

    try {
      let url: string;
      if (preset) url = preset.spritesheetUrl;
      else { const { generateGameSpritesheet } = await import('../spritesheet/geminiService'); url = await generateGameSpritesheet(words); }
      
      if (!isMountedRef.current || myToken !== generationTokenRef.current) return;
      const img = await loadImage(url);
      if (!isMountedRef.current || myToken !== generationTokenRef.current) return;
      
      const optimizedSprite = prepareSpriteSource(img); spritesheetRef.current = optimizedSprite;
      
      if (canvasRef.current) {
        if (!rendererRef.current) {
             const { CanvasRenderer } = await import('../rendering/renderer');
             CanvasRendererClassRef.current = CanvasRenderer; rendererRef.current = new CanvasRenderer(canvasRef.current, optimizedSprite);
        } else {
            const RendererClass = CanvasRendererClassRef.current || (await import('../rendering/renderer')).CanvasRenderer;
            CanvasRendererClassRef.current = RendererClass; rendererRef.current = new RendererClass(canvasRef.current, optimizedSprite);
        }
      }
      startGameSession(words);
    } catch {
      if (isMountedRef.current && myToken === generationTokenRef.current) { setUiState({ appState: AppState.IDLE }); if (willUseGemini) openGenError(); }
    } finally {
      if (isMountedRef.current && myToken === generationTokenRef.current) setUiState({ isGeminiGenerating: false });
    }
  },[uiState.appState, words, clearGenErrorTimers, setUiState, setRecStatus, audioRef, setupAudioGraph, loadImage, prepareSpriteSource, spritesheetRef, canvasRef, rendererRef, CanvasRendererClassRef, startGameSession, openGenError]);

  return { closeGenError, handleReset, startGameSession, handleRestartCurrentSession, handleGenerate };
}