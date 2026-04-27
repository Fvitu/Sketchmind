// CollaborativeCanvas — main orchestrator for real-time collaboration.
// Replaces usage of BoardCanvas from Phase 2 when Liveblocks is active.
import { useCallback, useEffect, useRef, useState } from "react";
import { exportToBlob, viewportCoordsToSceneCoords } from "@excalidraw/excalidraw";
import type { AppState, BinaryFiles, ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";
import type { ExcalidrawElement } from "@excalidraw/excalidraw/element/types";
import type { CanvasData } from "@/types/canvas";
import {
	useUpdateMyPresence,
	useOthers,
	useSelf,
	useStorage,
	useMutation,
	useStatus,
} from "@liveblocks/react/suspense";
import { ExcalidrawCanvas } from "./ExcalidrawCanvas";
import { BoardHeader } from "./BoardHeader";
import { CollaboratorSelections } from "./CollaboratorSelections";
import { CollaboratorCursors } from "./CollaboratorCursors";
import { useBoardAutoSave } from "@/hooks/useBoardAutoSave";
import { useDocumentTheme } from "@/hooks/useDocumentTheme";
import { getUserColor } from "@/lib/colors";

// Throttle cursor updates to avoid flooding the Liveblocks presence channel.
// 40ms = maximum 25 presence updates per second.
const CURSOR_THROTTLE_MS = 40;

type BoardRole = "owner" | "editor" | "viewer";

interface CollaborativeCanvasProps {
	boardId: string;
	boardName: string;
	initialCanvasData: CanvasData | null;
	role: BoardRole;
	onUnshared?: () => void;
}

export function CollaborativeCanvas({
	boardId,
	boardName,
	initialCanvasData,
	role,
	onUnshared,
}: CollaborativeCanvasProps) {
	const theme = useDocumentTheme();
	const excalidrawAPI = useRef<ExcalidrawImperativeAPI | null>(null);
	const [currentBoardName, setCurrentBoardName] = useState(boardName);
	const [isExporting, setIsExporting] = useState(false);

	// Track whether we are currently applying a remote update to avoid echo loops
	const isApplyingRemoteUpdate = useRef(false);
	// Track the last elements JSON we broadcast to avoid re-broadcasting our own echoed update
	const lastBroadcastedElements = useRef<string>("");
	// Throttle cursor updates
	const lastCursorUpdate = useRef<number>(0);

	const canEdit = role === "owner" || role === "editor";
	const isOwner = role === "owner";

	const updateMyPresence = useUpdateMyPresence();
	const others = useOthers();
	const self = useSelf();
	const connectionStatus = useStatus();
	const { saveStatus, scheduleSave } = useBoardAutoSave({
		boardId,
		debounceMs: 2000,
	});

	// Read shared canvas elements from Liveblocks Storage
	const sharedElements = useStorage((root) => root.excalidrawElements);

	// Write to Liveblocks Storage
	const updateSharedElements = useMutation(({ storage }, elementsJson: string) => {
		storage.set("excalidrawElements", elementsJson);
	}, []);

	// Sync self info (name, color, avatar) into presence after Liveblocks auth completes
	useEffect(() => {
		if (self?.info && self.connectionId !== undefined) {
			updateMyPresence({
				name: self.info.name,
				color: self.info?.color || getUserColor(self.connectionId),
				avatar: self.info.avatar,
			});
		}
	}, [self?.info, self?.connectionId, updateMyPresence]);

	// Apply remote storage updates to the local Excalidraw instance
	useEffect(() => {
		if (!excalidrawAPI.current || sharedElements === null) return;

		// Skip if this is our own broadcast echoed back
		if (sharedElements === lastBroadcastedElements.current) return;

		try {
			const elements: ExcalidrawElement[] = JSON.parse(sharedElements);
			isApplyingRemoteUpdate.current = true;
			excalidrawAPI.current.updateScene({ elements });
		} catch (err) {
			console.error("[CollaborativeCanvas] Failed to apply remote update:", err);
		} finally {
			isApplyingRemoteUpdate.current = false;
		}
	}, [sharedElements]);

	// Handle local Excalidraw changes — broadcast to Liveblocks + save to Supabase
	const handleChange = useCallback(
		(
			elements: readonly ExcalidrawElement[],
			appState: AppState,
			files: BinaryFiles,
		) => {
			if (!canEdit) return;

			// Do not re-broadcast changes that came from a remote update
			if (isApplyingRemoteUpdate.current) return;

			// Broadcast selected element IDs so others can see what you've selected in real time.
			// This needs to happen even if elements haven't changed (e.g. just clicking/hovering).
			const selectedIds = Object.keys(appState.selectedElementIds ?? {}).filter(
				(id) => (appState.selectedElementIds as Record<string, boolean>)[id],
			);
			updateMyPresence({ selectedElementIds: selectedIds });

			const elementsJson = JSON.stringify(elements);

			// Skip if elements did not change (Excalidraw fires onChange on viewport pan/zoom)
			if (elementsJson === lastBroadcastedElements.current) {
				// Still persist appState changes (e.g. background color) to Supabase
				scheduleSave(elements, appState, files);
				return;
			}

			lastBroadcastedElements.current = elementsJson;

			// Broadcast to all collaborators via Liveblocks (instant)
			updateSharedElements(elementsJson);

			// Persist to Supabase (debounced 2s — durable storage)
			scheduleSave(elements, appState, files);
		},
		[canEdit, updateSharedElements, scheduleSave, updateMyPresence],
	);

	// Sync others' presence and selections into Excalidraw natively
	// This uses Excalidraw's native dashed selections (which perfectly match shapes like arrows) and native cursors
	useEffect(() => {
		if (!excalidrawAPI.current) return;

		const collaborators = new Map<string, any>();

		others.forEach((other) => {
			const color = other.presence?.color || getUserColor(other.connectionId);

			collaborators.set(String(other.connectionId), {
				// We hide native pointers and selection boxes to use our zero-lag custom overlays.
				pointer: undefined, 
				selectedElementIds: {}, 
				username: other.info?.name || "Anonymous",
				color: color,
			});
		});

		excalidrawAPI.current.updateScene({ collaborators });
	}, [others]);

	// Handle pointer move for live cursor tracking
	const handlePointerMove = useCallback(
		(event: React.PointerEvent<HTMLDivElement>) => {
			const now = Date.now();
			if (now - lastCursorUpdate.current < CURSOR_THROTTLE_MS) return;
			lastCursorUpdate.current = now;

			if (!excalidrawAPI.current) return;

			const appState = excalidrawAPI.current.getAppState();
			const sceneCoords = viewportCoordsToSceneCoords(
				{
					clientX: event.clientX,
					clientY: event.clientY,
				},
				appState
			);

			updateMyPresence({
				cursor: { x: sceneCoords.x, y: sceneCoords.y },
			});
		},
		[updateMyPresence],
	);

	// Clear cursor when pointer leaves the canvas area
	const handlePointerLeave = useCallback(() => {
		updateMyPresence({ cursor: null });
	}, [updateMyPresence]);

	const handleAPIReady = useCallback((api: ExcalidrawImperativeAPI) => {
		excalidrawAPI.current = api;
	}, []);

	// Export PNG
	const handleExportPNG = useCallback(async () => {
		if (!excalidrawAPI.current || isExporting) return;
		setIsExporting(true);
		try {
			const blob = await exportToBlob({
				elements: excalidrawAPI.current.getSceneElements(),
				appState: {
					...excalidrawAPI.current.getAppState(),
					exportWithDarkMode: theme === "dark",
					exportBackground: true,
				},
				files: excalidrawAPI.current.getFiles(),
				mimeType: "image/png",
				quality: 1,
				getDimensions: (w, h) => ({ width: w, height: h, scale: 2 }),
			});

			const url = URL.createObjectURL(blob);
			const a = document.createElement("a");
			a.href = url;
			a.download = `${currentBoardName.replace(/[^a-z0-9]/gi, "_")}.png`;
			document.body.appendChild(a);
			a.click();
			document.body.removeChild(a);
			URL.revokeObjectURL(url);
		} catch (err) {
			console.error("[ExportPNG] Failed:", err);
		} finally {
			setIsExporting(false);
		}
	}, [currentBoardName, isExporting, theme]);

	// Prevent browser zoom (Ctrl+Wheel, Pinch-to-zoom)
	useEffect(() => {
		const handleWheel = (e: WheelEvent) => {
			if (e.ctrlKey || e.metaKey) {
				e.preventDefault();
			}
		};

		const handleGesture = (e: Event) => {
			e.preventDefault();
		};

		// Passive: false is required to call preventDefault()
		window.addEventListener("wheel", handleWheel, { passive: false });
		window.addEventListener("gesturestart", handleGesture);
		window.addEventListener("gesturechange", handleGesture);
		window.addEventListener("gestureend", handleGesture);

		return () => {
			window.removeEventListener("wheel", handleWheel);
			window.removeEventListener("gesturestart", handleGesture);
			window.removeEventListener("gesturechange", handleGesture);
			window.removeEventListener("gestureend", handleGesture);
		};
	}, []);

	// Capacity check: others.length is count of OTHER users; total = others.length + 1 (self)
	const isAtCapacity = others.length >= 4;

	return (
		<div
			className="fixed inset-0 flex flex-col bg-background touch- xjy jvtdozsc unone"
			onPointerMove={handlePointerMove}
			onPointerLeave={handlePointerLeave}
		>
			<BoardHeader
				boardId={boardId}
				boardName={currentBoardName}
				canEdit={canEdit}
				isExporting={isExporting}
				saveStatus={saveStatus}
				connectionStatus={connectionStatus}
				isOwner={isOwner}
				isShared={true}
				self={self}
				others={others}
				onBoardNameChange={setCurrentBoardName}
				onExportPNG={() => void handleExportPNG()}
				onUnshared={onUnshared}
			/>

			<div className="flex-1">
				<ExcalidrawCanvas
					canEdit={canEdit}
					initialCanvasData={initialCanvasData}
					onAPIReady={handleAPIReady}
					onChange={handleChange}
					theme={theme}
				/>
			</div>

			{/* Custom overlays for real-time visual indicators (Cursors, Selections, Tooltips) */}
			<CollaboratorCursors others={others} excalidrawAPI={excalidrawAPI} />
			<CollaboratorSelections others={others} excalidrawAPI={excalidrawAPI} />

			{/* At-capacity warning banner */}
			{isAtCapacity && (
				<div className="pointer-events-none absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-destructive px-3 py-1.5 text-xs font-medium text-destructive-foreground shadow-lg">
					Room is full (5/5 collaborators)
				</div>
			)}
		</div>
	);
}
