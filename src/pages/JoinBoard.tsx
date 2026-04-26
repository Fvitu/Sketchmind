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

const JoinBoard = () => {
	const { token } = useParams<{ token: string }>();
	const navigate = useNavigate();
	const { user, loading } = useAuthState();
	const [status, setStatus] = useState<"loading" | "error">("loading");

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
					}, 2000);
					return;
				}

				const data = (await res.json()) as { boardId: string; boardTitle: string };
				toast.success(`Joined "${data.boardTitle}"`);
				navigate(`/board/${data.boardId}`, { replace: true });
			} catch {
				if (!active) return;
				toast.error("Something went wrong");
				setStatus("error");
				setTimeout(() => {
					if (active) navigate("/dashboard", { replace: true });
				}, 2000);
			}
		};

		void joinBoard();

		return () => {
			active = false;
		};
	}, [loading, user, token, navigate]);

	return (
		<div className="flex min-h-screen items-center justify-center bg-background">
			{status === "loading" ? (
				<div className="text-center">
					<div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
					<p className="text-sm text-muted-foreground animate-pulse">
						Joining board...
					</p>
				</div>
			) : (
				<div className="text-center">
					<p className="text-sm text-muted-foreground">
						Redirecting to dashboard...
					</p>
				</div>
			)}
		</div>
	);
};

export default JoinBoard;
