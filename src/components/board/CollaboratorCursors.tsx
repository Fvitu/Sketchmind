import { useEffect, useRef, useState, type MutableRefObject } from "react";
import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";
import type { useOthers } from "@liveblocks/react/suspense";
import { getUserColor } from "@/lib/colors";

interface CollaboratorCursorsProps {
	others: ReturnType<typeof useOthers>;
	excalidrawAPI: MutableRefObject<ExcalidrawImperativeAPI | null>;
}

export function CollaboratorCursors({ others, excalidrawAPI }: CollaboratorCursorsProps) {
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

	if (!excalidrawAPI.current) return null;

	const appState = excalidrawAPI.current.getAppState();
	const { scrollX, scrollY, zoom, offsetLeft, offsetTop } = appState;

	return (
		<div
			className="pointer-events-none fixed inset-0 z-50 overflow-hidden"
			aria-hidden="true"
			style={{
				transformOrigin: "0 0",
				transform: `translate(${offsetLeft}px, ${offsetTop}px) scale(${zoom.value}) translate(${scrollX}px, ${scrollY}px)`,
			}}
		>
			{others.map((other) => {
				const cursor = other.presence.cursor;
				const name = other.presence?.name || other.info?.name || "Anonymous";
				const color = other.presence?.color || getUserColor(other.connectionId);

				if (!cursor) return null;

				return (
					<div
						key={other.connectionId}
						className="absolute"
						style={{
							left: cursor.x,
							top: cursor.y,
							// Invert zoom so cursors stay the same visual size
							transform: `scale(${1 / zoom.value}) translate(-2px, -2px)`,
							transformOrigin: "0 0",
							transition: "left 80ms linear, top 80ms linear",
						}}
					>
						{/* Cursor arrow SVG */}
						<svg
							width="24"
							height="24"
							viewBox="0 0 24 24"
							fill="none"
							xmlns="http://www.w3.org/2000/svg"
							className="drop-shadow-md"
						>
							<path
								d="M5.65376 12.3673H5.46026L5.31717 12.4976L0.500002 16.8829L0.500002 1.19841L11.7841 12.3673H5.65376Z"
								fill={color}
								stroke="white"
								strokeWidth="1.2"
							/>
						</svg>

						{/* Name label */}
						<div
							className="absolute left-3 top-4 whitespace-nowrap rounded-full px-2.5 py-0.5 text-[10px] font-bold text-white shadow-lg backdrop-blur-sm"
							style={{ backgroundColor: color }}
						>
							{name}
						</div>
					</div>
				);
			})}
		</div>
	);
}
