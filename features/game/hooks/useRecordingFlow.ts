import { useCallback, useRef, useState } from "react";
import type {
	RecordingConfig,
	RecordingResult,
	RecordingStatus,
} from "../recording/recording.types";

interface IRecordingService {
	startRecording(args: RecordingConfig): Promise<void>;
	stopRecording(): Promise<RecordingResult>;
	cancelRecording(): void;
}

export function useRecordingFlow() {
	const [enableRecording, setEnableRecording] = useState(true);
	const [status, setStatus] = useState<RecordingStatus & { error?: string }>({
		isRecording: false,
	});

	const recordingServiceRef = useRef<IRecordingService | null>(null);
	const isRecordingActiveRef = useRef<boolean>(false);
	const recordingStartedRef = useRef<boolean>(false);
	const recordingStoppedRef = useRef<boolean>(false);
	const pendingRecordingArgsRef = useRef<RecordingConfig | null>(null);

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
		recordingServiceRef,
		isRecordingActiveRef,
		recordingStartedRef,
		recordingStoppedRef,
		pendingRecordingArgsRef,
		resetRecordingState,
	};
}
