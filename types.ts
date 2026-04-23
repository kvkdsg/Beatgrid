// src/types.ts

// --- TIPOS DEL MOTOR DE JUEGO ---
export type QuadrantIndex = 0 | 1 | 2 | 3; // Indices into the 2x2 grid (A, B, C, D)

export type BoardState = readonly number[]; // Length 8 (4x2 grid) - Readonly para inmutabilidad

export interface GameSettings {
  words: string[];
  bpm: number;
  beatsPerRound: number;
  seed: string;
}

export interface RoundConfig {
  roundNumber: number;
  pattern: BoardState;
  startTimeInBeats: number;
  durationInBeats: number;
  transitionInBeats: number;
}

export interface GameTimeline {
  rounds: RoundConfig[];
  totalBeats: number;
  msPerBeat: number;
}

export enum AppState {
  IDLE = 'idle',
  GENERATING = 'generating',
  READY = 'ready',
  PLAYING = 'playing',
  FINISHED = 'finished'
}

// --- TIPOS DE SERVICIO DE GRABACIÓN (CENTRALIZADOS) ---

/**
 * Configuración necesaria para iniciar el CanvasRecordingService.
 */
export interface RecordingConfig {
  canvas: HTMLCanvasElement;
  audioTrack?: MediaStreamTrack;
  frameRate?: number;
  videoBitsPerSecond?: number;
  audioBitsPerSecond?: number;
}

/**
 * Resultado estandarizado de una grabación.
 * Centralizado aquí para evitar conflictos de importación en App.tsx.
 */
export interface RecordingResult {
  blob: Blob;       // Blob binario del video
  url: string;      // URL para previsualización (blob:...)
  mimeType: string; // Tipo MIME real del archivo resultante
  durationMs: number; // Duración total en milisegundos
}

/**
 * Estado reactivo para la UI de grabación.
 */
export interface RecordingStatus {
  isRecording: boolean;
  recordedUrl?: string;
  recordedBlob?: Blob;
  mimeType?: string;
  error?: string;
}