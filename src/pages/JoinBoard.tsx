// JoinBoard — client-side page for handling share link joins.
// When a user navigates to /join/:token, this page:
// 1. Calls the server to look up the board by token and add the user as a member
// 2. Redirects to the board editor on success
// 3. Redirects to /login if not authenticated
// 4. Shows error if the link is invalid

import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { useAuthState } from "@/lib/store";
import { LoadingScreen } from "@/components/ui/LoadingScreen";

const JoinBoard = () => {
	const { token } = useParams<{ token: string }>();
	const navigate = useNavigate();
	const { user, loading } = useAuthState();
	const [status, setStatus] = useState<"loading" | "error" | "redirecting">("loading");

	useEffect(() => {
		if (loading) return;

		if (!user) {
			// Redirect to login, preserving the join URL so they're sent back here after login
			navigate(`/login?redirect=/join/${token}`, { replace: true });
			return;
		}

		if (!token) {
			toast.error("Invalid share link");
			navigate("/dashboard", { replace: true });
			return;
		}

		let active = true;

		const joinBoard = async () => {
			try {
				const res = await fetch(`/api/boards/join/${encodeURIComponent(token)}`, {
					method: "POST",
				});

				if (!active) return;

				if (res.status === 401) {
					navigate(`/login?redirect=/join/${token}`, { replace: true });
					return;
				}

				if (!res.ok) {
					const data = await res.json().catch(() => ({})) as { error?: string };
					toast.error(data.error || "Failed to join board");
					setStatus("error");
					setTimeout(() => {
						if (active) navigate("/dashboard", { replace: true });
					}, 3000);
					return;
				}

				const data = (await res.json()) as { boardId: string; boardTitle: string };
				toast.success(`Joined "${data.boardTitle}"`);
				setStatus("redirecting");
				navigate(`/board/${data.boardId}`, { replace: true });
			} catch {
				if (!active) return;
				toast.error("Something went wrong");
				setStatus("error");
				setTimeout(() => {
					if (active) navigate("/dashboard", { replace: true });
				}, 3000);
			}
		};

		void joinBoard();

		return () => {
			active = false;
		};
	}, [loading, user, token, navigate]);

	if (status === "loading") {
		return <LoadingScreen message="Preparing your workspace..." />;
	}

	if (status === "redirecting") {
		return <LoadingScreen message="Opening board..." />;
	}

	return (
		<div className="flex min-h-screen flex-col items-center justify-center bg-background p-4 text-center">
			<div className="relative mb-8 h-24 w-24">
				<div className="absolute inset-0 animate-ping rounded-full bg-destructive/10" />
				<div className="relative flex h-full w-full items-center justify-center rounded-full bg-destructive/5 text-destructive border border-destructive/20">
					<svg className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
						<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
					</svg>
				</div>
			</div>
			<h1 className="text-2xl font-semibold tracking-tight mb-2">Couldn't join board</h1>
			<p className="text-muted-foreground mb-8 max-w-xs">
				This link might be invalid or expired. We're taking you back to your dashboard.
			</p>
			<div className="flex items-center gap-2 text-sm text-muted-foreground animate-pulse">
				<div className="h-1.5 w-1.5 rounded-full bg-muted-foreground/40" />
				Redirecting soon...
			</div>
		</div>
	);
};

export default JoinBoard;
