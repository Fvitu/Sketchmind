import { motion } from "framer-motion";
import { Logo } from "@/components/brand/Logo";

interface LoadingScreenProps {
	message?: string;
}

export function LoadingScreen({ message = "Connecting to room..." }: LoadingScreenProps) {
	return (
		<div className="flex h-screen w-screen flex-col items-center justify-center bg-background text-foreground overflow-hidden">
			{/* Background Glow */}
			<div className="absolute inset-0 overflow-hidden pointer-events-none">
				<div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-primary/10 rounded-full blur-[120px] animate-pulse" />
			</div>

			<motion.div
				initial={{ opacity: 0, scale: 0.9 }}
				animate={{ opacity: 1, scale: 1 }}
				transition={{ duration: 0.5, ease: "easeOut" }}
				className="relative z-10 flex flex-col items-center gap-8">
				<div className="relative">
					{/* Animated Rings */}
					<motion.div
						animate={{ rotate: 360 }}
						transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
						className="absolute inset-[-20px] rounded-full border-2 border-transparent border-t-primary/20 border-r-primary/20"
					/>
					<motion.div
						animate={{ rotate: -360 }}
						transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
						className="absolute inset-[-12px] rounded-full border-2 border-transparent border-b-primary/40 border-l-primary/40"
					/>

					<div className="bg-card/50 backdrop-blur-xl border border-white/5 rounded-2xl p-5 shadow-glow-accent relative z-10">
						<Logo className="scale-125" showWordmark={false} />
					</div>
				</div>

				<div className="flex flex-col items-center gap-4">
					<motion.div
						initial={{ opacity: 0, y: 10 }}
						animate={{ opacity: 1, y: 0 }}
						transition={{ delay: 0.2 }}
						className="flex flex-col items-center">
						<p className="text-xl font-medium tracking-tight text-foreground/90">{message}</p>
						<p className="text-sm text-muted-foreground/60 font-hand text-lg mt-1">Almost there</p>
					</motion.div>

					<div className="w-32 h-1.5 bg-white/5 rounded-full overflow-hidden relative">
						<motion.div
							initial={{ left: "-100%" }}
							animate={{ left: "100%" }}
							transition={{
								duration: 2,
								repeat: Infinity,
								ease: "easeInOut",
							}}
							className="absolute inset-y-0 w-1/2 bg-gradient-brand shadow-[0_0_15px_hsl(195,100%,70%,0.5)]"
						/>
					</div>
				</div>
			</motion.div>

			<motion.div
				initial={{ opacity: 0 }}
				animate={{ opacity: 1 }}
				transition={{ delay: 0.8 }}
				className="absolute bottom-8 text-[10px] uppercase tracking-[0.3em] text-muted-foreground/30 font-semibold">
				Sketchmind • Visual Intelligence
			</motion.div>
		</div>
	);
}
