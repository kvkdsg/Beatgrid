import { useState, useMemo, useRef, useCallback } from 'react';
import { RecordingStatus, RecordingResult, RecordingConfig } from '../../../types';

interface IRecordingService {
  startRecording(args: RecordingConfig): Promise<void>;
  stopRecording(): Promise<RecordingResult>;
  cancelRecording(): void;
}

export function useRecordingFlow() {
  const[enableRecording, setEnableRecording] = useState(true);
  const [status, setStatus] = useState<RecordingStatus & { error?: string }>({ isRecording: false });

  const recordingServiceRef = useRef<IRecordingService | null>(null);
  const isRecordingActiveRef = useRef<boolean>(false);
  const recordingStartedRef = useRef<boolean>(false);
  const recordingStoppedRef = useRef<boolean>(false);
  const pendingRecordingArgsRef = useRef<RecordingConfig | null>(null);

  const canShareNative = useMemo(() => {
    const blob = status.recordedBlob;
    const mime = status.mimeType;
    if (!blob || !mime || typeof navigator === 'undefined' || !navigator.canShare) return false;
    
    try {
      const cleanMime = mime.toLowerCase().includes('mp4') ? 'video/mp4' : 'video/webm';
      const file = new File([blob], `BeatGrid_Gameplay.${cleanMime.split('/')[1]}`, { 
        type: cleanMime 
      });
      return navigator.canShare({ files: [file] });
    } catch {
      return false;
    }
  },[status.recordedBlob, status.mimeType]);

  const resetRecordingState = useCallback(() => {
    if (recordingServiceRef.current) {
      recordingServiceRef.current.cancelRecording();
      recordingServiceRef.current = null;
    }
    if (status.recordedUrl) URL.revokeObjectURL(status.recordedUrl);
    
    isRecordingActiveRef.current = false;
    recordingStartedRef.current = false;
    recordingStoppedRef.current = false;
    pendingRecordingArgsRef.current = null;
    setStatus({ isRecording: false });
  }, [status.recordedUrl]);

  return {
    enableRecording,
    setEnableRecording,
    status,
    setStatus,
    canShareNative,
    recordingServiceRef,
    isRecordingActiveRef,
    recordingStartedRef,
    recordingStoppedRef,
    pendingRecordingArgsRef,
    resetRecordingState
  };
}