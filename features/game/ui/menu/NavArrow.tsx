import React from 'react';

interface NavArrowProps {
  direction: 'left' | 'right';
  onClick: () => void;
  disabled?: boolean;
  ariaLabel: string;
}

const NavArrow: React.FC<NavArrowProps> = ({ direction, onClick, disabled, ariaLabel }) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    className={`group relative flex items-center justify-center w-10 h-10 md:w-14 md:h-14 bg-white border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] shrink-0 rounded-lg transition-all duration-150 ${disabled ? 'opacity-50 cursor-not-allowed shadow-none transform-none' : 'hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] hover:-translate-y-0.5 active:translate-y-0 active:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]'}`}
    aria-label={ariaLabel}
  >
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" 
        className={`w-5 h-5 md:w-7 md:h-7 text-black transition-transform group-hover:scale-110 ${direction === 'right' ? 'rotate-180' : ''}`}>
      <path d="M19 12H5M12 19l-7-7 7-7" />
    </svg>
  </button>
);

export default NavArrow;