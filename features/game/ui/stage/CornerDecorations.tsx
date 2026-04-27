import React, { RefObject } from 'react';

interface CornerDecorationsProps {
  cornerTLRef: RefObject<HTMLDivElement | null>;
  cornerTRRef: RefObject<HTMLDivElement | null>;
  cornerBLRef: RefObject<HTMLDivElement | null>;
  cornerBRRef: RefObject<HTMLDivElement | null>;
}

const CornerDecorations: React.FC<CornerDecorationsProps> = ({ cornerTLRef, cornerTRRef, cornerBLRef, cornerBRRef }) => {
  return (
    <>
      <div ref={cornerTLRef} className="absolute top-2 sm:top-6 left-2 sm:left-6 text-5xl sm:text-7xl drop-shadow-md z-20 select-none pointer-events-none emoji-safe" style={{ transform: 'translate3d(0, 0, 0) rotate(-15deg) scale(1)' }}>🎉</div>
      <div ref={cornerTRRef} className="absolute top-2 sm:top-6 right-2 sm:right-6 text-5xl sm:text-7xl drop-shadow-md z-20 select-none pointer-events-none emoji-safe" style={{ transform: 'translate3d(0, 0, 0) rotate(15deg) scale(1)' }}>🎁</div>
      <div ref={cornerBLRef} className="absolute bottom-2 sm:bottom-6 left-2 sm:left-6 text-5xl sm:text-7xl drop-shadow-md z-20 select-none pointer-events-none emoji-safe" style={{ transform: 'translate3d(0, 0, 0) rotate(-10deg) scale(1)' }}>😎</div>
      <div ref={cornerBRRef} className="absolute bottom-2 sm:bottom-6 right-2 sm:right-6 text-5xl sm:text-7xl drop-shadow-md z-20 select-none pointer-events-none emoji-safe" style={{ transform: 'translate3d(0, 0, 0) rotate(10deg) scale(1)' }}>🐸</div>
    </>
  );
};

export default CornerDecorations;