// ShareDialog — modal for generating and copying a shareable board link.
import { useState } from "react";
import { createPortal } from "react-dom";

interface ShareDialogProps {
	boardId: string;
	boardName: string;
	isOpen: boolean;
	onClose: () => void;
	onShared?: () => void;
}

export function ShareDialog({ boardId, boardName, isOpen, onClose, onShared }: ShareDialogProps) {
	const [shareUrl, setShareUrl] = useState<string | null>(null);
	const [isCopied, setIsCopied] = useState(false);
	const [isGeneratingLink, setIsGeneratingLink] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const generateLink = async () => {
		if (shareUrl) return;
		setIsGeneratingLink(true);
		setError(null);
		try {
			const res = await fetch(`/api/boards/${encodeURIComponent(boardId)}/share`, {
				method: "POST",
			});
			if (!res.ok) throw new Error("Failed");
			const data = (await res.json()) as { shareUrl: string };
			setShareUrl(`${window.location.origin}${data.shareUrl}`);
			if (onShared) onShared();
		} catch {
			setError("Failed to generate share link");
		} finally {
			setIsGeneratingLink(false);
		}
	};

	const handleCopyLink = async () => {
		if (!shareUrl) return;
		await navigator.clipboard.writeText(shareUrl);
		setIsCopied(true);
		setTimeout(() => setIsCopied(false), 2000);
	};

	// Generate link when dialog opens
	if (isOpen && !shareUrl && !isGeneratingLink && !error) {
		void generateLink();
	}

	if (!isOpen) return null;

	const modalContent = (
		<div
			className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm"
			onClick={onClose}
		>
			<div
				className="relative w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-2xl"
				onClick={(e) => e.stopPropagation()}
			>
				{/* Close button */}
				<button
					onClick={onClose}
					className="absolute right-4 top-4 text-lg text-muted-foreground hover:text-foreground transition-colors"
					aria-label="Close"
				>
					✕
				</button>

				<h2 className="mb-1 text-base font-semibold text-card-foreground">
					Share "{boardName}"
				</h2>
				<p className="mb-5 text-sm text-muted-foreground">
					Anyone with this link can join and edit this board.
				</p>

				{error && (
					<p className="mb-3 text-sm text-destructive">{error}</p>
				)}

				<div className="flex gap-2">
					<input
						readOnly
						value={isGeneratingLink ? "Generating link..." : (shareUrl ?? "")}
						placeholder="Generating link..."
						className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
					/>
					<button
						onClick={() => void handleCopyLink()}
						disabled={!shareUrl || isGeneratingLink}
						className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
					>
						{isCopied ? "✓ Copied!" : "Copy"}
					</button>
				</div>

				<p className="mt-4 text-xs text-muted-foreground">
					The recipient must have a Sketchmind account to edit the board.
				</p>
			</div>
		</div>
	);

	return createPortal(modalContent, document.body);
}
