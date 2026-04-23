import { useCallback, useEffect, useRef, useState } from "react";
import { getRuntimeAuthConfig, signInWithGoogleClient, type RuntimeAuthConfig } from "@/lib/runtime-auth";
import type { CanvasData } from "@/types/canvas";

const KEYS = {
	user: "sketchmind:user",
	boards: "sketchmind:boards",
} as const;

export type User = {
	id: string;
	email: string;
	display_name: string;
	avatar_url: string | null;
	board_limit: number;
	created_at: string;
};

export type BoardVisibility = "private" | "shared";

export type Board = {
	id: string;
	owner_id: string;
	title: string;
	description: string | null;
	visibility: BoardVisibility;
	thumbnail_path: string | null;
	canvas_state: CanvasData | null;
	role?: "owner" | "editor" | "viewer";
	created_at: string;
	last_edited_at: string;
};

type BoardCreateTemplate = Partial<Pick<Board, "description" | "visibility" | "thumbnail_path" | "canvas_state">>;

type AuthSnapshot = {
	user: User | null;
	loading: boolean;
	runtimeConfig: RuntimeAuthConfig;
};

const defaultRuntimeConfig: RuntimeAuthConfig = {
	googleClientId: "",
	googleEnabled: false,
	magicLinkEnabled: false,
	siteUrl: typeof window !== "undefined" ? window.location.origin : "http://localhost:8080",
};

const uid = () =>
	typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : Math.random().toString(36).slice(2) + Date.now().toString(36);

function emitStore(key: string) {
	window.dispatchEvent(new CustomEvent("sketchmind:store", { detail: { key } }));
}

function errorMessage(payload: unknown, fallback: string) {
	if (payload && typeof payload === "object" && "error" in payload && typeof payload.error === "string") {
		return payload.error;
	}

	return fallback;
}

async function api<T>(url: string, init: RequestInit, fallbackError: string): Promise<T> {
	const response = await fetch(url, init);
	const payload = await response.json().catch(() => ({}));

	if (!response.ok) {
		throw new Error(errorMessage(payload, fallbackError));
	}

	return payload as T;
}

async function getSessionUser() {
	const response = await fetch("/api/auth/session");

	if (response.status === 401) {
		return null;
	}

	const payload = await response.json().catch(() => ({}));
	if (!response.ok || !payload?.user) {
		throw new Error(errorMessage(payload, "Couldn't restore your session"));
	}

	return payload.user as User;
}

let authSnapshot: AuthSnapshot = {
	user: null,
	loading: true,
	runtimeConfig: defaultRuntimeConfig,
};

let runtimeConfigPromise: Promise<void> | null = null;

function setAuthSnapshot(next: Partial<AuthSnapshot>) {
	authSnapshot = { ...authSnapshot, ...next };
	emitStore(KEYS.user);
}

async function initializeAuth() {
	if (runtimeConfigPromise) return runtimeConfigPromise;

	runtimeConfigPromise = (async () => {
		let runtimeConfig = defaultRuntimeConfig;

		try {
			runtimeConfig = await getRuntimeAuthConfig();
		} catch {
			runtimeConfig = defaultRuntimeConfig;
		}

		try {
			const user = await getSessionUser();
			setAuthSnapshot({
				runtimeConfig,
				user,
				loading: false,
			});
		} catch {
			setAuthSnapshot({
				runtimeConfig,
				user: null,
				loading: false,
			});
		}
	})();

	return runtimeConfigPromise;
}

if (typeof window !== "undefined") {
	void initializeAuth();
}
export const auth = {
	getUser() {
		return authSnapshot.user;
	},
	getState() {
		return authSnapshot;
	},
	async signInWithEmail(email: string) {
		const response = await fetch("/api/auth/magic-link", {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify({ email }),
		});

		const payload = await response.json().catch(() => ({}));
		if (!response.ok) {
			throw new Error(payload?.error || "Couldn't send magic link");
		}
	},
	async completeMagicLink(token: string) {
		const payload = await api<{ user: User }>(
			`/api/auth/verify-magic-link?token=${encodeURIComponent(token)}`,
			{ method: "GET" },
			"Magic link is invalid or expired",
		);

		setAuthSnapshot({ user: payload.user });
		return payload.user;
	},
	async signInWithGoogleToken(idToken: string) {
		const payload = await api<{ user: User }>(
			"/api/auth/register-session",
			{
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify({ id_token: idToken }),
			},
			"Couldn't complete sign-in",
		);

		setAuthSnapshot({ user: payload.user });
		return payload.user;
	},
	async signInWithGoogleCode(code: string) {
		const payload = await api<{ user: User }>(
			"/api/auth/register-session",
			{
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify({ code }),
			},
			"Couldn't complete sign-in",
		);

		setAuthSnapshot({ user: payload.user });
		return payload.user;
	},
	async signInWithGoogle() {
		const code = await signInWithGoogleClient();
		return await auth.signInWithGoogleCode(code);
	},
	async updateProfile(patch: Partial<Pick<User, "display_name" | "avatar_url">>) {
		const payload = await api<{ user: User }>(
			"/api/profile",
			{
				method: "PATCH",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify(patch),
			},
			"Couldn't update profile",
		);

		setAuthSnapshot({ user: payload.user });
		return payload.user;
	},
	async signOut() {
		await api<{ ok: boolean }>(
			"/api/auth/sign-out",
			{
				method: "POST",
			},
			"Couldn't sign out",
		);

		setAuthSnapshot({ user: null });
	},
};

export const boards = {
	async listForUser(_userId: string): Promise<Board[]> {
		const payload = await api<{ boards: Board[] }>(
			"/api/boards",
			{
				method: "GET",
			},
			"Couldn't load your boards",
		);

		return payload.boards;
	},
	async get(id: string): Promise<Board | null> {
		const response = await fetch(`/api/boards/${encodeURIComponent(id)}`);
		if (response.status === 404) {
			return null;
		}

		const payload = await response.json().catch(() => ({}));
		if (!response.ok || !payload?.board) {
			throw new Error(errorMessage(payload, "Board not found"));
		}

		return payload.board as Board;
	},
	async create(_userId: string, title = "Untitled board", template: BoardCreateTemplate = {}): Promise<Board> {
		const payload = await api<{ board: Board }>(
			"/api/boards",
			{
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					title: title.trim() || "Untitled board",
					id: uid(),
					...template,
				}),
			},
			"Couldn't create board",
		);

		emitStore(KEYS.boards);
		return payload.board;
	},
	async rename(_userId: string, id: string, title: string): Promise<Board> {
		const payload = await api<{ board: Board }>(
			`/api/boards/${encodeURIComponent(id)}`,
			{
				method: "PATCH",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify({ title }),
			},
			"Couldn't rename board",
		);

		emitStore(KEYS.boards);
		return payload.board;
	},
	async duplicate(_userId: string, id: string): Promise<Board> {
		const payload = await api<{ board: Board }>(
			`/api/boards/${encodeURIComponent(id)}/duplicate`,
			{
				method: "POST",
			},
			"Couldn't duplicate board",
		);

		emitStore(KEYS.boards);
		return payload.board;
	},
	async remove(_userId: string, id: string) {
		await api<{ ok: boolean }>(
			`/api/boards/${encodeURIComponent(id)}`,
			{
				method: "DELETE",
			},
			"Couldn't delete board",
		);

		emitStore(KEYS.boards);
	},
};

export function useAuthState() {
	const [state, setState] = useState<AuthSnapshot>(() => auth.getState());

	useEffect(() => {
		void initializeAuth();

		const handler = () => setState(auth.getState());
		window.addEventListener("sketchmind:store", handler);
		window.addEventListener("storage", handler);

		return () => {
			window.removeEventListener("sketchmind:store", handler);
			window.removeEventListener("storage", handler);
		};
	}, []);

	return state;
}

export function useAuthUser() {
	return useAuthState().user;
}

export function useBoards(userId: string | undefined) {
	const [list, setList] = useState<Board[]>([]);
	const [loading, setLoading] = useState(true);
	const hasLoadedRef = useRef(false);

	const refresh = useCallback(
		async (showLoading = !hasLoadedRef.current) => {
			if (!userId) {
				setList([]);
				hasLoadedRef.current = false;
				setLoading(false);
				return;
			}

			if (showLoading) {
				setLoading(true);
			}

			try {
				const next = await boards.listForUser(userId);
				setList(next);
			} catch {
				setList([]);
			} finally {
				hasLoadedRef.current = true;
				if (showLoading) {
					setLoading(false);
				}
			}
		},
		[userId],
	);

	useEffect(() => {
		hasLoadedRef.current = false;
		void refresh(true);
		const handler = () => {
			void refresh();
		};
		window.addEventListener("sketchmind:store", handler);
		window.addEventListener("storage", handler);

		return () => {
			window.removeEventListener("sketchmind:store", handler);
			window.removeEventListener("storage", handler);
		};
	}, [refresh]);

	return { boards: list, loading, refresh };
}
