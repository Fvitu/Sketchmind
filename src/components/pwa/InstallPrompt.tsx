"use client";
/**
 * InstallPrompt
 * Shows a native-feeling install banner for Android/Desktop (using the
 * Web Install API `beforeinstallprompt` event) and a manual instruction
 * overlay for iOS Safari (where the native API is unavailable).
 *
 * Mount this component ONLY inside the dashboard shell — never inside
 * the canvas editor.
 */

import { useEffect, useState } from "react";
import { X, Download, Share } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { pwaStore } from "@/lib/pwa";

type Platform = "android" | "ios" | "desktop" | null;

function detectPlatform(): Platform {
	const ua = navigator.userAgent;
	const isIOS = /iphone|ipad|ipod/i.test(ua) && !(window as unknown as { MSStream?: unknown }).MSStream;
	const isAndroid = /android/i.test(ua);
	if (isIOS) return "ios";
	if (isAndroid) return "android";
	return "desktop";
}

function isInStandaloneMode(): boolean {
	return window.matchMedia("(display-mode: standalone)").matches || (window.navigator as unknown as { standalone?: boolean }).standalone === true;
}

const DISMISSED_KEY = "sketchmind_install_dismissed";
const DISMISS_TTL = 7 * 24 * 60 * 60 * 1000; // 7 days

export function InstallPrompt() {
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const [deferredPrompt, setDeferredPrompt] = useState<any>(pwaStore.getDeferredPrompt());
	const [platform, setPlatform] = useState<Platform>(null);
	const [visible, setVisible] = useState(false);
	const [expanded, setExpanded] = useState(false);

	useEffect(() => {
		// Already installed — never show
		if (isInStandaloneMode()) return;

		// Already dismissed within the TTL — skip
		const dismissed = localStorage.getItem(DISMISSED_KEY);
		if (dismissed && Date.now() - Number(dismissed) < DISMISS_TTL) return;

		const p = detectPlatform();
		setPlatform(p);

		// ── Timer for Manual Fallback ──────────────────────────────────────
		// If the native prompt doesn't fire after 10s, we show manual instructions
		const manualTimeout = setTimeout(() => {
			if (!visible) {
				console.log("⏰ PWA: Native prompt timed out, showing manual instructions");
				setVisible(true);
			}
		}, 10000);

		// ── iOS: Manual only ───────────────────────────────────────────────
		if (p === "ios") {
			const iosTimeout = setTimeout(() => setVisible(true), 5000);
			return () => {
				clearTimeout(iosTimeout);
				clearTimeout(manualTimeout);
			};
		}

		// ── Android / Desktop: Listen for native event ──────────────────────
		const unsubscribe = pwaStore.subscribe((prompt) => {
			setDeferredPrompt(prompt);
			if (prompt && !visible) {
				// Show native banner after a small delay
				setTimeout(() => setVisible(true), 3000);
				clearTimeout(manualTimeout);
			}
		});

		return () => {
			unsubscribe();
			clearTimeout(manualTimeout);
		};
	}, []);

	const handleInstall = async () => {
		if (!deferredPrompt) {
			// If no native prompt, just expand instructions
			setExpanded(true);
			return;
		}
		try {
			deferredPrompt.prompt();
			const { outcome } = await deferredPrompt.userChoice;
			if (outcome === "accepted") {
				setVisible(false);
				pwaStore.clear();
			}
			setDeferredPrompt(null);
		} catch (err) {
			console.error("PWA: Install error", err);
		}
	};

	const handleDismiss = () => {
		setVisible(false);
		localStorage.setItem(DISMISSED_KEY, String(Date.now()));
	};

	const base =
		"fixed bottom-[calc(var(--nav-pill-height,72px)+16px)] left-4 right-4 z-50 " +
		"rounded-2xl border border-white/10 shadow-2xl overflow-hidden " +
		"bg-[rgba(18,18,18,0.96)] backdrop-blur-xl";

	return (
		<AnimatePresence>
			{visible && (
				<motion.div
					initial={{ opacity: 0, y: 20, scale: 0.95 }}
					animate={{ opacity: 1, y: 0, scale: 1 }}
					exit={{ opacity: 0, y: 10, scale: 0.95 }}
					transition={{ type: "spring", damping: 25, stiffness: 300 }}
					className={[base, "sm:right-6 sm:left-auto sm:translate-x-0 sm:w-auto sm:max-w-[420px]"].join(" ")}>
					{/* Main Banner Body */}
					<div className="flex items-center gap-3 p-4">
						<img
							src={platform === "ios" ? "/icons/apple-touch-icon.png" : "/icons/icon-192x192.png"}
							alt="Sketchmind"
							width={44}
							height={44}
							className="rounded-xl flex-shrink-0 shadow-lg border-white/5"
						/>
						<div className="flex-1 min-w-0">
							<p className="text-white text-sm font-semibold leading-snug">{platform === "ios" ? "Add to Home Screen" : "Install Sketchmind"}</p>
							<p className="text-white/50 text-xs mt-0.5 truncate">
								{platform === "ios"
									? "For the best experience, install the app."
									: `Add to your ${platform === "desktop" ? "desktop" : "home screen"} for quick access.`}
							</p>
						</div>
						<div className="flex items-center gap-2 flex-shrink-0">
							<motion.button
								whileHover={{ scale: 1.1, rotate: 90 }}
								whileTap={{ scale: 0.9 }}
								aria-label="Dismiss"
								onClick={handleDismiss}
								className="text-white/40 hover:text-white/70 p-1 transition-colors">
								<X size={16} />
							</motion.button>

							{deferredPrompt ? (
								<motion.button
									whileHover="hover"
									whileTap="tap"
									onClick={() => void handleInstall()}
									className="group/install flex items-center gap-2 px-4 py-2 rounded-xl
                             bg-gradient-brand text-primary-foreground
                             hover:opacity-95 transition-all
                             hover:scale-[1.03] active:scale-95
                             font-semibold text-xs shadow-soft">
									<motion.div
										variants={{
											hover: { y: [0, -3, 0], transition: { repeat: Infinity, duration: 0.6 } },
											tap: { scale: 0.85 },
										}}>
										<Download size={14} strokeWidth={2.5} />
									</motion.div>
									<span>Install</span>
								</motion.button>
							) : (
								<motion.button
									whileHover={{ scale: 1.05 }}
									whileTap={{ scale: 0.95 }}
									onClick={() => setExpanded(!expanded)}
									className="px-3 py-2 text-cyan-400 hover:text-cyan-300 text-xs font-semibold transition-colors">
									{expanded ? "Hide" : "Manual"}
								</motion.button>
							)}
						</div>
					</div>

					{/* Manual Instructions (shown if expanded or iOS) */}
					<AnimatePresence>
						{(expanded || (platform === "ios" && expanded)) && (
							<motion.div
								initial={{ height: 0, opacity: 0 }}
								animate={{ height: "auto", opacity: 1 }}
								exit={{ height: 0, opacity: 0 }}
								className="border-t border-white/5 overflow-hidden">
								<div className="px-4 py-4 space-y-3.5 bg-white/[0.02]">
									{platform === "ios"
										? // iOS Instructions
											[
												{
													icon: <Share size={13} />,
													text: (
														<>
															Tap <strong>Share</strong> in Safari&apos;s toolbar
														</>
													),
												},
												{
													icon: <span className="text-xs font-bold">+</span>,
													text: (
														<>
															Select <strong>&quot;Add to Home Screen&quot;</strong>
														</>
													),
												},
											].map((step, i) => <InstructionStep key={i} icon={step.icon} text={step.text} />)
										: // Android / Desktop Instructions
											[
												{
													icon: <span className="text-xs font-bold">⋮</span>,
													text: (
														<>
															Tap the <strong>three dots</strong> (menu) in Chrome
														</>
													),
												},
												{
													icon: <Download size={13} />,
													text: (
														<>
															Select <strong>&quot;Install App&quot;</strong> or <strong>&quot;Add to Home Screen&quot;</strong>
														</>
													),
												},
											].map((step, i) => <InstructionStep key={i} icon={step.icon} text={step.text} />)}
									<p className="text-[10px] text-white/30 pt-1">Note: Native prompt may be hidden by browser frequency limits.</p>
								</div>
							</motion.div>
						)}
					</AnimatePresence>
				</motion.div>
			)}
		</AnimatePresence>
	);
}

function InstructionStep({ icon, text }: { icon: React.ReactNode; text: React.ReactNode }) {
	return (
		<div className="flex items-start gap-3">
			<div className="w-5 h-5 rounded-full bg-cyan-500/15 flex items-center justify-center text-cyan-400 flex-shrink-0 mt-0.5">{icon}</div>
			<p className="text-white/70 text-[11px] leading-relaxed">{text}</p>
		</div>
	);
}
