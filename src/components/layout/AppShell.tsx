import { useState, useEffect, useLayoutEffect, useRef, useCallback } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { LayoutGrid, User as UserIcon } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Logo } from "@/components/brand/Logo";
import { useAuthUser } from "@/lib/store";
import { cn } from "@/lib/utils";
import { InstallPrompt } from "@/components/pwa/InstallPrompt";

type NavTab = "dashboard" | "profile";

let lastActiveNavTab: NavTab | null = null;

const navItemClasses =
	"group/nav relative flex flex-col items-center justify-center p-[6px_16px] sm:p-[6px_20px] transition-colors duration-100 ease-out focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary rounded-full";

const MotionNavLink = motion(NavLink);

export const AppShell = () => {
	const user = useAuthUser();
	const location = useLocation();
	const [scrolled, setScrolled] = useState(false);
	const navRef = useRef<HTMLElement | null>(null);
	const dashboardRef = useRef<HTMLAnchorElement | null>(null);
	const profileRef = useRef<HTMLAnchorElement | null>(null);
	const [activePill, setActivePill] = useState({
		x: 0,
		width: 0,
		top: 0,
		height: 0,
		ready: false,
	});

	const activeTab: NavTab = location.pathname.startsWith("/profile") ? "profile" : "dashboard";

	const measureTab = useCallback((tab: NavTab) => {
		const navEl = navRef.current;
		const tabEl = tab === "profile" ? profileRef.current : dashboardRef.current;
		if (!navEl || !tabEl) return null;

		const navRect = navEl.getBoundingClientRect();
		const tabRect = tabEl.getBoundingClientRect();
		return {
			x: tabRect.left - navRect.left,
			width: tabRect.width,
			top: tabRect.top - navRect.top,
			height: tabRect.height,
			ready: true,
		};
	}, []);

	const updateActivePill = useCallback(() => {
		const next = measureTab(activeTab);
		if (!next) return;

		setActivePill((prev) => {
			const sameX = Math.abs(prev.x - next.x) < 0.5;
			const sameWidth = Math.abs(prev.width - next.width) < 0.5;
			const sameTop = Math.abs(prev.top - next.top) < 0.5;
			const sameHeight = Math.abs(prev.height - next.height) < 0.5;
			if (prev.ready && sameX && sameWidth && sameTop && sameHeight) return prev;
			return next;
		});
	}, [activeTab, measureTab]);

	useEffect(() => {
		const handleScroll = () => {
			const offset = window.pageYOffset || document.documentElement.scrollTop;
			setScrolled(offset > 8);
		};
		window.addEventListener("scroll", handleScroll, { passive: true });
		handleScroll(); // Initial check
		return () => window.removeEventListener("scroll", handleScroll);
	}, []);

	useEffect(() => {
		setScrolled(false);
	}, [location.pathname]);

	useLayoutEffect(() => {
		const to = measureTab(activeTab);
		if (!to) return;

		const fromTab = lastActiveNavTab && lastActiveNavTab !== activeTab ? lastActiveNavTab : activeTab;
		const from = measureTab(fromTab);

		if (!from || fromTab === activeTab) {
			setActivePill(to);
			lastActiveNavTab = activeTab;
			return;
		}

		setActivePill(from);
		const frame = window.requestAnimationFrame(() => {
			setActivePill(to);
			lastActiveNavTab = activeTab;
		});

		return () => window.cancelAnimationFrame(frame);
	}, [activeTab, measureTab, location.pathname]);

	useEffect(() => {
		const handleResize = () => updateActivePill();
		window.addEventListener("resize", handleResize);
		window.visualViewport?.addEventListener("resize", handleResize);

		const observer = new ResizeObserver(handleResize);
		if (navRef.current) observer.observe(navRef.current);
		if (dashboardRef.current) observer.observe(dashboardRef.current);
		if (profileRef.current) observer.observe(profileRef.current);

		return () => {
			window.removeEventListener("resize", handleResize);
			window.visualViewport?.removeEventListener("resize", handleResize);
			observer.disconnect();
		};
	}, [updateActivePill]);

	useEffect(() => {
		lastActiveNavTab = activeTab;
	}, [activeTab]);

	if (!user) return null;

	return (
		<div className="relative min-h-screen bg-background flex flex-col overflow-x-hidden">
			<div aria-hidden="true" className="page-reactive-glow" />

			{/* Top Bar with Glassmorphism */}
			<header
				className={cn(
					"fixed top-0 left-0 right-0 z-40 h-16 flex items-center px-4 sm:px-6 transition-all duration-300 border-b",
					scrolled
						? "bg-background/80 backdrop-blur-lg border-border/40 shadow-lg shadow-black/5"
						: "bg-background/40 backdrop-blur-md border-border/10 sm:bg-transparent sm:backdrop-blur-none sm:border-transparent",
				)}
				style={{
					WebkitBackdropFilter: scrolled ? "blur(12px) saturate(160%)" : "blur(8px) saturate(120%)",
				}}>
				<Logo />
			</header>

			<main className="relative z-10 flex-1 min-w-0 pb-[100px] pt-[72px] sm:pt-[80px]">
				<div className="mx-auto max-w-6xl w-full px-5 md:px-8">
					<AnimatedOutlet />
				</div>
			</main>

			{/* Floating Bottom Nav Bar */}
			<nav
				ref={navRef}
				className="fixed bottom-4 sm:bottom-7 left-4 sm:left-1/2 w-[calc(100%-32px)] sm:w-auto sm:-translate-x-1/2 z-50 flex items-stretch sm:items-center justify-center gap-1 rounded-full"
				style={{
					backgroundColor: "rgba(15, 15, 15, 0.85)",
					backdropFilter: "blur(20px) saturate(180%)",
					WebkitBackdropFilter: "blur(20px) saturate(180%)",
					border: "1px solid rgba(255, 255, 255, 0.08)",
					boxShadow: "0 8px 32px rgba(0, 0, 0, 0.5)",
					padding: "4px 6px",
				}}>
				{activePill.ready && (
					<motion.div
						aria-hidden="true"
						className="pointer-events-none absolute bg-[rgba(255,255,255,0.1)] rounded-full"
						style={{
							left: 0,
							top: activePill.top,
							height: activePill.height,
						}}
						initial={false}
						animate={{ x: activePill.x, width: activePill.width }}
						transition={{ type: "spring", stiffness: 320, damping: 32, mass: 0.85 }}
					/>
				)}
				<MotionNavLink
					ref={dashboardRef}
					to="/dashboard"
					aria-label="Boards"
					whileHover="hover"
					className={({ isActive }) =>
						cn(
							navItemClasses,
							"flex-1 sm:flex-none",
							isActive ? "text-[#22d3ee]" : "text-[rgba(255,255,255,0.45)] hover:text-[rgba(255,255,255,0.7)]",
						)
					}>
					<motion.div
						variants={{
							hover: { rotate: 90, scale: 1.1 },
						}}
						transition={{ type: "spring", stiffness: 400, damping: 15 }}
					>
						<LayoutGrid className="relative z-10 h-[18px] w-[18px] mb-[3px]" />
					</motion.div>
					<span className="relative z-10 text-[10px] font-medium tracking-[0.02em]">Boards</span>
				</MotionNavLink>

				<MotionNavLink
					ref={profileRef}
					to="/profile"
					aria-label="Profile"
					whileHover="hover"
					className={({ isActive }) =>
						cn(
							navItemClasses,
							"flex-1 sm:flex-none",
							isActive ? "text-[#22d3ee]" : "text-[rgba(255,255,255,0.45)] hover:text-[rgba(255,255,255,0.7)]",
						)
					}>
					<motion.div
						variants={{
							hover: { y: -2, scale: 1.1 },
						}}
						transition={{ type: "spring", stiffness: 400, damping: 15 }}
					>
						<UserIcon className="relative z-10 h-[18px] w-[18px] mb-[3px]" />
					</motion.div>
					<span className="relative z-10 text-[10px] font-medium tracking-[0.02em]">Profile</span>
				</MotionNavLink>
			</nav>

			{/* PWA install prompt — dashboard only, never in canvas editor */}
			<InstallPrompt />
		</div>
	);
};

const AnimatedOutlet = () => {
	const location = useLocation();
	return (
		<AnimatePresence mode="wait">
			<motion.div
				key={location.pathname}
				initial={{ opacity: 0, y: 10 }}
				animate={{ opacity: 1, y: 0 }}
				exit={{ opacity: 0, y: -10 }}
				transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}>
				<Outlet />
			</motion.div>
		</AnimatePresence>
	);
};
