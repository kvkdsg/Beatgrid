import { useRef, useCallback } from 'react';
import { DEFAULT_BPM } from '../model/game.constants';

const TAU = Math.PI * 2;
const clamp01 = (v: number) => Math.max(0, Math.min(1, Number.isNaN(v) ? 0 : v));
const easeOutCubic = (x: number) => 1 - Math.pow(1 - clamp01(x), 3);
const beatPulse = (phase01: number) => {
  const tVal = Math.min(1, clamp01(phase01) * 3.5);
  return 1 - easeOutCubic(tVal);
};

export function useCornerAnimation() {
  const cornerTLRef = useRef<HTMLDivElement>(null);
  const cornerTRRef = useRef<HTMLDivElement>(null);
  const cornerBLRef = useRef<HTMLDivElement>(null);
  const cornerBRRef = useRef<HTMLDivElement>(null);

  const computeCornerDance = useCallback((timeMs: number) => {
    const bpm = DEFAULT_BPM; 
    const beats = (timeMs / 1000) * (bpm / 60); 
    const phase = beats - Math.floor(beats);
    const pulse = beatPulse(phase); 
    const swing = Math.sin(beats * TAU); 
    const scale = 1 + pulse * 0.12;
    const y = (-6 * pulse) + (2.5 * swing); 
    const rot = (8 * swing) + (6 * pulse);
    return { scale, y, rot };
  },[]);

  const resetCornerTransform = useCallback(() => {
    const set = (el: HTMLDivElement | null, deg: number) => { 
        if (el) el.style.transform = `translate3d(0, 0, 0) rotate(${deg}deg) scale(1)`; 
    };
    set(cornerTLRef.current, -15); 
    set(cornerTRRef.current, 15);
    set(cornerBLRef.current, -10); 
    set(cornerBRRef.current, 10);
  },[]);

  const applyCornerDance = useCallback((timeMs: number) => {
    const { scale, y, rot } = computeCornerDance(timeMs);
    const set = (el: HTMLDivElement | null, baseRot: number, mirror: number) => {
      if (el) el.style.transform = `translate3d(0, ${y}px, 0) rotate(${baseRot + (rot * mirror)}deg) scale(${scale})`;
    };
    set(cornerTLRef.current, -15, 1); 
    set(cornerTRRef.current, 15, -1);
    set(cornerBLRef.current, -10, 1); 
    set(cornerBRRef.current, 10, -1);
  }, [computeCornerDance]);

  return {
    cornerTLRef, cornerTRRef, cornerBLRef, cornerBRRef,
    computeCornerDance, resetCornerTransform, applyCornerDance
  };
}