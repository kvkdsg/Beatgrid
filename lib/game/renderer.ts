import {
  QUADRANT_SIZE,
  SPRITE_RESOLUTION,
} from '../../constants';
import { BoardState } from '../../types';

// USAMOS IMAGEBITMAP PARA MÁXIMO RENDIMIENTO
export type SpriteSource = ImageBitmap | HTMLCanvasElement | HTMLImageElement;

export class CanvasRenderer {
  private ctx: CanvasRenderingContext2D;
  private spritesheet: SpriteSource;
  private activeShadowCache: HTMLCanvasElement | null = null;
  
  constructor(canvas: HTMLCanvasElement, spritesheet: SpriteSource) {
    const context = canvas.getContext('2d', { alpha: true });
    if (!context) throw new Error('Could not get canvas context');
    this.ctx = context;
    this.spritesheet = spritesheet;

    this.ctx.imageSmoothingEnabled = true;
    this.ctx.imageSmoothingQuality = 'high';

    // Validación de dimensiones
    const width = 'width' in this.spritesheet ? this.spritesheet.width : (this.spritesheet as HTMLImageElement).naturalWidth;
    const height = 'height' in this.spritesheet ? this.spritesheet.height : (this.spritesheet as HTMLImageElement).naturalHeight;

    if (width && height && (width !== SPRITE_RESOLUTION || height !== SPRITE_RESOLUTION)) {
      console.warn(`[CanvasRenderer] Spritesheet dimensions mismatch. Got ${width}x${height}, expected ${SPRITE_RESOLUTION}.`);
    }

    this.generateShadowCache();
  }

  private generateShadowCache() {
    const size = 128;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const cx = size / 2;
    const cy = size / 2;
    const radius = size / 2;
    
    const grad = ctx.createRadialGradient(cx, cy, radius * 0.5, cx, cy, radius);
    grad.addColorStop(0, 'rgba(0,0,0,0.6)');
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);
    
    this.activeShadowCache = canvas;
  }

  /**
   * Renderiza el estado del juego en formato ESTÁNDAR 4x2.
   * Aplica CLIPPING por celda para evitar que el pulso contamine casillas adyacentes (Texture Bleeding).
   */
  public render(
    width: number,
    height: number,
    currentPattern: readonly number[] | BoardState,
    prevPattern: readonly number[] | BoardState,
    interpolation: number,
    beatProgress: number, 
    activeCellIndex: number
  ) {
    const ctx = this.ctx;
    const bp = this.clamp01(beatProgress);
    const interp = this.clamp01(interpolation);

    // Limpiar canvas completo
    ctx.clearRect(0, 0, width, height);
    
    let localPulseProgress = bp < 0.5 ? bp * 2 : (bp - 0.5) * 2;
    const pulseIntensity = Math.max(0, 1 - (localPulseProgress * 3.5)); 
    
    // AJUSTE 1: Reducir ligeramente la escala máxima para evitar que el clip corte el brillo de forma brusca
    // Antes 0.15 -> Ahora 0.12
    const pulseScale = 1.0 + (pulseIntensity * 0.12); 

    // AJUSTE 2: Aumentar el gap para dar más "aire" dentro del cuadrante seguro
    // Antes 12 -> Ahora 16
    const gap = 16;
    
    const activeBorderWidth = 8;
    const normalBorderWidth = 4;
    const activeBorderColor = '#00ff99'; 
    const normalBorderColor = '#000000';

    const len = currentPattern.length;

    // Configuración Grid 4x2 Estándar
    const cols = 4;
    const cellW = width / cols; // 400px
    const cellH = height / 2;   // 400px

    for (let i = 0; i < len; i++) {
      const col = i % cols; 
      const row = (i / cols) | 0;

      // Coordenadas absolutas del cuadrante (Safe Zone)
      const quadrantX = col * cellW;
      const quadrantY = row * cellH;

      const drawX = quadrantX + gap;
      const drawY = quadrantY + gap;
      const drawW = cellW - (gap * 2);
      const drawH = cellH - (gap * 2);

      const isActive = (activeCellIndex !== -1 && i === activeCellIndex);

      // --- INICIO AISLAMIENTO (FIX GLITCH VERTICAL) ---
      // Guardamos el estado antes del clip
      ctx.save();
      
      // Definimos la máscara de recorte estricta al cuadrante asignado.
      // NINGÚN píxel (sombra, borde, escalado) podrá salir de aquí.
      ctx.beginPath();
      ctx.rect(quadrantX, quadrantY, cellW, cellH);
      ctx.clip();

      if (isActive) {
        const cx = drawX + drawW / 2;
        const cy = drawY + drawH / 2;

        // Transformaciones locales (Scale/Translate)
        // Nota: Al estar dentro del clip, si escala mucho, se cortará en los bordes del cuadrante, no invadirá al vecino.
        ctx.translate(cx, cy);
        ctx.scale(pulseScale, pulseScale);
        ctx.translate(-cx, -cy);

        if (pulseIntensity > 0.01 && this.activeShadowCache) {
             const shadowMargin = 20 * pulseScale; 
             ctx.globalAlpha = 0.3 + (pulseIntensity * 0.4);
             ctx.drawImage(
                 this.activeShadowCache, 
                 drawX - shadowMargin, 
                 drawY - shadowMargin + (12 * pulseIntensity), 
                 drawW + (shadowMargin * 2), 
                 drawH + (shadowMargin * 2)
             );
             ctx.globalAlpha = 1.0;
        }

        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(drawX, drawY, drawW, drawH);

        if (interp > 0) this.drawCell(prevPattern[i], drawX, drawY, drawW, drawH, interp);
        this.drawCell(currentPattern[i], drawX, drawY, drawW, drawH, 1 - interp);

        ctx.strokeStyle = activeBorderColor;
        ctx.lineWidth = activeBorderWidth;
        ctx.strokeRect(drawX, drawY, drawW, drawH);
        
      } else {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.9)'; 
        ctx.fillRect(drawX, drawY, drawW, drawH);

        if (interp > 0) this.drawCell(prevPattern[i], drawX, drawY, drawW, drawH, interp);
        this.drawCell(currentPattern[i], drawX, drawY, drawW, drawH, 1 - interp);

        ctx.strokeStyle = normalBorderColor;
        ctx.lineWidth = normalBorderWidth;
        ctx.strokeRect(drawX, drawY, drawW, drawH);
      }

      // --- FIN AISLAMIENTO ---
      // Restauramos el contexto (quita el clip y las transformaciones) para la siguiente celda
      ctx.restore();
    }
  }

  private drawCell(quadrantIdx: number, dx: number, dy: number, dw: number, dh: number, alpha: number) {
    if (alpha <= 0.01) return;
    const q = this.clampQuadrantIndex(quadrantIdx);
    const sx = (q % 2) * QUADRANT_SIZE;
    const sy = ((q / 2) | 0) * QUADRANT_SIZE;

    if (alpha < 0.99) this.ctx.globalAlpha = alpha;
    
    this.ctx.drawImage(this.spritesheet as any, sx, sy, QUADRANT_SIZE, QUADRANT_SIZE, dx, dy, dw, dh);

    if (alpha < 0.99) this.ctx.globalAlpha = 1.0;
  }

  private clamp01(v: number) { return v < 0 ? 0 : (v > 1 ? 1 : v); }
  private clampQuadrantIndex(q: number) { return q < 0 ? 0 : (q > 3 ? 3 : q); }
}