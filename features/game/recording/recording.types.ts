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