import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

interface HUDProps {
  round: number;
  beat: number; 
  totalBeats: number;
  words: string[];
}

const HUD: React.FC<HUDProps> = ({ round }) => {

  useTranslation();

  const totalRounds = 5;
  const safeRound = useMemo(() => {
    if (!Number.isFinite(round)) return 1;
    return Math.max(1, Math.min(totalRounds, Math.floor(round)));
  }, [round]);

  return (
    <div
      className="fixed top-0 left-0 w-full z-30 flex justify-center pointer-events-none select-none"
      style={{
        paddingTop: 'max(12px, env(safe-area-inset-top))',
      }}
    >
      <div
        className="
          flex items-center px-5 py-2
          bg-white/30
          border-[3px] border-black/30 rounded-2xl
          shadow-[4px_4px_0px_0px_rgba(0,0,0,0.3)]
          transition-transform duration-300 ease-out hover:scale-105
        "
      >
        <div className="flex items-baseline leading-none">
          <span
            className="text-3xl font-black text-transparent bg-clip-text bg-linear-to-br from-violet-600 to-blue-500"
            style={{ fontFamily: "'Montserrat', sans-serif" }}
          >
            {safeRound}
          </span>

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