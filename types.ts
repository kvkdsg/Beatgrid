// src/types.ts

export type QuadrantIndex = 0 | 1 | 2 | 3;

export type BoardState = readonly number[]; 

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

export interface RecordingConfig {
  canvas: HTMLCanvasElement;
  audioTrack?: MediaStreamTrack;
  frameRate?: number;
  videoBitsPerSecond?: number;
  audioBitsPerSecond?: number;
}

export interface RecordingResult {
  blob: Blob;     
  url: string;      
  mimeType: string; 
  durationMs: number; 
}

export interface RecordingStatus {
  isRecording: boolean;
  recordedUrl?: string;
  recordedBlob?: Blob;
  mimeType?: string;
  error?: string;
}