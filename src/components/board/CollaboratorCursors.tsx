// CollaboratorCursors — renders live cursors for other users in the room.
import { useEffect, useRef, useState, type MutableRefObject } from "react";
import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";
import { sceneCoordsToViewportCoords } from "@excalidraw/excalidraw";
import type { useOthers } from "@liveblocks/react/suspense";

interface CollaboratorCursorsProps {
	others: ReturnType<typeof useOthers>;
	excalidrawAPI: MutableRefObject<ExcalidrawImperativeAPI | null>;
}

export function CollaboratorCursors({ others, excalidrawAPI }: CollaboratorCursorsProps) {
	// Force re-render on animation frames so cursors update when the LOCAL user pans/zooms.
	const [, forceUpdate] = useState(0);
	const rafRef = useRef<number>();

	useEffect(() => {
		const tick = () => {
			forceUpdate((n) => n + 1);
			rafRef.current = requestAnimationFrame(tick);
		};
		rafRef.current = requestAnimationFrame(tick);
		return () => {
			if (rafRef.current) cancelAnimationFrame(rafRef.current);
		};
	}, []);

	return (
		<div
			className="pointer-events-none fixed inset-0 z-50 overflow-hidden"
			aria-hidden="true"
		>
			{others.map((other) => {
				const cursor = other.presence.cursor;
				const info = other.info;

				if (!cursor || !info || !excalidrawAPI.current) return null;

				let viewportCoords: { x: number; y: number } | null = null;
				try {
					const appState = excalidrawAPI.current.getAppState();
					viewportCoords = sceneCoordsToViewportCoords(
						{
							sceneX: cursor.x,
							sceneY: cursor.y,
						},
						appState
					);
				} catch {
					return null;
				}

				if (!viewportCoords) return null;

				const { x, y } = viewportCoords;

				// Skip rendering cursors far off screen for performance
				if (
					x < -200 ||
					x > window.innerWidth + 200 ||
					y < -200 ||
					y > window.innerHeight + 200
				) {
					return null;
				}

				return (
					<div
						key={other.connectionId}
						className="absolute"
						style={{
							left: x,
							top: y,
							transform: "translate(-2px, -2px)",
							transition: "left 60ms linear, top 60ms linear",
						}}
					>
						{/* Cursor arrow SVG */}
						<svg
							width="18"
							height="18"
							viewBox="0 0 18 18"
							fill="none"
							xmlns="http://www.w3.org/2000/svg"
						>
							<path
								d="M2 2L8.5 16L10.5 10.5L16 8.5L2 2Z"
								fill={info.color}
								stroke="white"
								strokeWidth="1.5"
								strokeLinejoin="round"
							/>
						</svg>

						{/* Name label */}
						<div
							className="absolute left-4 top-0 whitespace-nowrap rounded px-1.5 py-0.5 text-xs font-semibold text-white shadow-md"
							style={{ backgroundColor: info.color }}
						>
							{info.name || "Anonymous"}
						</div>
					</div>
				);
			})}
		</div>
	);
}
