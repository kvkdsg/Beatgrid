import { LOCALE_MENU } from "@shared/i18n/model/locales";
import type React from "react";
import {
	useCallback,
	useEffect,
	useMemo,
	useReducer,
	useRef,
	useState,
} from "react";
import { useTranslation } from "react-i18next";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { setLocale } from "@/i18n";
import {
	type AppLocale,
	DEFAULT_LOCALE,
	toSupportedLocale,
} from "@/i18n/config";
import { useCompositeFrameRenderer } from "./application/useCompositeFrameRenderer";
import { useCornerAnimation } from "./application/useCornerAnimation";
import {
	initialUiState,
	type UiState,
	useGameController,
} from "./application/useGameController";
import { useGameLoop } from "./application/useGameLoop";
import { useGameSession } from "./application/useGameSession";
import { useShareVideo } from "./application/useShareVideo";
import { useGameAudio } from "./hooks/useGameAudio";
import { useRecordingFlow } from "./hooks/useRecordingFlow";
import {
	GLOBAL_AUDIO_LATENCY_MS,
	RECORDING_TRIM_START_MS,
} from "./model/game.constants";
import { AppState } from "./model/game.types";
import { PRESETS, pickRandomPreset, wordsKey } from "./model/presets";
import MainMenu from "./ui/menu/MainMenu";
import { VideoResultPanel } from "./ui/result/VideoResultPanel";
import { GameStage } from "./ui/stage/GameStage";

const VIDEO_WIDTH = 1280;
const VIDEO_HEIGHT = 720;

const parseSlug = (s: string) =>
	s.split("-").map((w) => w.charAt(0).toUpperCase() + w.slice(1));

const GamePage: React.FC = () => {
	const { t, i18n } = useTranslation();
	const navigate = useNavigate();
	const location = useLocation();
	const { slug } = useParams();

	const { audioRef, audioContextRef, setupAudioGraph } = useGameAudio();

	const recFlow = useRecordingFlow();
	const {
		enableRecording,
		setEnableRecording,
		status: recStatus,
		setStatus: setRecStatus,
	} = recFlow;
	const {
		recordingStartedRef,
		recordingServiceRef,
		pendingRecordingArgsRef,
		isRecordingActiveRef,
	} = recFlow;

	const { canShareNative, handleShareVideo } = useShareVideo(
		recStatus.recordedBlob,
		recStatus.mimeType,
	);

	const sessionRefs = useGameSession();
	const { engineStateRef } = sessionRefs;

	const [uiState, setUiState] = useReducer(
		(
			state: UiState,
			action: Partial<UiState> | ((prev: UiState) => Partial<UiState> | null),
		) => {
			const next = typeof action === "function" ? action(state) : action;
			if (!next) return state;
			let hasChanges = false;
			for (const key in next) {
				if (state[key as keyof UiState] !== next[key as keyof UiState]) {
					hasChanges = true;
					break;
				}
			}
			return hasChanges ? { ...state, ...next } : state;
		},
		initialUiState,
	);

	const layoutAnimRef = useRef(0);
	const lastLayoutProgressRef = useRef<number>(-1);

	useEffect(() => {
		const mediaQuery = window.matchMedia("(orientation: landscape)");
		const handleOrientationChange = (
			e: MediaQueryListEvent | MediaQueryList,
		) => {
			if (e.matches) setUiState({ isMobileVertical: false });
		};
		handleOrientationChange(mediaQuery);
		mediaQuery.addEventListener("change", handleOrientationChange);
		return () =>
			mediaQuery.removeEventListener("change", handleOrientationChange);
	}, []);

	const currentLocale = useMemo(
		() =>
			toSupportedLocale(i18n.resolvedLanguage ?? i18n.language) ??
			DEFAULT_LOCALE,
		[i18n.resolvedLanguage, i18n.language],
	);

	const canvasLabelsRef = useRef({ roundLabel: "ROUND" });
	useEffect(() => {
		canvasLabelsRef.current.roundLabel = t("canvas.roundLabel");
	}, [t]);

	const [words, setWords] = useState<string[]>(() => {
		if (slug) {
			try {
				const decoded = parseSlug(slug);
				if (decoded.length === 4) return decoded;
			} catch {
				/* ignore */
			}
		}
		return [...pickRandomPreset().words];
	});

	useEffect(() => {
		if (slug && uiState.appState === AppState.IDLE) {
			const decoded = parseSlug(slug);
			if (decoded.length === 4) setWords(decoded);
		}
	}, [slug, uiState.appState]);

	const canvasRef = useRef<HTMLCanvasElement>(null);
	const viewCanvasRef = useRef<HTMLCanvasElement>(null);
	const canvasContainerRef = useRef<HTMLDivElement>(null);
	const compositeCanvasRef = useRef<HTMLCanvasElement | null>(null);
	const compositeCtxRef = useRef<CanvasRenderingContext2D | null>(null);
	const cachedBgCanvasRef = useRef<HTMLCanvasElement | null>(null);

	const requestRef = useRef<number | undefined>(undefined);

	const startTimeRef = useRef<number | null>(null);
	const syncRef = useRef({
		startTime: 0,
		visualOffset: 0,
		isLocked: false,
		driftSamples: [] as number[],
		lastAudioTime: 0,
		lastFrameTime: 0,
	});

	const normalizedWords = useMemo(
		() => (words ?? []).map((w) => String(w ?? "").trim()),
		[words],
	);
	const getReadyText = t("intro.getReady");

	const handleLanguageChange = async (newLocale: AppLocale) => {
		await setLocale(newLocale);
		const currentPath = location.pathname;
		const segments = currentPath.split("/").filter(Boolean);
		if (segments.length > 0 && LOCALE_MENU.includes(segments[0] as AppLocale))
			segments[0] = newLocale;
		else segments.unshift(newLocale);
		navigate(`/${segments.join("/")}`);
	};

	const {
		cornerTLRef,
		cornerTRRef,
		cornerBLRef,
		cornerBRRef,
		computeCornerDance,
		resetCornerTransform,
		applyCornerDance,
	} = useCornerAnimation();

	const prepareSpriteSource = useCallback(
		(img: HTMLImageElement): HTMLCanvasElement => {
			const offscreen = document.createElement("canvas");
			offscreen.width = img.naturalWidth || img.width;
			offscreen.height = img.naturalHeight || img.height;
			const ctx = offscreen.getContext("2d", { alpha: true });
			if (ctx) ctx.drawImage(img, 0, 0);
			return offscreen;
		},
		[],
	);

	const ensureBackgroundCache = useCallback(async () => {
		if (cachedBgCanvasRef.current) return;
		if (!compositeCanvasRef.current) {
			const c = document.createElement("canvas");
			c.width = VIDEO_WIDTH;
			c.height = VIDEO_HEIGHT;
			compositeCanvasRef.current = c;
			compositeCtxRef.current = c.getContext("2d", { alpha: false });
		}
		const imgA = new Image();
		imgA.crossOrigin = "anonymous";
		imgA.src = "/images/paper.webp";
		try {
			await imgA.decode();
			const offscreen = document.createElement("canvas");
			offscreen.width = VIDEO_WIDTH;
			offscreen.height = VIDEO_HEIGHT;
			const ctx = offscreen.getContext("2d", { alpha: false });
			if (ctx) {
				if (imgA.naturalWidth > 0) {
					const scale = Math.max(
						VIDEO_WIDTH / imgA.naturalWidth,
						VIDEO_HEIGHT / imgA.naturalHeight,
					);
					ctx.drawImage(
						imgA,
						(VIDEO_WIDTH - imgA.naturalWidth * scale) / 2,
						(VIDEO_HEIGHT - imgA.naturalHeight * scale) / 2,
						imgA.naturalWidth * scale,
						imgA.naturalHeight * scale,
					);
					ctx.globalCompositeOperation = "multiply";
					ctx.fillStyle = "#f0f0f0";
					ctx.fillRect(0, 0, VIDEO_WIDTH, VIDEO_HEIGHT);
				} else {
					ctx.fillStyle = "#e5e5e5";
					ctx.fillRect(0, 0, VIDEO_WIDTH, VIDEO_HEIGHT);
				}
				cachedBgCanvasRef.current = offscreen;
			}
		} catch (e) {
			console.warn("Background cache error", e);
		}
	}, []);

	useEffect(() => {
		resetCornerTransform();
		(
			document as Document & { fonts?: { ready?: Promise<void> } }
		).fonts?.ready?.catch?.(() => {});
	}, [resetCornerTransform]);

	const cancelRafIfAny = useCallback(() => {
		if (requestRef.current !== undefined) {
			cancelAnimationFrame(requestRef.current);
			requestRef.current = undefined;
		}
	}, []);
	const waitNextAnimationFrame = useCallback(
		(): Promise<void> => new Promise((r) => requestAnimationFrame(() => r())),
		[],
	);

	const performAudioLock = useCallback(() => {
		if (!audioRef.current) return;
		const audioMs = audioRef.current.currentTime * 1000;
		const perfMs = performance.now();
		syncRef.current.startTime = perfMs - audioMs;
		syncRef.current.visualOffset = 0;
		syncRef.current.isLocked = true;
		syncRef.current.driftSamples = [];
		syncRef.current.lastAudioTime = audioMs;
	}, [audioRef]);

	const { renderCompositeFrame } = useCompositeFrameRenderer({
		compositeCtxRef,
		compositeCanvasRef,
		canvasRef,
		cachedBgCanvasRef,
		normalizedWords,
		canvasLabelsRef,
		appState: uiState.appState,
		isInIntro: uiState.isInIntro,
		introText: uiState.introText,
		engineStateRef,
		computeCornerDance,
	});

	const tryStartRecordingWithTrim = useCallback(
		async function loop() {
			if (recordingStartedRef.current) return;
			const a = audioRef.current;
			const recorder = recordingServiceRef.current;
			const args = pendingRecordingArgsRef.current;
			if (!a || !recorder || !args) return;
			const audioMs = a.currentTime * 1000;
			if (audioMs < RECORDING_TRIM_START_MS) {
				requestAnimationFrame(() => void loop());
				return;
			}

			recordingStartedRef.current = true;
			isRecordingActiveRef.current = true;
			const now = performance.now();
			const visualRawTime =
				now - syncRef.current.startTime + syncRef.current.visualOffset;
			const warmupTimeMs = Math.max(0, visualRawTime + GLOBAL_AUDIO_LATENCY_MS);

			renderCompositeFrame(warmupTimeMs, {
				forceIntro: true,
				introTextOverride: getReadyText,
			});
			await waitNextAnimationFrame();
			renderCompositeFrame(warmupTimeMs, {
				forceIntro: true,
				introTextOverride: getReadyText,
			});
			await waitNextAnimationFrame();

			await recorder.startRecording(args);
			setRecStatus({ isRecording: true });
		},
		[
			getReadyText,
			renderCompositeFrame,
			waitNextAnimationFrame,
			audioRef,
			recordingStartedRef,
			recordingServiceRef,
			pendingRecordingArgsRef,
			isRecordingActiveRef,
			setRecStatus,
		],
	);

	const loadImage = useCallback(
		async (url: string): Promise<HTMLImageElement> => {
			const img = new Image();
			img.crossOrigin = "anonymous";
			img.src = url;
			try {
				await img.decode();
				return img;
			} catch {
				return new Promise((res, rej) => {
					img.onload = () => res(img);
					img.onerror = () => rej(new Error("Failed to load."));
				});
			}
		},
		[],
	);

	const handleNextPreset = useCallback(() => {
		if (uiState.appState !== AppState.IDLE) return;
		const currentIndex = PRESETS.findIndex(
			(p) => wordsKey(p.words) === wordsKey(words),
		);
		setWords([...PRESETS[(currentIndex + 1) % PRESETS.length].words]);
	}, [words, uiState.appState]);

	const handlePrevPreset = useCallback(() => {
		if (uiState.appState !== AppState.IDLE) return;
		const currentIndex = PRESETS.findIndex(
			(p) => wordsKey(p.words) === wordsKey(words),
		);
		setWords([
			...PRESETS[
				currentIndex === -1
					? PRESETS.length - 1
					: (currentIndex - 1 + PRESETS.length) % PRESETS.length
			].words,
		]);
	}, [words, uiState.appState]);

	const {
		closeGenError,
		handleReset,
		handleRestartCurrentSession,
		handleGenerate,
	} = useGameController({
		words,
		uiState,
		setUiState,
		audioRef,
		audioContextRef,
		setupAudioGraph,
		recFlow,
		sessionRefs,
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
		layoutAnimRef,
	});

	useGameLoop({
		appState: uiState.appState,
		isMobileVertical: uiState.isMobileVertical,
		setUiState,
		sessionRefs,
		recFlow,
		canvasRef,
		viewCanvasRef,
		canvasContainerRef,
		audioRef,
		requestRef,
		layoutAnimRef,
		lastLayoutProgressRef,
		syncRef,
		startTimeRef,
		applyCornerDance,
		resetCornerTransform,
		renderCompositeFrame,
		getReadyText,
		cancelRafIfAny,
		performAudioLock,
	});

	return (
		<div className="h-svh min-h-svh w-full relative overflow-hidden bg-[#f0f0f0] box-border">
			<img
				src="/images/paper.webp"
				alt=""
				fetchPriority="high"
				decoding="async"
				className="absolute inset-0 w-full h-full object-cover mix-blend-multiply pointer-events-none z-0"
				style={{ backgroundColor: "#f0f0f0" }}
			/>
			{/* biome-ignore lint/a11y/useMediaCaption: Background audio track does not require captions */}
			<audio
				ref={audioRef}
				src="/audio/game-track.opus"
				preload="auto"
				crossOrigin="anonymous"
			/>

			{uiState.appState === AppState.PLAYING && (
				<div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-100 md:hidden portrait:block landscape:hidden">
					<button
						type="button"
						onClick={() =>
							setUiState({ isMobileVertical: !uiState.isMobileVertical })
						}
						aria-label={
							uiState.isMobileVertical
								? "Switch to Horizontal View"
								: "Switch to Vertical View"
						}
						className="group flex items-center justify-center w-14 h-14 bg-white border-4 border-black rounded-full shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] active:translate-y-0.5 active:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all"
					>
						<svg
							aria-hidden="true"
							className={`w-7 h-7 text-black transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] ${uiState.isMobileVertical ? "rotate-90" : "rotate-0"}`}
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							strokeWidth="3"
							strokeLinecap="square"
							strokeLinejoin="miter"
						>
							<path d="M21 12H3M3 12L8 17M3 12L8 7M21 12L16 17M21 12L16 7" />
						</svg>
					</button>
				</div>
			)}

			<MainMenu
				show={
					uiState.appState === AppState.IDLE ||
					uiState.appState === AppState.GENERATING
				}
				currentLocale={currentLocale}
				onLanguageChange={handleLanguageChange}
				showGenError={uiState.showGenError}
				genErrorClosing={uiState.genErrorClosing}
				onCloseGenError={closeGenError}
				isGenerating={uiState.appState === AppState.GENERATING}
				onPrevPreset={handlePrevPreset}
				onNextPreset={handleNextPreset}
				words={words}
				setWords={setWords}
				onGenerate={handleGenerate}
				isGeminiGenerating={uiState.isGeminiGenerating}
				enableRecording={enableRecording}
				setEnableRecording={setEnableRecording}
			/>

			{uiState.appState === AppState.FINISHED && (
				<VideoResultPanel
					showVideoSection={
						!!recStatus.recordedUrl ||
						recStatus.isRecording ||
						!!recStatus.error
					}
					recordedUrl={recStatus.recordedUrl}
					mimeType={recStatus.mimeType}
					canShareNative={canShareNative}
					onShareVideo={handleShareVideo}
					onRestartSession={handleRestartCurrentSession}
					onReset={handleReset}
				/>
			)}

			<GameStage
				show={
					uiState.appState === AppState.PLAYING ||
					uiState.appState === AppState.FINISHED
				}
				isMobileVertical={uiState.isMobileVertical}
				isInIntro={uiState.isInIntro}
				introText={uiState.introText}
				round={uiState.uiRoundInfo.round}
				beat={uiState.uiRoundInfo.beat}
				totalBeats={uiState.uiRoundInfo.totalBeats}
				words={words}
				canvasContainerRef={canvasContainerRef}
				canvasRef={canvasRef}
				viewCanvasRef={viewCanvasRef}
				shouldRenderOverlay={
					uiState.appState === AppState.PLAYING &&
					uiState.uiOverlayState.show &&
					uiState.uiOverlayState.pattern.length > 0
				}
				overlayAlpha={uiState.uiOverlayState.alpha}
				overlayPattern={uiState.uiOverlayState.pattern}
				normalizedWords={normalizedWords}
				cornerRefs={{
					tl: cornerTLRef,
					tr: cornerTRRef,
					bl: cornerBLRef,
					br: cornerBRRef,
				}}
			/>
		</div>
	);
};

export default GamePage;
