import "@testing-library/jest-dom";
import { vi } from "vitest";

class MockMediaRecorder {
	state = "inactive";
	mimeType = "video/webm";
	ondataavailable: ((event: unknown) => void) | null = null;
	onstop: (() => void) | null = null;
	onerror: ((event: unknown) => void) | null = null;

	start() {
		this.state = "recording";
	}
	stop() {
		this.state = "inactive";
		if (this.onstop) this.onstop();
	}
	static isTypeSupported() {
		return true;
	}
}

(
	global as unknown as { MediaRecorder: typeof MockMediaRecorder }
).MediaRecorder = MockMediaRecorder;

(
	HTMLCanvasElement.prototype as unknown as { captureStream: unknown }
).captureStream = vi.fn(() => ({
	getVideoTracks: () => [{ enabled: true, stop: vi.fn() }],
	getAudioTracks: () => [],
	getTracks: () => [{ stop: vi.fn() }],
	addTrack: vi.fn(),
}));
