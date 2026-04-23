import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

interface HUDProps {
  round: number;
  beat: number; // Nota: en tu app esto es currentBeat (float)
  totalBeats: number;
  words: string[];
}

const HUD: React.FC<HUDProps> = ({ round }) => {
  // Hook listo para cuando quieras añadir labels (sin cambiar UI actual).
  // Se mantiene aunque no se use para no alterar el render.
  useTranslation();

  // Lógica de datos:
  // Se mantiene totalRounds = 5 como en la referencia original.
  // Se asegura que 'safeRound' sea un número válido para evitar renders rotos.
  const totalRounds = 5;
  const safeRound = useMemo(() => {
    if (!Number.isFinite(round)) return 1;
    // Clamp opcional: asegurar que visualmente no exceda límites lógicos si el motor se desborda
    return Math.max(1, Math.min(totalRounds, Math.floor(round)));
  }, [round]);

  return (
    <div
      // CONTENEDOR PRINCIPAL:
      // - fixed: Para que flote sobre el canvas/video independientemente del scroll.
      // - z-30: Mantiene la capa visual correcta.
      // - pointer-events-none: Permite hacer clic en el juego "a través" del HUD.
      // - top-0 + pt-[...]: Usa safe-area-inset-top para respetar el notch en móviles,
      //   más un pequeño margen base (max(12px...)) para el "margen mínimo" solicitado.
      className="fixed top-0 left-0 w-full z-30 flex justify-center pointer-events-none select-none"
      style={{
        paddingTop: 'max(12px, env(safe-area-inset-top))',
      }}
    >
      {/*
          BADGE / STICKER DEL CONTADOR:
          - Diseño "Clean Transparent":
          - Fondo: Blanco con 30% opacidad (70% transp) SIN BLUR.
          - Borde: Negro con 30% opacidad.
          - Sombra: Negra con 30% opacidad.
      */}
      <div
        className="
          flex items-center px-5 py-2
          bg-white/30
          border-[3px] border-black/30 rounded-2xl
          shadow-[4px_4px_0px_0px_rgba(0,0,0,0.3)]
          transition-transform duration-300 ease-out hover:scale-105
        "
      >
        {/* VALOR NUMÉRICO "1/5" */}
        <div className="flex items-baseline leading-none">
          {/* Número Actual: Colorido (Gradiente Púrpura/Azul para destacar) */}
          <span
            className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-br from-violet-600 to-blue-500"
            style={{ fontFamily: "'Montserrat', sans-serif" }}
          >
            {safeRound}
          </span>

          {/* Separador y Total: Gris neutro para jerarquía visual */}
          <span
            className="text-xl font-black text-gray-400 ml-1"
            style={{ fontFamily: "'Montserrat', sans-serif" }}
          >
            /{totalRounds}
          </span>
        </div>
      </div>
    </div>
  );
};

export default HUD;
