import { motion, AnimatePresence } from "framer-motion";
import { Save, AlertCircle, CheckCircle2, XCircle } from "lucide-react";
import type { SaveStatus } from "@/types/canvas";
import { cn } from "@/lib/utils";

interface SaveStatusIconProps {
	status: SaveStatus;
}

export function SaveStatusIcon({ status }: SaveStatusIconProps) {
	const config = {
		saving: {
			icon: Save,
			color: "text-primary/90",
			label: "Saving",
		},
		saved: {
			icon: CheckCircle2,
			color: "text-emerald-500/90",
			label: "Saved",
		},
		error: {
			icon: AlertCircle,
			color: "text-destructive/90",
			label: "Error",
		},
	};

	const current = status !== "idle" ? config[status] : null;

	return (
		<AnimatePresence mode="wait">
			{current && (
				<motion.div
					key={status}
					initial={{ opacity: 0, y: 12, scale: 0.9 }}
					animate={{
						opacity: 1,
						y: 0,
						scale: 1,
						transition: { duration: 0.3, ease: [0.22, 1, 0.36, 1] },
					}}
					exit={{
						opacity: 0,
						y: 8,
						scale: 0.95,
						transition: { duration: 0.2, ease: "easeIn" },
					}}
					className="fixed bottom-24 right-6 z-[9999] min-[731px]:bottom-10 min-[731px]:right-10 pointer-events-none select-none"
				>
					<div
						className={cn(
							"flex h-11 w-11 items-center justify-center transition-all duration-300",
							"bg-[#11171E] border border-[#343d4a]/70 shadow-[inset_0_1px_0_rgba(255,255,255,0.04),0_14px_28px_-22px_rgba(0,0,0,0.62)]",
							"rounded-[0.95rem]"
						)}
						title={current.label}
					>
						<current.icon
							className={cn(
								"h-5 w-5 transition-colors duration-300",
								current.color,
								status === "saving" && "animate-pulse"
							)}
						/>
					</div>
				</motion.div>
			)}
		</AnimatePresence>
	);
}
