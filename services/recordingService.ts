import { RecordingConfig, RecordingResult } from '../types';

export class CanvasRecordingService {
  private mediaRecorder: MediaRecorder | null = null;
  private recordedChunks: Blob[] = [];
  private startTime: number = 0;
  private resolveRecording: ((result: RecordingResult) => void) | null = null;
  private rejectRecording: ((error: Error) => void) | null = null;
  private isProcessingFinalization: boolean = false;

  // Guardamos el stream principal para gestión de tracks
  private stream: MediaStream | null = null;

  /**
   * Bloquea la promesa hasta que el MediaRecorder confirma que ha iniciado.
   * Evita condiciones de carrera donde el audio arranca antes que el encoder.
   */
  private waitForRecorderStart(mr: MediaRecorder): Promise<void> {
    return new Promise((resolve, reject) => {
      if (mr.state === 'recording') return resolve();

      const onStart = () => {
        mr.removeEventListener('error', onError as EventListener);
        resolve();
      };
      const onError = (e: Event) => {
        mr.removeEventListener('start', onStart);
        // @ts-ignore
        const error = (e as any).error || new Error('MediaRecorder start error');
        reject(error);
      };

      mr.addEventListener('start', onStart, { once: true });
      mr.addEventListener('error', onError, { once: true });
    });
  }

  public async startRecording(config: RecordingConfig): Promise<void> {
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      console.warn('[RecordingService] Grabación ya activa.');
      return;
    }

    this.cleanupState();
    this.recordedChunks = [];
    this.startTime = performance.now();
    this.isProcessingFinalization = false;

    const fps = config.frameRate ?? 60;

    // 1. Obtener Stream del Canvas (BASE)
    try {
      // @ts-ignore
      this.stream = config.canvas.captureStream
        ? config.canvas.captureStream(fps)
        : (config.canvas as any).mozCaptureStream(fps);
    } catch (e) {
      throw new Error(`Error capturando canvas: ${e}`);
    }

    if (!this.stream) throw new Error('No se pudo obtener el stream del canvas.');

    // Asegurar que el track de video esté activo
    const videoTrack = this.stream.getVideoTracks()[0];
    if (!videoTrack) throw new Error('El canvas no generó tracks de video.');
    videoTrack.enabled = true;

    // 2. Añadir Audio al Stream del Canvas (sin romper el objeto Stream original)
    if (config.audioTrack && config.audioTrack.readyState === 'live') {
      this.stream.addTrack(config.audioTrack);
    }

    // 3. Configuración de Codecs
    const mimeType = this.getBestPerformanceMimeType();
    const options: MediaRecorderOptions = {
      videoBitsPerSecond: config.videoBitsPerSecond ?? 2_500_000,
      mimeType: mimeType || undefined
    };

    if (config.audioBitsPerSecond) {
      options.audioBitsPerSecond = config.audioBitsPerSecond ?? 128000;
    }

    try {
      this.mediaRecorder = new MediaRecorder(this.stream, options);
    } catch (e) {
      console.warn(`[RecordingService] Fallback codec: ${e}`);
      try {
        this.mediaRecorder = new MediaRecorder(this.stream, {
          videoBitsPerSecond: options.videoBitsPerSecond
        });
      } catch (e2) {
        this.cleanupState();
        throw new Error(`MediaRecorder no soportado: ${e2}`);
      }
    }

    if (!this.mediaRecorder) {
      this.cleanupState();
      throw new Error('MediaRecorder no instanciado.');
    }

    this.mediaRecorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) this.recordedChunks.push(e.data);
    };

    this.mediaRecorder.onerror = (e: any) => {
      console.error('[RecordingService] Error interno:', e.error);
      if (this.rejectRecording) {
        this.rejectRecording(e.error || new Error('Unknown Recorder Error'));
      }
      this.cancelRecording();
    };

    this.mediaRecorder.onstop = () => this.handleRecordingStop();

    // 4. ARRANQUE SINCRONIZADO
    try {
      /**
       * CORRECCIÓN CLAVE (compatibilidad edición / metadatos duración):
       * - No usar timeslice (start(1000)) para evitar archivos "no seekable" o con duración incorrecta en editores.
       * - Con start() sin timeslice, el navegador suele generar un contenedor final más consistente.
       */
      this.mediaRecorder.start();
      await this.waitForRecorderStart(this.mediaRecorder);
      console.log(
        `[RecordingService] GRABANDO | ${this.mediaRecorder.mimeType} | FPS: ${fps}`
      );
    } catch (e) {
      this.cleanupState();
      throw new Error(`Error al iniciar grabación: ${e}`);
    }
  }

  public stopRecording(): Promise<RecordingResult> {
    return new Promise((resolve, reject) => {
      if (!this.mediaRecorder || this.mediaRecorder.state === 'inactive') {
        this.cleanupState();
        return reject(new Error('No hay grabación activa.'));
      }

      this.resolveRecording = resolve;
      this.rejectRecording = reject;

      try {
        /**
         * CORRECCIÓN CLAVE:
         * - Evitar requestData() justo antes de stop() cuando no hay timeslice.
         *   En ciertos flujos puede contribuir a fragmentación/metadatos inconsistentes.
         */
        this.mediaRecorder.stop();
      } catch (e) {
        this.handleRecordingStop();
      }
    });
  }

  public cancelRecording(): void {
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      try {
        this.mediaRecorder.stop();
      } catch {}
    }
    this.cleanupState();
  }

  private cleanupState(): void {
    // Detener tracks para liberar hardware
    if (this.stream) {
      this.stream.getTracks().forEach((t) => t.stop());
    }
    this.stream = null;
    this.recordedChunks = [];
    this.mediaRecorder = null;
    this.resolveRecording = null;
    this.rejectRecording = null;
  }

  private handleRecordingStop(): void {
    if (this.isProcessingFinalization) return;
    this.isProcessingFinalization = true;

    /**
     * Nota: se mantiene un pequeño delay para dar tiempo a que llegue el último dataavailable
     * en implementaciones que lo entregan al final del ciclo.
     */
    setTimeout(() => {
      // Capturar referencias locales ANTES de limpiar estado, evitando carreras.
      const resolve = this.resolveRecording;
      const reject = this.rejectRecording;

      if (!resolve) {
        // Si no hay promesa pendiente (p.ej. cancelRecording), limpiar y salir.
        this.cleanupState();
        return;
      }

      const finalMime = this.mediaRecorder?.mimeType || 'video/webm';
      const duration = performance.now() - this.startTime;

      const blob = new Blob(this.recordedChunks, { type: finalMime });
      const url = URL.createObjectURL(blob);

      if (blob.size === 0 && reject) {
        reject(new Error('Grabación vacía.'));
      } else {
        resolve({
          blob,
          url,
          mimeType: finalMime,
          durationMs: duration
        });
      }

      // Limpieza definitiva y liberación de recursos (tracks + refs internas)
      this.cleanupState();
      this.isProcessingFinalization = false;
    }, 100);
  }

  private getBestPerformanceMimeType(): string {
    /**
     * CORRECCIÓN CLAVE:
     * - Priorizar WebM para máxima compatibilidad "seekable" en flujos MediaRecorder.
     * - Dejar MP4 sólo como último recurso (muchos editores sufren con MP4 fragmentado generado por MediaRecorder).
     */
    const types = [
      'video/webm;codecs=vp9,opus',
      'video/webm;codecs=vp8,opus',
      'video/webm;codecs=h264,opus',
      'video/webm',
      'video/mp4;codecs=avc1,mp4a.40.2',
      'video/mp4'
    ];
    return types.find((t) => MediaRecorder.isTypeSupported(t)) || '';
  }

  public static isSupported() {
    return (
      typeof MediaRecorder !== 'undefined' &&
      (typeof HTMLCanvasElement.prototype.captureStream === 'function' ||
        typeof (HTMLCanvasElement.prototype as any).mozCaptureStream === 'function')
    );
  }
}
