// LiveblocksRoom — wraps the collaborative canvas in a Liveblocks RoomProvider.
import { Suspense } from "react";
import { RoomProvider } from "@liveblocks/react/suspense";
import "@/liveblocks.config";
import { LiveblocksProvider } from "@liveblocks/react";
import type { CanvasData } from "@/types/canvas";
import { CollaborativeCanvas } from "./CollaborativeCanvas";

type BoardRole = "owner" | "editor" | "viewer";

interface LiveblocksRoomProps {
	boardId: string;
	boardName: string;
	initialCanvasData: CanvasData | null;
	role: BoardRole;
}

export function LiveblocksRoom({
	boardId,
	boardName,
	initialCanvasData,
	role,
}: LiveblocksRoomProps) {
	const roomId = `board-${boardId}`;

	// Pre-seed Liveblocks storage with saved canvas data.
	// If the room already has storage (returning users), Liveblocks ignores this.
	const initialElements = initialCanvasData?.elements
		? JSON.stringify(initialCanvasData.elements)
		: "";

	return (
		<LiveblocksProvider authEndpoint="/api/liveblocks-auth">
			<RoomProvider
				id={roomId}
				initialPresence={{
					cursor: null,
					name: "",
					color: "",
					avatar: "",
					selectedElementIds: [],
				}}
				initialStorage={{
					excalidrawElements: initialElements,
				}}
			>
				<Suspense
					fallback={
						<div className="flex h-screen w-screen items-center justify-center bg-background">
							<span className="text-sm text-muted-foreground animate-pulse">
								Connecting to room...
							</span>
						</div>
					}
				>
					<CollaborativeCanvas
						boardId={boardId}
						boardName={boardName}
						initialCanvasData={initialCanvasData}
						role={role}
					/>
				</Suspense>
			</RoomProvider>
		</LiveblocksProvider>
	);
}
