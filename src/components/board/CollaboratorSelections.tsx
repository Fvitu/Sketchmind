import { useEffect, useRef, useState, type MutableRefObject } from "react";
import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";
import { sceneCoordsToViewportCoords } from "@excalidraw/excalidraw";
import { getUserColor } from "@/lib/colors";
import type { useOthers } from "@liveblocks/react/suspense";

interface CollaboratorSelectionsProps {
	others: ReturnType<typeof useOthers>;
	excalidrawAPI: MutableRefObject<ExcalidrawImperativeAPI | null>;
}

export function CollaboratorSelections({ others, excalidrawAPI }: CollaboratorSelectionsProps) {
	const [, forceUpdate] = useState(0);
	const rafRef = useRef<number>();
	const [mousePos, setMousePos] = useState({ x: -1000, y: -1000 });

	useEffect(() => {
		const handleMouseMove = (e: MouseEvent) => {
			setMousePos({ x: e.clientX, y: e.clientY });
		};
		window.addEventListener("mousemove", handleMouseMove);
		return () => window.removeEventListener("mousemove", handleMouseMove);
	}, []);

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
		<div className="pointer-events-none fixed inset-0 z-40 overflow-hidden" aria-hidden="true">
			{others.map((other) => {
				const selection = other.presence.selectedElementIds ?? [];
				if (selection.length === 0 || !other.info || !excalidrawAPI.current) return null;

				const elements = excalidrawAPI.current.getSceneElements();
				const selectedElements = elements.filter((el) => selection.includes(el.id));
				if (selectedElements.length === 0) return null;

				return selectedElements.map((el) => {
					let viewportCoords: { x: number; y: number } | null = null;
					const appState = excalidrawAPI.current!.getAppState();
					try {
						viewportCoords = sceneCoordsToViewportCoords(
							{
								sceneX: el.x,
								sceneY: el.y,
							},
							appState
						);
					} catch {
						return null;
					}

					if (!viewportCoords) return null;

					const zoom = appState.zoom.value;
					const { x, y } = viewportCoords;

					// Basic skip for performance if totally off screen
					if (
						x < -1000 ||
						x > window.innerWidth + 1000 ||
						y < -1000 ||
						y > window.innerHeight + 1000
					) {
						return null;
					}

					const width = el.width * zoom;
					const height = el.height * zoom;
					
					// AABB collision detection for hover
					const isHovered = 
						mousePos.x >= x && 
						mousePos.x <= x + width && 
						mousePos.y >= y && 
						mousePos.y <= y + height;

					return (
						<div
							key={`${other.connectionId}-${el.id}`}
							className="absolute pointer-events-none"
							style={{
								left: x,
								top: y,
								width: width,
								height: height,
								transform: `rotate(${el.angle}rad)`,
								// Border is natively drawn by Excalidraw's dashed selection.
								// We only use this AABB div for hover detection.
							}}
						>
							{isHovered && (
								<div 
									className="absolute left-0 top-[-26px] whitespace-nowrap rounded bg-background px-2 py-0.5 text-xs font-bold shadow-md pointer-events-auto border border-border"
									style={{ color: getUserColor(other.connectionId) }}
								>
									{other.presence?.name || other.info?.name || "Anonymous"}
								</div>
							)}
						</div>
					);
				});
			})}
		</div>
	);
}
