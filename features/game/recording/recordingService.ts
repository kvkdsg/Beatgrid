import type { RecordingConfig, RecordingResult } from "./recording.types";

export class CanvasRecordingService {
	private mediaRecorder: MediaRecorder | null = null;
	private recordedChunks: Blob[] = [];
	private startTime: number = 0;
	private resolveRecording: ((result: RecordingResult) => void) | null = null;
	private rejectRecording: ((error: Error) => void) | null = null;
	private isProcessingFinalization: boolean = false;

	private stream: MediaStream | null = null;

	private waitForRecorderStart(mr: MediaRecorder): Promise<void> {
		return new Promise((resolve, reject) => {
			if (mr.state === "recording") return resolve();

			const onStart = () => {
				mr.removeEventListener("error", onError as EventListener);
				resolve();
			};
			const onError = (e: Event) => {
				mr.removeEventListener("start", onStart);
				// @ts-expect-error - Event does not have error property in standard TS DOM types
				const error = e.error || new Error("MediaRecorder start error");
				reject(error);
			};

			mr.addEventListener("start", onStart, { once: true });
			mr.addEventListener("error", onError, { once: true });
		});
	}

	public async startRecording(config: RecordingConfig): Promise<void> {
		if (this.mediaRecorder && this.mediaRecorder.state !== "inactive") {
			console.warn("[RecordingService] Grabación ya activa.");
			return;
		}

		this.cleanupState();
		this.recordedChunks = [];
		this.startTime = performance.now();
		this.isProcessingFinalization = false;

		const fps = config.frameRate ?? 60;

		try {
			this.stream = config.canvas.captureStream
				? config.canvas.captureStream(fps)
				: // @ts-expect-error - mozCaptureStream is non-standard
					config.canvas.mozCaptureStream(fps);
		} catch (e) {
			throw new Error(`Error capturando canvas: ${e}`, { cause: e });
		}

		if (!this.stream)
			throw new Error("No se pudo obtener el stream del canvas.");

		const videoTrack = this.stream.getVideoTracks()[0];
		if (!videoTrack) throw new Error("El canvas no generó tracks de video.");
		videoTrack.enabled = true;

		if (config.audioTrack && config.audioTrack.readyState === "live") {
			this.stream.addTrack(config.audioTrack);
		}

		const mimeType = this.getBestPerformanceMimeType();
		const options: MediaRecorderOptions = {
			videoBitsPerSecond: config.videoBitsPerSecond ?? 2_500_000,
			mimeType: mimeType || undefined,
		};

		if (config.audioBitsPerSecond) {
			options.audioBitsPerSecond = config.audioBitsPerSecond ?? 128000;
		}

		try {
			this.mediaRecorder = new MediaRecorder(this.stream, options);
		} catch (e) {
			console.warn(`[RecordingService] Fallback codec: ${e}`);
			try {
				this.mediaRecorder = new MediaRecorder(this.stream, {
					videoBitsPerSecond: options.videoBitsPerSecond,
				});
			} catch (e2) {
				this.cleanupState();
				throw new Error(`MediaRecorder no soportado: ${e2}`, { cause: e2 });
			}
		}

		if (!this.mediaRecorder) {
			this.cleanupState();
			throw new Error("MediaRecorder no instanciado.");
		}

		this.mediaRecorder.ondataavailable = (e) => {
			if (e.data && e.data.size > 0) this.recordedChunks.push(e.data);
		};

		this.mediaRecorder.onerror = (e: Event) => {
			const errorEvent = e as Event & { error?: Error };
			console.error("[RecordingService] Error interno:", errorEvent.error);
			if (this.rejectRecording) {
				this.rejectRecording(
					errorEvent.error || new Error("Unknown Recorder Error"),
				);
			}
			this.cancelRecording();
		};

		this.mediaRecorder.onstop = () => this.handleRecordingStop();

		try {
			this.mediaRecorder.start();
			await this.waitForRecorderStart(this.mediaRecorder);
			console.log(
				`[RecordingService] GRABANDO | ${this.mediaRecorder.mimeType} | FPS: ${fps}`,
			);
		} catch (e) {
			this.cleanupState();
			throw new Error(`Error al iniciar grabación: ${e}`, { cause: e });
		}
	}

	public stopRecording(): Promise<RecordingResult> {
		return new Promise((resolve, reject) => {
			if (!this.mediaRecorder || this.mediaRecorder.state === "inactive") {
				this.cleanupState();
				return reject(new Error("No hay grabación activa."));
			}

			this.resolveRecording = resolve;
			this.rejectRecording = reject;

			try {
				this.mediaRecorder.stop();
			} catch {
				this.handleRecordingStop();
			}
		});
	}

	public cancelRecording(): void {
		if (this.mediaRecorder && this.mediaRecorder.state !== "inactive") {
			try {
				this.mediaRecorder.stop();
			} catch {
				/* ignore */
			}
		}
		this.cleanupState();
	}

	private cleanupState(): void {
		if (this.stream) {
			this.stream.getTracks().forEach((t) => {
				t.stop();
			});
		}
		this.stream = null;
		this.recordedChunks = [];
		this.mediaRecorder = null;
		this.resolveRecording = null;
		this.rejectRecording = null;
	}

	private handleRecordingStop(): void {
		if (this.isProcessingFinalization) return;
		this.isProcessingFinalization = true;

		setTimeout(() => {
			const resolve = this.resolveRecording;
			const reject = this.rejectRecording;

			if (!resolve) {
				this.cleanupState();
				return;
			}

			const finalMime = this.mediaRecorder?.mimeType || "video/webm";
			const duration = performance.now() - this.startTime;

			const blob = new Blob(this.recordedChunks, { type: finalMime });
			const url = URL.createObjectURL(blob);

			if (blob.size === 0 && reject) {
				reject(new Error("Grabación vacía."));
			} else {
				resolve({
					blob,
					url,
					mimeType: finalMime,
					durationMs: duration,
				});
			}

			this.cleanupState();
			this.isProcessingFinalization = false;
		}, 100);
	}

	private getBestPerformanceMimeType(): string {
		const types = [
			"video/webm;codecs=vp9,opus",
			"video/webm;codecs=vp8,opus",
			"video/webm;codecs=h264,opus",
			"video/webm",
			"video/mp4;codecs=avc1,mp4a.40.2",
			"video/mp4",
		];
		return types.find((t) => MediaRecorder.isTypeSupported(t)) || "";
	}

	public static isSupported() {
		return (
			typeof MediaRecorder !== "undefined" &&
			(typeof HTMLCanvasElement.prototype.captureStream === "function" ||
				typeof (
					HTMLCanvasElement.prototype as unknown as Record<string, unknown>
				).mozCaptureStream === "function")
		);
	}
}
