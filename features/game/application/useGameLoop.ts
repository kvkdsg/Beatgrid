import type React from "react";
import { useCallback, useEffect } from "react";
import type { GameState } from "../domain/engine/engine";
import { getGameStateAtTime } from "../domain/engine/engine";
import type { useRecordingFlow } from "../hooks/useRecordingFlow";
import {
	CELL_LABEL_DURATION_MS,
	CELL_LABEL_FADE_IN_MS,
	DEFAULT_BPM,
	GLOBAL_AUDIO_LATENCY_MS,
	RECORDING_TRIM_END_MS,
	SONG_OFFSET_SEC,
	SYNC_AUDIO_EPSILON_MS,
	SYNC_NUDGE_FACTOR,
	SYNC_SAMPLE_SIZE,
	SYNC_THRESHOLD_IGNORE_MS,
	SYNC_THRESHOLD_SOFT_MS,
} from "../model/game.constants";
import { AppState } from "../model/game.types";
import type { UiState } from "./useGameController";
import type { useGameSession } from "./useGameSession";

const BASE_W = 1600;
const BASE_H = 800;
const BASE_COLS = 4;
const BASE_ROWS = 2;

const VERTICAL_W = 900;
const VERTICAL_H = 1600;
const VERTICAL_COLS = 2;
const VERTICAL_CELL_SIZE = 400;
const VERTICAL_GRID_W = VERTICAL_COLS * VERTICAL_CELL_SIZE;
const VERTICAL_GRID_X = (VERTICAL_W - VERTICAL_GRID_W) / 2;

interface GameLoopDeps {
	appState: AppState;
	isMobileVertical: boolean;
	setUiState: React.Dispatch<
		Partial<UiState> | ((prev: UiState) => Partial<UiState> | null)
	>;
	sessionRefs: ReturnType<typeof useGameSession>;
	recFlow: ReturnType<typeof useRecordingFlow>;
	canvasRef: React.RefObject<HTMLCanvasElement | null>;
	viewCanvasRef: React.RefObject<HTMLCanvasElement | null>;
	canvasContainerRef: React.RefObject<HTMLDivElement | null>;
	audioRef: React.RefObject<HTMLAudioElement | null>;
	requestRef: React.MutableRefObject<number | undefined>;
	layoutAnimRef: React.MutableRefObject<number>;
	lastLayoutProgressRef: React.MutableRefObject<number>;
	syncRef: React.MutableRefObject<{
		startTime: number;
		visualOffset: number;
		isLocked: boolean;
		driftSamples: number[];
		lastAudioTime: number;
		lastFrameTime: number;
	}>;
	startTimeRef: React.MutableRefObject<number | null>;
	applyCornerDance: (timeMs: number) => void;
	resetCornerTransform: () => void;
	renderCompositeFrame: (
		timeMs: number,
		opts?: {
			forceIntro?: boolean;
			introTextOverride?: string;
			gameStateOverride?: Partial<GameState> | null;
		},
	) => void;
	getReadyText: string;
	cancelRafIfAny: () => void;
	performAudioLock: () => void;
}

export function useGameLoop({
	appState,
	isMobileVertical,
	setUiState,
	sessionRefs: {
		timelineRef,
		engineStateRef,
		spritesheetRef,
		rendererRef,
		CanvasRendererClassRef,
	},
	recFlow: {
		isRecordingActiveRef,
		recordingStartedRef,
		recordingStoppedRef,
		recordingServiceRef,
		setStatus: setRecStatus,
	},
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
}: GameLoopDeps) {
	const projectToViewCanvas = useCallback(
		(progress: number) => {
			const src = canvasRef.current;
			const dst = viewCanvasRef.current;
			const container = canvasContainerRef.current;
			if (!src || !dst) return;

			const dstCtx = dst.getContext("2d", { alpha: true });
			if (!dstCtx) return;

			const currentW = BASE_W + (VERTICAL_W - BASE_W) * progress;
			const currentH = BASE_H + (VERTICAL_H - BASE_H) * progress;

			if (
				dst.width !== Math.round(currentW) ||
				dst.height !== Math.round(currentH)
			) {
				dst.width = Math.round(currentW);
				dst.height = Math.round(currentH);
			} else {
				dstCtx.clearRect(0, 0, dst.width, dst.height);
			}

			lastLayoutProgressRef.current = progress;

			if (container) {
				container.style.aspectRatio = (currentW / currentH).toString();
			}

			const srcCellW = src.width / BASE_COLS;
			const srcCellH = src.height / BASE_ROWS;

			for (let i = 0; i < BASE_COLS * BASE_ROWS; i++) {
				const startCol = i % BASE_COLS;
				const startRow = Math.floor(i / BASE_COLS);
				const endCol = i % VERTICAL_COLS;
				const endRow = Math.floor(i / VERTICAL_COLS);

				const sx = startCol * srcCellW;
				const sy = startRow * srcCellH;
				const startX = startCol * srcCellW;
				const startY = startRow * srcCellH;
				const endX = VERTICAL_GRID_X + endCol * VERTICAL_CELL_SIZE;
				const endY = endRow * VERTICAL_CELL_SIZE;

				dstCtx.drawImage(
					src,
					sx,
					sy,
					srcCellW,
					srcCellH,
					startX + (endX - startX) * progress,
					startY + (endY - startY) * progress,
					srcCellW + (VERTICAL_CELL_SIZE - srcCellW) * progress,
					srcCellH + (VERTICAL_CELL_SIZE - srcCellH) * progress,
				);
			}
		},
		[canvasRef, viewCanvasRef, canvasContainerRef, lastLayoutProgressRef],
	);

	const animate = useCallback(
		function loop() {
			if (
				appState !== AppState.PLAYING ||
				!timelineRef.current ||
				!canvasRef.current ||
				!spritesheetRef.current
			)
				return;

			const targetLayout = isMobileVertical ? 1 : 0;
			const diff = targetLayout - layoutAnimRef.current;
			if (Math.abs(diff) > 0.001) layoutAnimRef.current += diff * 0.1;
			else layoutAnimRef.current = targetLayout;

			const now = performance.now();
			const deltaTime = now - syncRef.current.lastFrameTime;
			syncRef.current.lastFrameTime = now;
			let visualRawTime =
				now - syncRef.current.startTime + syncRef.current.visualOffset;

			if (
				audioRef.current &&
				!audioRef.current.paused &&
				syncRef.current.isLocked
			) {
				const audioTimeMs = audioRef.current.currentTime * 1000;
				if (audioTimeMs > 200) {
					if (
						Math.abs(audioTimeMs - syncRef.current.lastAudioTime) >
						SYNC_AUDIO_EPSILON_MS
					) {
						syncRef.current.driftSamples.push(audioTimeMs - visualRawTime);
						if (syncRef.current.driftSamples.length > SYNC_SAMPLE_SIZE)
							syncRef.current.driftSamples.shift();
						syncRef.current.lastAudioTime = audioTimeMs;
					}

					const avgDrift =
						syncRef.current.driftSamples.length > 0
							? syncRef.current.driftSamples.reduce((a, b) => a + b, 0) /
								syncRef.current.driftSamples.length
							: 0;

					if (Math.abs(avgDrift) > SYNC_THRESHOLD_IGNORE_MS) {
						if (Math.abs(avgDrift) < SYNC_THRESHOLD_SOFT_MS)
							syncRef.current.visualOffset += Math.max(
								-10 * (deltaTime / 16.6),
								Math.min(
									10 * (deltaTime / 16.6),
									avgDrift * SYNC_NUDGE_FACTOR * (deltaTime / 16.6),
								),
							);
						else {
							syncRef.current.startTime = now - audioTimeMs;
							syncRef.current.visualOffset = 0;
							syncRef.current.driftSamples = [];
						}
					}
				}
				visualRawTime =
					now - syncRef.current.startTime + syncRef.current.visualOffset;
			} else if (!audioRef.current && startTimeRef.current) {
				visualRawTime = now - startTimeRef.current;
			}

			const visualTimeMs = Math.max(0, visualRawTime + GLOBAL_AUDIO_LATENCY_MS);
			const offsetMs = SONG_OFFSET_SEC * 1000;
			const gameTimeMs = Math.max(0, visualTimeMs - offsetMs);
			const beatProgress =
				timelineRef.current.msPerBeat > 0
					? (gameTimeMs % timelineRef.current.msPerBeat) /
						timelineRef.current.msPerBeat
					: 0;

			applyCornerDance(visualTimeMs);

			if (!rendererRef.current && CanvasRendererClassRef.current)
				rendererRef.current = new CanvasRendererClassRef.current(
					canvasRef.current,
					spritesheetRef.current,
				);

			if (!rendererRef.current) return;

			if (isRecordingActiveRef.current) {
				if (visualTimeMs < offsetMs) {
					const timeRemaining = offsetMs - visualTimeMs;
					const alpha =
						timeRemaining <= CELL_LABEL_DURATION_MS
							? CELL_LABEL_FADE_IN_MS > 0
								? Math.min(
										1,
										Math.max(
											0,
											(CELL_LABEL_DURATION_MS - timeRemaining) /
												CELL_LABEL_FADE_IN_MS,
										),
									)
								: 1
							: 0;

					rendererRef.current.render(
						canvasRef.current.width,
						canvasRef.current.height,
						timelineRef.current.rounds[0].pattern,
						timelineRef.current.rounds[0].pattern,
						0,
						0,
						-1,
					);

					renderCompositeFrame(visualTimeMs, {
						forceIntro: true,
						introTextOverride:
							Math.ceil(timeRemaining / 1000 / (60 / DEFAULT_BPM)) > 4
								? getReadyText
								: Math.ceil(
										timeRemaining / 1000 / (60 / DEFAULT_BPM),
									).toString(),
						gameStateOverride:
							timeRemaining <= CELL_LABEL_DURATION_MS
								? {
										currentPattern: timelineRef.current.rounds[0].pattern,
										showCellLabels: true,
										cellLabelsAlpha: alpha,
										roundNumber: 1,
									}
								: null,
					});
				} else {
					const recStateLoc = getGameStateAtTime(
						gameTimeMs,
						timelineRef.current,
					);

					rendererRef.current.render(
						canvasRef.current.width,
						canvasRef.current.height,
						recStateLoc.currentPattern,
						recStateLoc.prevPattern,
						recStateLoc.interpolation,
						beatProgress,
						recStateLoc.activeCellIndex,
					);

					renderCompositeFrame(visualTimeMs, {
						gameStateOverride: recStateLoc,
					});
				}
			}

			if (visualTimeMs < offsetMs) {
				const timeRemaining = offsetMs - visualTimeMs;

				setUiState((prev) => {
					const changes: Partial<UiState> = {};

					if (!prev.isInIntro) changes.isInIntro = true;

					const nt =
						Math.ceil(timeRemaining / 1000 / (60 / DEFAULT_BPM)) > 4
							? getReadyText
							: Math.ceil(timeRemaining / 1000 / (60 / DEFAULT_BPM)).toString();

					if (nt !== prev.introText) changes.introText = nt;

					if (timeRemaining <= CELL_LABEL_DURATION_MS) {
						const alpha =
							CELL_LABEL_FADE_IN_MS > 0
								? Math.min(
										1,
										Math.max(
											0,
											(CELL_LABEL_DURATION_MS - timeRemaining) /
												CELL_LABEL_FADE_IN_MS,
										),
									)
								: 1;

						if (
							prev.uiOverlayState.alpha !== alpha ||
							!prev.uiOverlayState.show
						)
							changes.uiOverlayState = {
								show: true,
								alpha,
								pattern: timelineRef.current?.rounds[0].pattern ?? [],
							};
					} else if (prev.uiOverlayState.show) {
						changes.uiOverlayState = { ...prev.uiOverlayState, show: false };
					}

					return Object.keys(changes).length > 0 ? changes : null;
				});

				rendererRef.current.render(
					canvasRef.current.width,
					canvasRef.current.height,
					timelineRef.current.rounds[0].pattern,
					timelineRef.current.rounds[0].pattern,
					0,
					0,
					-1,
				);

				projectToViewCanvas(layoutAnimRef.current);
				requestRef.current = requestAnimationFrame(loop);
				return;
			}

			engineStateRef.current = getGameStateAtTime(
				gameTimeMs,
				timelineRef.current,
				engineStateRef.current,
			);

			const state = engineStateRef.current;

			setUiState((prev) => {
				const changes: Partial<UiState> = {};

				if (prev.isInIntro) changes.isInIntro = false;

				if (state.roundNumber !== prev.uiRoundInfo.round)
					changes.uiRoundInfo = {
						round: state.roundNumber,
						beat: 0,
						totalBeats: timelineRef.current?.totalBeats ?? 0,
					};

				if (
					state.showCellLabels !== prev.uiOverlayState.show ||
					Math.abs(state.cellLabelsAlpha - prev.uiOverlayState.alpha) > 0.05
				)
					changes.uiOverlayState = {
						show: state.showCellLabels,
						alpha: state.cellLabelsAlpha,
						pattern: state.currentPattern,
					};

				return Object.keys(changes).length > 0 ? changes : null;
			});

			if (
				isRecordingActiveRef.current &&
				recordingStartedRef.current &&
				!recordingStoppedRef.current &&
				timelineRef.current
			) {
				if (
					gameTimeMs >=
					Math.max(
						0,
						timelineRef.current.totalBeats * timelineRef.current.msPerBeat -
							RECORDING_TRIM_END_MS,
					)
				) {
					recordingStoppedRef.current = true;

					rendererRef.current.render(
						canvasRef.current.width,
						canvasRef.current.height,
						state.currentPattern,
						state.prevPattern,
						state.interpolation,
						0,
						-1,
					);

					renderCompositeFrame(visualTimeMs, {
						gameStateOverride: state,
					});

					const activeRecorder = recordingServiceRef.current;
					recordingServiceRef.current = null;
					isRecordingActiveRef.current = false;

					if (activeRecorder)
						activeRecorder
							.stopRecording()
							.then((r) =>
								setRecStatus({
									isRecording: false,
									recordedUrl: r.url,
									recordedBlob: r.blob,
									mimeType: r.mimeType,
								}),
							)
							.catch(() =>
								setRecStatus({
									isRecording: false,
									error: "Error guardando video.",
								}),
							);
					else setRecStatus({ isRecording: false });
				}
			}

			if (state.isFinished) {
				cancelRafIfAny();

				if (audioRef.current) {
					audioRef.current.pause();
					audioRef.current.currentTime = 0;
					audioRef.current.removeEventListener("playing", performAudioLock);
				}

				if (isRecordingActiveRef.current && !recordingStoppedRef.current) {
					rendererRef.current.render(
						canvasRef.current.width,
						canvasRef.current.height,
						state.currentPattern,
						state.prevPattern,
						state.interpolation,
						0,
						-1,
					);

					renderCompositeFrame(visualTimeMs, {
						gameStateOverride: state,
					});

					const activeRecorder = recordingServiceRef.current;
					recordingServiceRef.current = null;
					isRecordingActiveRef.current = false;

					if (activeRecorder)
						activeRecorder
							.stopRecording()
							.then((r) =>
								setRecStatus({
									isRecording: false,
									recordedUrl: r.url,
									recordedBlob: r.blob,
									mimeType: r.mimeType,
								}),
							)
							.catch(() =>
								setRecStatus({
									isRecording: false,
									error: "Error guardando video.",
								}),
							);
				} else if (!recordingStoppedRef.current) {
					setRecStatus({ isRecording: false });
				}

				setUiState({ appState: AppState.FINISHED });
				resetCornerTransform();
				return;
			}

			rendererRef.current.render(
				canvasRef.current.width,
				canvasRef.current.height,
				state.currentPattern,
				state.prevPattern,
				state.interpolation,
				beatProgress,
				state.activeCellIndex,
			);

			projectToViewCanvas(layoutAnimRef.current);
			requestRef.current = requestAnimationFrame(loop);
		},
		[
			appState,
			isMobileVertical,
			cancelRafIfAny,
			applyCornerDance,
			resetCornerTransform,
			renderCompositeFrame,
			getReadyText,
			performAudioLock,
			projectToViewCanvas,
			audioRef,
			isRecordingActiveRef,
			recordingStartedRef,
			recordingStoppedRef,
			timelineRef,
			spritesheetRef,
			engineStateRef,
			rendererRef,
			CanvasRendererClassRef,
			layoutAnimRef,
			syncRef,
			startTimeRef,
			canvasRef,
			setUiState,
			requestRef,
			setRecStatus,
			recordingServiceRef,
		],
	);

	useEffect(() => {
		if (appState === AppState.PLAYING)
			requestRef.current = requestAnimationFrame(animate);

		return () => cancelRafIfAny();
	}, [appState, animate, cancelRafIfAny, requestRef]);
}
