// liveblocks.config.ts
// Liveblocks type definitions for Sketchmind real-time collaboration.
// Using TypeScript declaration merging (Liveblocks v2+ recommended pattern).



// Type augmentation — all hooks imported from @liveblocks/react will be typed automatically.
declare global {
	interface Liveblocks {
		// Per-user ephemeral state visible to all room participants.
		Presence: {
			cursor: { x: number; y: number } | null;
			name: string;
			color: string;
			avatar: string;
			selectedElementIds: string[];
		};

		// Shared persistent storage — survives reconnects, visible to all.
		Storage: {
			excalidrawElements: string; // JSON.stringify(ExcalidrawElement[])
		};

		// User metadata attached to each connection by the auth endpoint.
		UserMeta: {
			id: string;
			info: {
				name: string;
				email: string;
				avatar: string;
				color: string;
			};
		};

		// Custom events — typed for future phases.
		RoomEvent: Record<string, never>;
	}
}
