import type React from "react";
import type { RefObject } from "react";
import CornerDecorations from "./CornerDecorations";
import HUD from "./HUD";

const BASE_W = 1600;
const BASE_H = 800;
const VERTICAL_W = 900;
const VERTICAL_GRID_W = 800;
const CELL_IDS = [
	"cell-0",
	"cell-1",
	"cell-2",
	"cell-3",
	"cell-4",
	"cell-5",
	"cell-6",
	"cell-7",
];

interface GameStageProps {
	show: boolean;
	isMobileVertical: boolean;
	isInIntro: boolean;
	introText: string;
	round: number;
	beat: number;
	totalBeats: number;
	words: string[];
	canvasContainerRef: RefObject<HTMLDivElement | null>;
	canvasRef: RefObject<HTMLCanvasElement | null>;
	viewCanvasRef: RefObject<HTMLCanvasElement | null>;
	shouldRenderOverlay: boolean;
	overlayAlpha: number;
	overlayPattern: readonly number[];
	normalizedWords: string[];
	cornerRefs: {
		tl: RefObject<HTMLDivElement | null>;
		tr: RefObject<HTMLDivElement | null>;
		bl: RefObject<HTMLDivElement | null>;
		br: RefObject<HTMLDivElement | null>;
	};
}

export const GameStage: React.FC<GameStageProps> = ({
	show,
	isMobileVertical,
	isInIntro,
	introText,
	round,
	beat,
	totalBeats,
	words,
	canvasContainerRef,
	canvasRef,
	viewCanvasRef,
	shouldRenderOverlay,
	overlayAlpha,
	overlayPattern,
	normalizedWords,
	cornerRefs,
}) => {
	const overlayCols = isMobileVertical ? 2 : 4;
	const overlayRows = isMobileVertical ? 4 : 2;

	const overlayGridWidth = isMobileVertical
		? `${(VERTICAL_GRID_W / VERTICAL_W) * 100}%`
		: "100%";

	return (
		<div
			className={`absolute inset-0 flex flex-col items-center justify-center p-4 layer-transition ${show ? "visible-layer" : "hidden-layer"}`}
		>
			<CornerDecorations
				cornerTLRef={cornerRefs.tl}
				cornerTRRef={cornerRefs.tr}
				cornerBLRef={cornerRefs.bl}
				cornerBRRef={cornerRefs.br}
			/>

			{show && isInIntro && (
				<div className="absolute inset-0 z-50 flex items-center justify-center pointer-events-none px-4">
					<style>{`
            @keyframes rhythmicMove {
              0%, 100% { 
                transform: translate3d(0, 0, 0); 
                animation-timing-function: cubic-bezier(0.8, 0, 1, 1); 
              }
              50% { 
                transform: translate3d(0, -15%, 0); 
                animation-timing-function: cubic-bezier(0, 0, 0.2, 1); 
              }
            }
          `}</style>
					<h1
						key={introText}
						className="w-full text-center wrap-break-word leading-[0.85] text-[14vw] lg:text-[12rem] font-black text-black tracking-tighter drop-shadow-xl select-none"
						style={{
							fontFamily: "'Montserrat', sans-serif",
							textShadow: "4px 4px 0px #fff, 8px 8px 0px rgba(0,0,0,0.15)",
							maxWidth: "100%",
							wordSpacing: "0.1em",
							animation: "rhythmicMove 1s infinite",
						}}
					>
						{introText}
					</h1>
				</div>
			)}

			{show && !isInIntro && (
				<HUD round={round} beat={beat} totalBeats={totalBeats} words={words} />
			)}

			<div className="relative w-full h-[85svh] max-h-[85svh] flex items-center justify-center z-10 pointer-events-none">
				<div
					ref={canvasContainerRef}
					className="relative w-auto h-auto max-w-full max-h-full pointer-events-auto"
					style={{ transition: "aspect-ratio 0.1s linear" }}
				>
					<canvas
						ref={canvasRef}
						width={BASE_W}
						height={BASE_H}
						className="hidden"
					/>
					<canvas
						ref={viewCanvasRef}
						width={BASE_W}
						height={BASE_H}
						style={{ background: "transparent" }}
						className="block w-full h-full object-contain"
					/>

					{shouldRenderOverlay && (
						<div
							className="absolute inset-0 z-60 pointer-events-none"
							style={{
								opacity: overlayAlpha,
								transition: "opacity 100ms linear",
							}}
						>
							<div
								className="absolute inset-y-0 left-1/2 -translate-x-1/2"
								style={{
									width: overlayGridWidth,
								}}
							>
								<div
									className="grid w-full h-full"
									style={{
										gridTemplateColumns: `repeat(${overlayCols}, 1fr)`,
										gridTemplateRows: `repeat(${overlayRows}, 1fr)`,
									}}
								>
									{overlayPattern.map((q: number, i: number) => {
										const cellKey = CELL_IDS[i] || `fallback-cell-${i}`;
										const safeQ = Number.isFinite(q)
											? Math.max(0, Math.min(3, q))
											: 0;
										const label = normalizedWords[safeQ] ?? "";

										return (
											<div key={cellKey} className="relative w-full h-full">
												<div className="absolute inset-x-0 bottom-[12%] flex justify-center">
													<div className="px-2 py-1 bg-white/90 border-[3px] border-black rounded-lg hard-shadow-sm whitespace-nowrap">
														<span className="block text-[10px] sm:text-xs md:text-sm font-black tracking-wider text-black uppercase leading-none">
															{label.toUpperCase()}
														</span>
													</div>
												</div>
											</div>
										);
									})}
								</div>
							</div>
						</div>
					)}
				</div>
			</div>
		</div>
	);
};
