import { BUY_ME_COFFEE_URL } from "@shared/config/constants";
import type React from "react";
import { useCallback } from "react";
import { useTranslation } from "react-i18next";

interface VideoResultPanelProps {
	showVideoSection: boolean;
	recordedUrl?: string;
	mimeType?: string;
	canShareNative: boolean;
	onShareVideo: () => void;
	onRestartSession: () => void;
	onReset: () => void;
}

export const VideoResultPanel: React.FC<VideoResultPanelProps> = ({
	showVideoSection,
	recordedUrl,
	mimeType,
	canShareNative,
	onShareVideo,
	onRestartSession,
	onReset,
}) => {
	const { t } = useTranslation();

	// Movemos la impureza (Date.now()) al momento exacto en que el usuario interactúa.
	// Esto hace que la fase de renderizado sea 100% pura.
	const handleDownload = useCallback(() => {
		if (!recordedUrl) return;
		const extension = mimeType?.includes("mp4") ? ".mp4" : ".webm";
		const fileName = `BeatGrid_Session_${Date.now()}${extension}`;

		// Creamos un enlace temporal para forzar la descarga del Object URL
		const link = document.createElement("a");
		link.href = recordedUrl;
		link.download = fileName;
		document.body.appendChild(link);
		link.click();
		document.body.removeChild(link);
	}, [recordedUrl, mimeType]);

	return (
		<div className="fixed inset-0 z-999 w-full h-full overflow-y-scroll no-scrollbar animate-flash-overlay backdrop-blur-md flex items-center justify-center">
			<div className="min-h-full w-full flex flex-col items-center justify-center p-4 md:p-8">
				<div className="relative bg-white p-5 md:p-8 border-[6px] border-black hard-shadow flex flex-col items-center gap-6 max-w-4xl w-full box-border animate-slam origin-center">
					<h2 className="text-4xl md:text-6xl font-black text-black uppercase tracking-tighter transform -rotate-2 text-center leading-none mt-2 animate-delay-1">
						{t("end.title")}
					</h2>

					{showVideoSection && (
						<div className="w-full flex flex-col items-center animate-delay-2">
							<div className="w-full md:w-80 mx-auto border-4 border-black bg-zinc-950 relative aspect-video shadow-inner">
								{/* biome-ignore lint/a11y/useMediaCaption: Recorded gameplay video doesn't have captions */}
								<video
									src={recordedUrl}
									controls
									autoPlay
									loop
									className="w-full h-full object-contain"
								/>
							</div>
						</div>
					)}

					<div className="flex flex-col w-full gap-4 mt-2 animate-delay-3">
						<div className="flex flex-col sm:flex-row gap-3 w-full justify-center">
							{canShareNative && (
								<button
									type="button"
									onClick={onShareVideo}
									className="w-full sm:w-auto justify-center bg-[#00ff99] text-black border-4 border-black px-6 py-3 text-sm md:text-lg font-black uppercase hard-shadow hard-shadow-hover transition-all flex items-center gap-2 hover:bg-[#00cc7a]"
								>
									<span>🚀</span>
									<span>{t("actions.share")}</span>
								</button>
							)}
							{recordedUrl && (
								<button
									type="button"
									onClick={handleDownload}
									className="w-full sm:w-auto justify-center bg-white text-black border-4 border-black px-6 py-3 text-sm md:text-lg font-black uppercase hard-shadow hard-shadow-hover transition-all flex items-center gap-2 hover:bg-gray-50"
								>
									<span>⬇</span>
									<span>{t("actions.download")}</span>
								</button>
							)}
							<button
								type="button"
								onClick={onRestartSession}
								className="w-full sm:w-auto bg-white text-black border-4 border-black px-6 py-3 text-sm md:text-lg font-black uppercase hard-shadow hard-shadow-hover transition-all hover:bg-gray-50"
							>
								{t("actions.restart")}
							</button>
							<button
								type="button"
								onClick={onReset}
								className="w-full sm:w-auto bg-[#ffe600] text-black border-4 border-black px-6 py-3 text-sm md:text-lg font-black uppercase hard-shadow hard-shadow-hover transition-all hover:bg-[#ffd500]"
							>
								{t("actions.new")}
							</button>
						</div>
						<div className="flex w-full justify-center mt-1">
							<a
								href={BUY_ME_COFFEE_URL}
								target="_blank"
								rel="noopener noreferrer"
								className="group relative flex items-center justify-center gap-2 bg-[#ff0055] text-white border-4 border-black px-8 py-2 text-xs md:text-sm font-black uppercase tracking-widest hard-shadow transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] active:translate-y-0 active:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
								style={{ fontFamily: "'Montserrat', sans-serif" }}
							>
								<svg
									aria-hidden="true"
									className="w-4 h-4 md:w-5 md:h-5 text-white fill-current"
									viewBox="0 0 24 24"
								>
									<path d="M20,3H4v10c0,2.21,1.79,4,4,4h6c2.21,0,4-1.79,4-4v-3h2c1.1,0,2-0.9,2-2V5C22,3.9,21.1,3,20,3z M20,8h-2V5h2V8z M4,19h16v2H4V19z" />
								</svg>
								<span>{t("actions.support")}</span>
								<div className="absolute inset-0 bg-white opacity-0 group-hover:opacity-10 transition-opacity duration-200 pointer-events-none"></div>
							</a>
						</div>
					</div>
				</div>
			</div>
		</div>
	);
};
