import { useRef } from "react";
import type { GameState } from "../domain/engine/engine";
import type { GameTimeline } from "../model/game.types";
import type { CanvasRenderer, SpriteSource } from "../rendering/renderer";

export function useGameSession() {
	const timelineRef = useRef<GameTimeline | null>(null);
	const sessionSeedRef = useRef<string | null>(null);
	const engineStateRef = useRef<GameState | undefined>(undefined);
	const spritesheetRef = useRef<SpriteSource | null>(null);
	const rendererRef = useRef<CanvasRenderer | null>(null);
	const CanvasRendererClassRef = useRef<typeof CanvasRenderer | null>(null);

	return {
		timelineRef,
		sessionSeedRef,
		engineStateRef,
		spritesheetRef,
		rendererRef,
		CanvasRendererClassRef,
	};
}
