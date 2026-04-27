import { useCallback, useRef } from "react";

export function useGameAudio() {
	const audioRef = useRef<HTMLAudioElement | null>(null);
	const audioContextRef = useRef<AudioContext | null>(null);
	const audioSourceNodeRef = useRef<MediaElementAudioSourceNode | null>(null);
	const audioDestNodeRef = useRef<MediaStreamAudioDestinationNode | null>(null);

	const setupAudioGraph = useCallback(() => {
		if (!audioRef.current) return null;

		let ctx = audioContextRef.current;
		if (!ctx || ctx.state === "closed") {
			try {
				const Ctx =
					window.AudioContext ||
					(
						window as Window &
							typeof globalThis & { webkitAudioContext?: typeof AudioContext }
					).webkitAudioContext;
				ctx = new Ctx();
				audioContextRef.current = ctx;
			} catch (e) {
				console.error("AudioContext creation failed:", e);
				return null;
			}
		}

		if (ctx.state === "suspended") ctx.resume().catch(() => {});

		if (!audioSourceNodeRef.current) {
			try {
				audioSourceNodeRef.current = ctx.createMediaElementSource(
					audioRef.current,
				);
				audioSourceNodeRef.current.connect(ctx.destination);
			} catch (e) {
				console.error("Source creation failed:", e);
				return null;
			}
		}

		if (audioDestNodeRef.current && audioSourceNodeRef.current) {
			try {
				audioSourceNodeRef.current.disconnect(audioDestNodeRef.current);
			} catch {
				/* ignore */
			}
		}

		try {
			const newDest = ctx.createMediaStreamDestination();
			audioDestNodeRef.current = newDest;
			audioSourceNodeRef.current.connect(newDest);
			return newDest;
		} catch (e) {
			console.error("Destination creation failed:", e);
			return null;
		}
	}, []);

	return { audioRef, audioContextRef, setupAudioGraph };
}
