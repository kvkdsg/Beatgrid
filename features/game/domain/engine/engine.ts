import {
  BEATS_PER_ROUND,
  ACTIVE_BEATS,
  TRANSITION_BEATS,
  ROUND_PATTERNS,
  TOTAL_CELLS,
  CELL_LABEL_DURATION_MS,
  CELL_LABEL_FADE_IN_MS,
  CELL_LABEL_FADE_OUT_MS,
} from '../../model/game.constants';
import { GameSettings, GameTimeline, RoundConfig } from '../../model/game.types';

const EMPTY_PATTERN: readonly number[] = Object.freeze([]);

export interface GameState {
  currentBeat: number;
  beatIndex: number;
  roundBeatOffset: number;
  roundNumber: number;
  currentPattern: readonly number[];
  prevPattern: readonly number[];
  interpolation: number;
  activeCellIndex: number;
  isFinished: boolean;
  showCellLabels: boolean;
  cellLabelsAlpha: number;
}

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

export const createTimeline = (settings: GameSettings): GameTimeline => {
  const beatsPerRound = settings.beatsPerRound ?? BEATS_PER_ROUND;

  const rounds: RoundConfig[] = ROUND_PATTERNS.map((pattern, idx) => ({
    roundNumber: idx + 1,
    pattern,
    startTimeInBeats: idx * beatsPerRound,
    durationInBeats: beatsPerRound,
    transitionInBeats: TRANSITION_BEATS,
  }));

  return {
    rounds,
    totalBeats: rounds.length * beatsPerRound,
    msPerBeat: 60000 / settings.bpm,
  };
};

const DEFAULT_GAME_STATE: GameState = {
    currentBeat: 0,
    beatIndex: 0,
    roundBeatOffset: 0,
    roundNumber: 1,
    currentPattern: EMPTY_PATTERN,
    prevPattern: EMPTY_PATTERN,
    interpolation: 0,
    activeCellIndex: -1,
    isFinished: false,
    showCellLabels: false,
    cellLabelsAlpha: 0,
};

export const getGameStateAtTime = (
  timeMs: number,
  timeline: GameTimeline,
  reuseResultObj?: GameState
): GameState => {
  const result: GameState = reuseResultObj || { ...DEFAULT_GAME_STATE };

  const msPerBeat = timeline.msPerBeat;

  if (msPerBeat <= 0) {
    Object.assign(result, DEFAULT_GAME_STATE);
    return result;
  }

  const currentBeat = timeMs / msPerBeat;
  
  if (currentBeat < 0) {
     Object.assign(result, DEFAULT_GAME_STATE);
     return result;
  }

  const beatIndex = currentBeat | 0;

  if (!timeline.rounds || timeline.rounds.length === 0) {
    Object.assign(result, DEFAULT_GAME_STATE);
    result.currentBeat = currentBeat;
    result.isFinished = true;
    return result;
  }

  const beatsPerRound = timeline.rounds[0].durationInBeats ?? BEATS_PER_ROUND;
  const currentRoundIdx = beatsPerRound > 0 ? (currentBeat / beatsPerRound) | 0 : 0;
  const lastRoundIdx = timeline.rounds.length - 1;
  const safeRoundIdx = currentRoundIdx < 0 ? 0 : (currentRoundIdx > lastRoundIdx ? lastRoundIdx : currentRoundIdx);
  const roundBeatOffset = beatsPerRound > 0 ? (currentBeat % beatsPerRound) : 0;

  const currentRound = timeline.rounds[safeRoundIdx];
  const nextRound = (safeRoundIdx + 1) < timeline.rounds.length ? timeline.rounds[safeRoundIdx + 1] : currentRound;

  const PATTERN_SWITCH_BEAT = ACTIVE_BEATS + 1;
  const transitionBeats = currentRound.transitionInBeats ?? TRANSITION_BEATS;
  const safeTransitionBeats = Math.max(0, transitionBeats);
  const transitionStart = Math.max(0, PATTERN_SWITCH_BEAT - safeTransitionBeats);

  let interpolation = 0;
  let currentPattern = currentRound.pattern;
  let prevPattern = currentRound.pattern;
  let roundNumber = currentRound.roundNumber;

  if (safeTransitionBeats > 0 && roundBeatOffset >= transitionStart && roundBeatOffset < PATTERN_SWITCH_BEAT) {
    const progress = (roundBeatOffset - transitionStart) / safeTransitionBeats;
    interpolation = 1 - clamp01(progress);
    prevPattern = currentRound.pattern;
    currentPattern = nextRound.pattern;
    roundNumber = nextRound.roundNumber;
  } else if (roundBeatOffset >= PATTERN_SWITCH_BEAT) {
    prevPattern = nextRound.pattern;
    currentPattern = nextRound.pattern;
    interpolation = 0;
    roundNumber = nextRound.roundNumber;
  }

  let activeCellIndex = -1;
  if (roundBeatOffset < ACTIVE_BEATS) {
    const doubleTimeProgress = (roundBeatOffset * 2) | 0;
    if (TOTAL_CELLS > 0 && doubleTimeProgress < TOTAL_CELLS) {
      activeCellIndex = doubleTimeProgress;
    }
  }

  let showCellLabels = false;
  let cellLabelsAlpha = 0;

  if (CELL_LABEL_DURATION_MS > 0 && safeRoundIdx < lastRoundIdx) {
      const currentRoundStartBeat = safeRoundIdx * beatsPerRound;
      const nextRoundStartBeat = (safeRoundIdx + 1) * beatsPerRound;
      const labelStartMs = (currentRoundStartBeat + PATTERN_SWITCH_BEAT) * msPerBeat;
      const activeStartMs = nextRoundStartBeat * msPerBeat;
      const labelEndMs = Math.min(labelStartMs + CELL_LABEL_DURATION_MS, activeStartMs);

      if (timeMs >= labelStartMs && timeMs < labelEndMs) {
        showCellLabels = true;
        const timeSinceStart = timeMs - labelStartMs;
        const alphaIn = CELL_LABEL_FADE_IN_MS > 0 ? clamp01(timeSinceStart / CELL_LABEL_FADE_IN_MS) : 1;
        const timeUntilEnd = labelEndMs - timeMs;
        const alphaOut = CELL_LABEL_FADE_OUT_MS > 0 ? clamp01(timeUntilEnd / CELL_LABEL_FADE_OUT_MS) : 1;
        cellLabelsAlpha = Math.min(alphaIn, alphaOut);
      }
  }

  result.currentBeat = currentBeat;
  result.beatIndex = beatIndex;
  result.roundBeatOffset = roundBeatOffset;
  result.roundNumber = roundNumber;
  result.currentPattern = currentPattern;
  result.prevPattern = prevPattern;
  result.interpolation = interpolation;
  result.activeCellIndex = activeCellIndex;
  result.isFinished = currentBeat >= timeline.totalBeats;
  result.showCellLabels = showCellLabels;
  result.cellLabelsAlpha = cellLabelsAlpha;

  return result;
};