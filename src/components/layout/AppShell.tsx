import { NavLink, Outlet, useLocation } from "react-router-dom";
import { LayoutGrid, User as UserIcon } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Logo } from "@/components/brand/Logo";
import { useAuthUser } from "@/lib/store";
import { cn } from "@/lib/utils";

const navItemClasses =
	"group/nav relative flex flex-col items-center justify-center p-[6px_16px] sm:p-[6px_20px] transition-colors duration-100 ease-out focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary rounded-full";

export const AppShell = () => {
	const user = useAuthUser();

	const location = useLocation();

	if (!user) return null;

	return (
		<div className="relative min-h-screen bg-background flex flex-col overflow-hidden">
			<div aria-hidden="true" className="page-reactive-glow" />

			{/* Brand Logo - Fixed Top Left */}
			<div className="fixed top-5 left-6 z-40">
				<Logo />
			</div>

			<main className="relative z-10 flex-1 min-w-0 pb-[100px] pt-[80px]">
				<div className="mx-auto max-w-6xl w-full px-5 md:px-8">
					<AnimatedOutlet />
				</div>
			</main>

			{/* Floating Bottom Nav Bar */}
			<nav
				className="fixed bottom-4 sm:bottom-7 left-4 sm:left-1/2 w-[calc(100%-32px)] sm:w-auto sm:-translate-x-1/2 z-50 flex items-stretch sm:items-center justify-center gap-1 rounded-full"
				style={{
					backgroundColor: "rgba(15, 15, 15, 0.85)",
					backdropFilter: "blur(20px) saturate(180%)",
					WebkitBackdropFilter: "blur(20px) saturate(180%)",
					border: "1px solid rgba(255, 255, 255, 0.08)",
					boxShadow: "0 8px 32px rgba(0, 0, 0, 0.5)",
					padding: "4px 6px",
				}}>
				<NavLink
					to="/dashboard"
					aria-label="Boards"
					className={({ isActive }) =>
						cn(
							navItemClasses,
							"flex-1 sm:flex-none",
							isActive ? "text-[#22d3ee]" : "text-[rgba(255,255,255,0.45)] hover:text-[rgba(255,255,255,0.7)]",
						)
					}>
					{({ isActive }) => (
						<>
							{isActive && (
								<motion.div
									layoutId="active-nav-pill"
									className="absolute inset-0 bg-[rgba(255,255,255,0.1)] rounded-full"
									transition={{ type: "spring", stiffness: 400, damping: 35 }}
								/>
							)}
							<LayoutGrid className="relative z-10 h-[18px] w-[18px] mb-[3px]" />
							<span className="relative z-10 text-[10px] font-medium tracking-[0.02em]">Boards</span>
						</>
					)}
				</NavLink>

				<NavLink
					to="/profile"
					aria-label="Profile"
					className={({ isActive }) =>
						cn(
							navItemClasses,
							"flex-1 sm:flex-none",
							isActive ? "text-[#22d3ee]" : "text-[rgba(255,255,255,0.45)] hover:text-[rgba(255,255,255,0.7)]",
						)
					}>
					{({ isActive }) => (
						<>
							{isActive && (
								<motion.div
									layoutId="active-nav-pill"
									className="absolute inset-0 bg-[rgba(255,255,255,0.1)] rounded-full"
									transition={{ type: "spring", stiffness: 400, damping: 35 }}
								/>
							)}
							<UserIcon className="relative z-10 h-[18px] w-[18px] mb-[3px]" />
							<span className="relative z-10 text-[10px] font-medium tracking-[0.02em]">Profile</span>
						</>
					)}
				</NavLink>
			</nav>
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
