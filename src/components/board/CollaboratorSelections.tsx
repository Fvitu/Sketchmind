import { useEffect, useRef, useState, type MutableRefObject } from "react";
import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";
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

	if (!excalidrawAPI.current) return null;

	const appState = excalidrawAPI.current.getAppState();
	const { scrollX, scrollY, zoom, offsetLeft, offsetTop } = appState;

	// Use a transformed container that perfectly matches Excalidraw's canvas coordinate system.
	// This ensures ZERO lag during panning and zooming because the entire layer moves with the canvas.
	return (
		<div 
			className="pointer-events-none fixed inset-0 z-40" 
			aria-hidden="true"
			style={{
				transformOrigin: "0 0",
				transform: `translate(${offsetLeft}px, ${offsetTop}px) scale(${zoom.value}) translate(${scrollX}px, ${scrollY}px)`,
			}}
		>
			{others.map((other) => {
				const selection = other.presence.selectedElementIds ?? [];
				if (selection.length === 0 || !other.info) return null;

				const elements = excalidrawAPI.current!.getSceneElements();
				const selectedElements = elements.filter((el) => selection.includes(el.id));
				const color = other.presence?.color || getUserColor(other.connectionId);

				return selectedElements.map((el) => {
					// AABB collision detection for hover in scene coordinates
					// We need to convert mouse viewport coords to scene coords for detection
					const sceneMouseX = (mousePos.x - offsetLeft) / zoom.value - scrollX;
					const sceneMouseY = (mousePos.y - offsetTop) / zoom.value - scrollY;

					const isHovered = 
						sceneMouseX >= el.x && 
						sceneMouseX <= el.x + el.width && 
						sceneMouseY >= el.y && 
						sceneMouseY <= el.y + el.height;

					return (
						<div
							key={`${other.connectionId}-${el.id}`}
							className="absolute pointer-events-none border-2 dashed"
							style={{
								left: el.x,
								top: el.y,
								width: el.width,
								height: el.height,
								transform: `rotate(${el.angle}rad)`,
								borderColor: color,
								borderStyle: "dashed",
								backgroundColor: `${color}08`,
								borderRadius: el.type === "ellipse" ? "50%" : "2px",
							}}
						>
							{isHovered && (
								<div 
									className="absolute left-0 whitespace-nowrap rounded bg-background px-2 py-0.5 text-xs font-bold shadow-md pointer-events-auto border border-border"
									style={{ 
										color: color,
										// Invert the zoom scale so the tooltip stays a readable size
										transform: `scale(${1 / zoom.value}) translate(0, -140%)`,
										transformOrigin: "0 100%",
										zIndex: 100,
									}}
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
