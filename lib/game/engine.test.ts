import { describe, it, expect } from 'vitest';
import { createTimeline, getGameStateAtTime } from './engine';
import { GameSettings } from '../../types';

describe('Game Engine', () => {
  const mockSettings: GameSettings = {
    words:['One', 'Two', 'Three', 'Four'],
    bpm: 120, 
    beatsPerRound: 8,
    seed: 'test-seed'
  };

  describe('createTimeline', () => {
    it('should generate correct timeline properties', () => {
      const timeline = createTimeline(mockSettings);
      
      expect(timeline.msPerBeat).toBe(500); 
      expect(timeline.rounds.length).toBe(5); 
      expect(timeline.totalBeats).toBe(5 * 8); 
      expect(timeline.rounds[0].durationInBeats).toBe(8);
    });
  });

  describe('getGameStateAtTime', () => {
    const timeline = createTimeline(mockSettings);

    it('should return default state for negative time (intro phase)', () => {
      const state = getGameStateAtTime(-1000, timeline);
      expect(state.currentBeat).toBe(0);
      expect(state.isFinished).toBe(false);
      expect(state.activeCellIndex).toBe(-1);
    });

    it('should calculate active cell index correctly during active beats', () => {

      const stateAt0 = getGameStateAtTime(0, timeline);
      expect(stateAt0.activeCellIndex).toBe(0);

      const stateAt250 = getGameStateAtTime(250, timeline);
      expect(stateAt250.activeCellIndex).toBe(1);

      const stateAt1000 = getGameStateAtTime(1000, timeline); 
      expect(stateAt1000.activeCellIndex).toBe(4); 
    });

    it('should finish game when time exceeds total beats', () => {
      const state = getGameStateAtTime(20001, timeline);
      expect(state.isFinished).toBe(true);
      expect(state.currentBeat).toBeGreaterThan(40);
    });

    it('should calculate interpolation during transition beats', () => {

      const state = getGameStateAtTime(2250, timeline);
      
      expect(state.interpolation).toBeGreaterThan(0);
      expect(state.interpolation).toBeLessThan(1);
      expect(state.prevPattern).not.toEqual(state.currentPattern); 
    });

    it('should safely reuse result object for memory optimization', () => {
      const reuseObj = getGameStateAtTime(0, timeline);
      const mutatedObj = getGameStateAtTime(500, timeline, reuseObj);
      
      expect(mutatedObj).toBe(reuseObj); 
      expect(mutatedObj.currentBeat).toBe(1);
    });
  });
});