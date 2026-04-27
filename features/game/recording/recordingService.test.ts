import { beforeEach, describe, expect, it, vi } from "vitest";
import type { RecordingConfig } from "./recording.types";
import { CanvasRecordingService } from "./recordingService";

describe("Recording Service", () => {
	let canvas: HTMLCanvasElement;
	let service: CanvasRecordingService;

	beforeEach(() => {
		canvas = document.createElement("canvas");
		service = new CanvasRecordingService();
		vi.useFakeTimers();
	});

	it("should successfully initialize and start recording", async () => {
		const config: RecordingConfig = { canvas };

		const startPromise = service.startRecording(config);

		const recorderInstance = (service as unknown as Record<string, unknown>)
			.mediaRecorder as Record<string, unknown>;
		expect(recorderInstance).toBeDefined();

		recorderInstance.state = "recording";
		if (recorderInstance.onstart)
			(recorderInstance as { onstart?: (e: Event) => void }).onstart?.(
				new Event("start"),
			);
		else {
			vi.advanceTimersByTime(100);
		}

		await expect(startPromise).resolves.toBeUndefined();
		// @ts-expect-error: Accediendo a propiedad privada exclusivamente para propósitos de test
		expect(service.isProcessingFinalization).toBe(false);
	});

	it("should throw an error if stream cannot be captured", async () => {
		(canvas as unknown as { captureStream: undefined }).captureStream =
			undefined;
		(canvas as unknown as { mozCaptureStream?: unknown }).mozCaptureStream =
			undefined;

		const config: RecordingConfig = { canvas };
		await expect(service.startRecording(config)).rejects.toThrow(
			/Error capturando canvas/,
		);
	});

	it("isSupported should return true in supported mocked environments", () => {
		expect(CanvasRecordingService.isSupported()).toBe(true);
	});
});
