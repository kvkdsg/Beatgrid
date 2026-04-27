import { useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";

export function useShareVideo(recordedBlob?: Blob, mimeType?: string) {
	const { t } = useTranslation();

	const canShareNative = useMemo(() => {
		if (
			!recordedBlob ||
			!mimeType ||
			typeof navigator === "undefined" ||
			!navigator.canShare
		)
			return false;

		try {
			const cleanMime = mimeType.toLowerCase().includes("mp4")
				? "video/mp4"
				: "video/webm";
			const file = new File(
				[recordedBlob],
				`BeatGrid_Gameplay.${cleanMime.split("/")[1]}`,
				{
					type: cleanMime,
				},
			);
			return navigator.canShare({ files: [file] });
		} catch {
			return false;
		}
	}, [recordedBlob, mimeType]);

	const handleShareVideo = useCallback(async () => {
		if (!recordedBlob) return;
		const rawMime = (mimeType || "video/webm").toLowerCase();
		const isMp4 = rawMime.includes("mp4");
		const extension = isMp4 ? "mp4" : "webm";
		const file = new File([recordedBlob], `BeatGrid_Gameplay.${extension}`, {
			type: isMp4 ? "video/mp4" : "video/webm",
			lastModified: Date.now(),
		});
		try {
			const shareData = {
				files: [file],
				title: t("share.title"),
				text: t("share.text"),
			};
			if (navigator.canShare(shareData)) await navigator.share(shareData);
		} catch (err: unknown) {
			if (err instanceof Error && err.name !== "AbortError")
				alert(t("errors.share.failed"));
		}
	}, [recordedBlob, mimeType, t]);

	return { canShareNative, handleShareVideo };
}
