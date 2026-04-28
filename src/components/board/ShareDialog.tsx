import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ShareDialogProps {
	boardId: string;
	boardName: string;
	isOpen: boolean;
	isShared: boolean;
	onClose: () => void;
	onShared?: () => void;
	onUnshared?: () => void;
}

export function ShareDialog({ boardId, boardName, isOpen, isShared, onClose, onShared, onUnshared }: ShareDialogProps) {
	const [shareUrl, setShareUrl] = useState<string | null>(null);
	const [isCopied, setIsCopied] = useState(false);
	const [isGeneratingLink, setIsGeneratingLink] = useState(false);
	const [isRevoking, setIsRevoking] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [isConfirmOpen, setIsConfirmOpen] = useState(false);

	const fetchLink = async () => {
		setIsGeneratingLink(true);
		setError(null);
		try {
			const res = await fetch(`/api/boards/${encodeURIComponent(boardId)}/share`, {
				method: "GET",
			});
			if (!res.ok) throw new Error("Failed");
			const data = (await res.json()) as { shareUrl: string | null };
			if (data.shareUrl) {
				setShareUrl(`${window.location.origin}${data.shareUrl}`);
			}
		} catch {
			setError("Failed to load share link");
		} finally {
			setIsGeneratingLink(false);
		}
	};

	const generateLink = async () => {
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

	// Fetch link if already shared when dialog opens
	useEffect(() => {
		if (isOpen && isShared && !shareUrl && !isGeneratingLink) {
			void fetchLink();
		}
	}, [isOpen, isShared]);

	const revokeLink = async () => {
		setIsRevoking(true);
		setError(null);
		try {
			const res = await fetch(`/api/boards/${encodeURIComponent(boardId)}/share`, {
				method: "DELETE",
			});
			if (!res.ok) throw new Error("Failed");
			setShareUrl(null);
			if (onUnshared) onUnshared();
			onClose();
		} catch {
			setError("Failed to stop sharing");
		} finally {
			setIsRevoking(false);
		}
	};

	const handleCopyLink = async () => {
		if (!shareUrl) return;
		await navigator.clipboard.writeText(shareUrl);
		setIsCopied(true);
		setTimeout(() => setIsCopied(false), 2000);
	};
	// Reset state when opening/closing
	useEffect(() => {
		if (!isOpen) {
			setShareUrl(null);
			setError(null);
		}
	}, [isOpen]);

	if (!isOpen) return null;

	const modalContent = (
		<>
			<div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
				<div className="relative w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
					{/* Close button */}
					<button
						onClick={onClose}
						className="absolute right-4 top-4 text-lg text-muted-foreground hover:text-foreground transition-colors"
						aria-label="Close">
						✕
					</button>

					<h2 className="mb-1 text-base font-semibold text-card-foreground">Share "{boardName}"</h2>
					<p className="mb-5 text-sm text-muted-foreground">
						{isShared ? "Anyone with this link can join and edit this board." : "Create a shareable link to collaborate with others in real-time."}
					</p>

					{error && <p className="mb-3 text-sm text-destructive">{error}</p>}

					{!isShared && !shareUrl ? (
						<button
							onClick={() => void generateLink()}
							disabled={isGeneratingLink}
							className="w-full rounded-lg bg-primary py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors">
							{isGeneratingLink ? "Creating Room..." : "Create Shareable Link"}
						</button>
					) : (
						<div className="space-y-4">
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
									className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors">
									{isCopied ? "✓ Copied!" : "Copy"}
								</button>
							</div>

							<div className="flex justify-between items-center pt-2">
								<p className="text-xs text-muted-foreground">Public link is active</p>
								<button
									onClick={() => setIsConfirmOpen(true)}
									disabled={isRevoking}
									className="text-xs font-medium text-destructive hover:underline disabled:opacity-50">
									{isRevoking ? "Stopping..." : "Stop sharing & delete room"}
								</button>
							</div>
						</div>
					)}

					<p className="mt-6 text-xs text-muted-foreground">The recipient must have a Sketchmind account to edit the board.</p>
				</div>
			</div>

			<AlertDialog open={isConfirmOpen} onOpenChange={setIsConfirmOpen}>
				<AlertDialogContent overlayClassName="z-[200]" className="z-[201] max-w-[400px] border-border/50 bg-card/95 backdrop-blur-xl shadow-2xl">
					<AlertDialogHeader>
						<AlertDialogTitle className="text-lg font-bold tracking-tight">Stop sharing?</AlertDialogTitle>
						<AlertDialogDescription className="text-sm leading-relaxed text-muted-foreground">
							Are you sure you want to stop sharing? This will delete the LiveBlocks room and invalidate the link.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter className="mt-6 gap-3">
						<AlertDialogCancel className="mt-0 border-border/50 bg-background/50 hover:bg-accent transition-all duration-200">
							Cancel
						</AlertDialogCancel>
						<AlertDialogAction
							onClick={() => void revokeLink()}
							className={cn(
								buttonVariants({ variant: "destructive" }),
								"bg-destructive/90 hover:bg-destructive shadow-lg shadow-destructive/20 transition-all duration-200",
							)}>
							Stop Sharing
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</>
	);

	return createPortal(modalContent, document.body);
}
