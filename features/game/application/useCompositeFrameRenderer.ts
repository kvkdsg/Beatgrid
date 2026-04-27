import { useCallback } from 'react';
import { AppState } from '../model/game.types';
import type { GameState } from '../domain/engine/engine';

const textMetricsCache = new Map<string, number>();

interface CompositeFrameRendererDeps {
  compositeCtxRef: React.MutableRefObject<CanvasRenderingContext2D | null>;
  compositeCanvasRef: React.RefObject<HTMLCanvasElement | null>;
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  cachedBgCanvasRef: React.MutableRefObject<HTMLCanvasElement | null>;
  normalizedWords: string[];
  canvasLabelsRef: React.MutableRefObject<{ roundLabel: string }>;
  appState: AppState;
  isInIntro: boolean;
  introText: string;
  engineStateRef: React.MutableRefObject<GameState | undefined>;
  computeCornerDance: (timeMs: number) => { scale: number; y: number; rot: number };
}

export function useCompositeFrameRenderer({
  compositeCtxRef, compositeCanvasRef, canvasRef, cachedBgCanvasRef,
  normalizedWords, canvasLabelsRef, appState, isInIntro, introText,
  engineStateRef, computeCornerDance
}: CompositeFrameRendererDeps) {
  
  const renderCompositeFrame = useCallback((timeMs: number, opts?: { forceIntro?: boolean; introTextOverride?: string; gameStateOverride?: Partial<GameState> | null }) => {
    const ctx = compositeCtxRef.current; 
    const composite = compositeCanvasRef.current; 
    const gameCanvas = canvasRef.current;
    
    if (!ctx || !composite || !gameCanvas) return;
    const W = composite.width; const H = composite.height;
    
    if (cachedBgCanvasRef.current) ctx.drawImage(cachedBgCanvasRef.current, 0, 0);
    else { ctx.fillStyle = '#e5e5e5'; ctx.fillRect(0, 0, W, H); }

    const safePad = Math.round(H * 0.05); const maxGameW = W - (safePad * 2); const maxGameH = H - (safePad * 2);
    let gameW = gameCanvas.width; let gameH = gameCanvas.height; 
    const scaleFactor = Math.min(maxGameW / gameW, maxGameH / gameH) * 0.9;
    gameW *= scaleFactor; gameH *= scaleFactor;
    const gameX = (W - gameW) / 2; const gameY = (H - gameH) / 2;
    ctx.drawImage(gameCanvas, gameX, gameY, gameW, gameH);

    const currentState = opts?.gameStateOverride;
    if (currentState && currentState.showCellLabels && currentState.cellLabelsAlpha && currentState.cellLabelsAlpha > 0) {
      const pattern = currentState.currentPattern;
      if (Array.isArray(pattern) && pattern.length > 0) {
        ctx.save(); ctx.translate(gameX, gameY);
        const cellW = gameW / 4; const cellH = gameH / 2; ctx.globalAlpha = currentState.cellLabelsAlpha;
        const fontSize = Math.round(cellH * 0.14); ctx.font = `900 ${fontSize}px 'Montserrat', sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        
        pattern.forEach((q, i) => {
          const safeQ = Number.isFinite(q) ? Math.max(0, Math.min(3, q)) : 0; const label = normalizedWords[safeQ]?.toUpperCase() ?? '';
          if (!label) return;
          const col = i % 4; const row = Math.floor(i / 4);
          const x = col * cellW + cellW / 2; const y = row * cellH + (cellH - (cellH * 0.12)); 
          const cacheKey = `${label}-${fontSize}`;
          let textWidth = textMetricsCache.get(cacheKey);
          if (textWidth === undefined) { textWidth = ctx.measureText(label).width; textMetricsCache.set(cacheKey, textWidth); }
          const bgW = textWidth + 32; const bgH = (cellH * 0.14) + 16; 
          ctx.fillStyle = 'rgba(255, 255, 255, 0.9)'; ctx.lineWidth = 3; ctx.strokeStyle = 'black';
          ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(x - bgW/2, y - bgH/2, bgW, bgH, 8); else ctx.rect(x - bgW/2, y - bgH/2, bgW, bgH);
          ctx.fill(); ctx.stroke(); ctx.fillStyle = 'black'; ctx.fillText(label, x, y);
        });
        ctx.restore();
      }
    }

    const { scale, y, rot } = computeCornerDance(timeMs);
    const fontPx = Math.round(H * 0.12); const margin = Math.round(H * 0.04);
    const drawEmoji = (char: string, x: number, yBase: number, baseRot: number, mirror: number) => {
      ctx.save(); ctx.translate(x, yBase + y); ctx.rotate((baseRot + (rot * mirror)) * Math.PI / 180);
      ctx.scale(scale, scale); ctx.font = `${fontPx}px serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(char, 0, 0); ctx.restore();
    };
    drawEmoji('🎉', margin + 50, margin + 50, -15, 1); drawEmoji('🎁', W - margin - 50, margin + 50, 15, -1);
    drawEmoji('😎', margin + 50, H - margin - 50, -10, 1); drawEmoji('🐸', W - margin - 50, H - margin - 50, 10, -1);

    ctx.save();
    const markFontSize = Math.round(H * 0.035); ctx.font = `900 ${markFontSize}px 'Montserrat', sans-serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'bottom'; ctx.shadowColor = 'rgba(0,0,0,1)'; ctx.shadowBlur = 0; ctx.shadowOffsetX = 3; ctx.shadowOffsetY = 3;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.95)'; ctx.fillText("BEAT.BOTON.ONE", W / 2, H - Math.round(H * 0.04));
    ctx.restore();

    const activeIntro = opts?.forceIntro ?? isInIntro;
    const activeState = opts?.gameStateOverride || (appState === AppState.PLAYING ? engineStateRef.current : null);

    if (!activeIntro && activeState && activeState.roundNumber) {
        ctx.save();
        const hudScale = H / 1080; const safeRound = Math.min(5, Math.max(1, Math.floor(activeState.roundNumber)));
        const labelText = canvasLabelsRef.current.roundLabel; const valText = safeRound.toString(); const totalText = "/5";
        const labelFont = `900 ${Math.round(18 * hudScale)}px 'Montserrat', sans-serif`; const valFont = `900 ${Math.round(42 * hudScale)}px 'Montserrat', sans-serif`; const totalFont = `900 ${Math.round(28 * hudScale)}px 'Montserrat', sans-serif`;
        ctx.font = labelFont; const labelM = ctx.measureText(labelText); ctx.font = valFont; const valM = ctx.measureText(valText); ctx.font = totalFont; const totalM = ctx.measureText(totalText);
        const gap1 = 12 * hudScale; const gap2 = 4 * hudScale; const padX = 24 * hudScale; const padY = 12 * hudScale;
        const badgeW = padX + labelM.width + gap1 + valM.width + gap2 + totalM.width + padX;
        const badgeH = Math.max(labelM.actualBoundingBoxAscent + labelM.actualBoundingBoxDescent, valM.actualBoundingBoxAscent + valM.actualBoundingBoxDescent) + (padY * 2);
        const badgeX = (W - badgeW) / 2; const badgeY = Math.max(20, H * 0.05);
        ctx.fillStyle = 'rgba(0,0,0,1)'; ctx.beginPath(); if(ctx.roundRect) ctx.roundRect(badgeX + 4, badgeY + 4, badgeW, badgeH, 16 * hudScale); else ctx.rect(badgeX + 4, badgeY + 4, badgeW, badgeH); ctx.fill();
        ctx.fillStyle = '#ffffff'; ctx.strokeStyle = '#000000'; ctx.lineWidth = 3; ctx.beginPath(); if(ctx.roundRect) ctx.roundRect(badgeX, badgeY, badgeW, badgeH, 16 * hudScale); else ctx.rect(badgeX, badgeY, badgeW, badgeH); ctx.fill(); ctx.stroke();
        let cursorX = badgeX + padX; const centerY = badgeY + (badgeH / 2);
        ctx.font = labelFont; ctx.fillStyle = '#6b7280'; ctx.fillText(labelText, cursorX, centerY); cursorX += labelM.width + gap1;
        ctx.font = valFont; const gradient = ctx.createLinearGradient(cursorX, centerY - 20, cursorX + valM.width, centerY + 20); gradient.addColorStop(0, '#7c3aed'); gradient.addColorStop(1, '#3b82f6');
        ctx.fillStyle = gradient; ctx.fillText(valText, cursorX, centerY + 2); cursorX += valM.width + gap2;
        ctx.font = totalFont; ctx.fillStyle = '#9ca3af'; ctx.fillText(totalText, cursorX, centerY + 2);
        ctx.restore();
    }

    if (appState === AppState.PLAYING && activeIntro) {
      const textToShow = (opts?.introTextOverride ?? introText) || "";
      ctx.save();
      const frameT = timeMs / 1000;
      const introScale = 1 + Math.sin(frameT * 10) * 0.05;
      ctx.translate(W / 2, H / 2); ctx.scale(introScale, introScale);
      const bigFont = Math.round(H * 0.3); ctx.font = `900 ${bigFont}px 'Montserrat', sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillStyle = 'rgba(0,0,0,0.2)'; ctx.fillText(textToShow, 20, 20); ctx.fillStyle = 'black'; ctx.fillText(textToShow, 0, 0);
      ctx.restore();
    }
  },[compositeCtxRef, compositeCanvasRef, canvasRef, cachedBgCanvasRef, normalizedWords, canvasLabelsRef, appState, isInIntro, introText, engineStateRef, computeCornerDance]);

  return { renderCompositeFrame };
}