import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";

interface RenameDialogProps {
	boardId: string;
	currentName: string;
	isOpen: boolean;
	onClose: () => void;
	onRename: (newName: string) => Promise<void>;
}

export function RenameDialog({
	currentName,
	isOpen,
	onClose,
	onRename,
}: RenameDialogProps) {
	const [newName, setNewName] = useState(currentName);
	const [isRenaming, setIsRenaming] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const inputRef = useRef<HTMLInputElement>(null);

	useEffect(() => {
		if (isOpen) {
			setNewName(currentName);
			setError(null);
			// Focus input after a short delay to ensure modal is rendered
			setTimeout(() => inputRef.current?.focus(), 50);
		}
	}, [isOpen, currentName]);

	const handleSubmit = async (e?: React.FormEvent) => {
		e?.preventDefault();
		const trimmed = newName.trim();

		if (!trimmed) {
			setError("Board name cannot be empty");
			return;
		}

		if (trimmed === currentName) {
			onClose();
			return;
		}

		setIsRenaming(true);
		setError(null);

		try {
			await onRename(trimmed);
			onClose();
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to rename board");
		} finally {
			setIsRenaming(false);
		}
	};

	return createPortal(
		<AnimatePresence>
			{isOpen && (
				<div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
					{/* Backdrop */}
					<motion.div
						initial={{ opacity: 0 }}
						animate={{ opacity: 1 }}
						exit={{ opacity: 0 }}
						transition={{ duration: 0.2 }}
						className="fixed inset-0 bg-black/60 backdrop-blur-sm"
						onClick={onClose}
					/>

					{/* Modal Container */}
					<motion.div
						initial={{ opacity: 0, scale: 0.95, y: 10 }}
						animate={{ opacity: 1, scale: 1, y: 0 }}
						exit={{ opacity: 0, scale: 0.95, y: 10 }}
						transition={{ type: "spring", stiffness: 400, damping: 30 }}
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
							Rename Board
						</h2>
						<p className="mb-5 text-sm text-muted-foreground">
							Enter a new name for your board.
						</p>

						<form onSubmit={handleSubmit} className="space-y-4">
							<div className="space-y-2">
								<input
									ref={inputRef}
									value={newName}
									onChange={(e) => setNewName(e.target.value)}
									placeholder="Board name"
									className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 disabled:opacity-50"
									disabled={isRenaming}
									maxLength={15}
								/>
								{error && (
									<motion.p 
										initial={{ opacity: 0, y: -10 }}
										animate={{ opacity: 1, y: 0 }}
										className="text-xs text-destructive"
									>
										{error}
									</motion.p>
								)}
							</div>

							<div className="flex gap-3 pt-2">
								<button
									type="button"
									onClick={onClose}
									className="flex-1 rounded-lg border border-border bg-background py-2 text-sm font-semibold text-foreground hover:bg-accent transition-colors"
									disabled={isRenaming}
								>
									Cancel
								</button>
								<button
									type="submit"
									disabled={isRenaming}
									className="flex-1 rounded-lg bg-primary py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors shadow-lg shadow-primary/20"
								>
									{isRenaming ? "Renaming..." : "Save Changes"}
								</button>
							</div>
						</form>
					</motion.div>
				</div>
			)}
		</AnimatePresence>,
		document.body
	);
}
