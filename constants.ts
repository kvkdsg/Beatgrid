import { BoardState } from './types';

export const SONG_BPM = 92;
export const SONG_OFFSET_SEC = 9;

export const BOARD_COLS = 4;
export const BOARD_ROWS = 2;
export const TOTAL_CELLS = BOARD_COLS * BOARD_ROWS;

export const SPRITE_RESOLUTION = 1024;
export const QUADRANT_SIZE = 512;

export const DEFAULT_BPM = SONG_BPM;

export const ACTIVE_BEATS = 4;
export const REST_BEATS = 4;
export const BEATS_PER_ROUND = ACTIVE_BEATS + REST_BEATS;
export const TRANSITION_BEATS = 1;

export const CELL_LABEL_DURATION_MS = 2000;
export const CELL_LABEL_FADE_IN_MS = 250;
export const CELL_LABEL_FADE_OUT_MS = 250;

export const GLOBAL_AUDIO_LATENCY_MS = 0;
export const SYNC_THRESHOLD_IGNORE_MS = 25;
export const SYNC_THRESHOLD_SOFT_MS = 80;
export const SYNC_AUDIO_EPSILON_MS = 2;
export const SYNC_NUDGE_FACTOR = 0.05;
export const SYNC_SAMPLE_SIZE = 15;
export const RECORDING_START_DELAY_MS = 50;
export const RECORDING_VIDEO_LAG_MS = 175;
export const RECORDING_TRIM_START_MS = 3000;
export const RECORDING_TRIM_END_MS = 1000;
export const R1_PATTERN: BoardState = [0, 0, 0, 0, 0, 0, 0, 0];
export const R2_PATTERN: BoardState = [0, 0, 0, 0, 1, 1, 1, 1];
export const R3_PATTERN: BoardState = [0, 2, 0, 2, 1, 2, 1, 2];
export const R4_PATTERN: BoardState = [0, 2, 3, 1, 1, 3, 2, 0];
export const R5_PATTERN: BoardState = [1, 3, 0, 2, 3, 0, 1, 2];
export const ROUND_PATTERNS = [R1_PATTERN, R2_PATTERN, R3_PATTERN, R4_PATTERN, R5_PATTERN];
export const BUY_ME_COFFEE_URL = "https://buy.stripe.com/4gMeV5cAi2gCdetdwAg7e00";
