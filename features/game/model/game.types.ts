export type BoardState = readonly number[];

export interface GameSettings {
	words: string[];
	bpm: number;
	beatsPerRound: number;
	seed: string;
}

export interface RoundConfig {
	roundNumber: number;
	pattern: BoardState;
	startTimeInBeats: number;
	durationInBeats: number;
	transitionInBeats: number;
}

export interface GameTimeline {
	rounds: RoundConfig[];
	totalBeats: number;
	msPerBeat: number;
}

export enum AppState {
	IDLE = "idle",
	GENERATING = "generating",
	PLAYING = "playing",
	FINISHED = "finished",
}
