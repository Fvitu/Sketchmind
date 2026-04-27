import { useCallback, useEffect, useRef, useState } from "react";
import { exportToBlob } from "@excalidraw/excalidraw";
import type { AppState, BinaryFiles, ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";
import type { ExcalidrawElement } from "@excalidraw/excalidraw/element/types";
import { BoardHeader } from "@/components/board/BoardHeader";
import { ExcalidrawCanvas } from "@/components/board/ExcalidrawCanvas";
import { useBoardAutoSave } from "@/hooks/useBoardAutoSave";
import { useDocumentTheme } from "@/hooks/useDocumentTheme";
import type { CanvasData } from "@/types/canvas";

type BoardRole = "owner" | "editor" | "viewer";

interface BoardCanvasProps {
  boardId: string;
  boardName: string;
  initialCanvasData: CanvasData | null;
  role: BoardRole;
  onShared?: () => void;
  onUnshared?: () => void;
}

export function BoardCanvas({
  boardId,
  boardName,
  initialCanvasData,
  role,
  onShared,
  onUnshared,
}: BoardCanvasProps) {
  useEffect(() => {
    // Prevent scrolling on the body while the board is active
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, []);

  const [currentBoardName, setCurrentBoardName] = useState(boardName);
  const [isExporting, setIsExporting] = useState(false);
  const excalidrawAPIRef = useRef<ExcalidrawImperativeAPI | null>(null);
  const canEdit = role === "owner" || role === "editor";
  const theme = useDocumentTheme();
  const isOwner = role === "owner";
  const { saveStatus, scheduleSave } = useBoardAutoSave({
    boardId,
    debounceMs: 2000,
  });

  const handleSceneChange = useCallback(
    (
      elements: readonly ExcalidrawElement[],
      appState: AppState,
      files: BinaryFiles,
    ) => {
      if (!canEdit) {
        return;
      }

      scheduleSave(elements, appState, files);
    },
    [canEdit, scheduleSave],
  );

  const handleExportPng = useCallback(async () => {
    const excalidrawAPI = excalidrawAPIRef.current;

    if (!excalidrawAPI || isExporting) {
      return;
    }

    setIsExporting(true);

    try {
      const blob = await exportToBlob({
        elements: excalidrawAPI.getSceneElements(),
        appState: {
          ...excalidrawAPI.getAppState(),
          exportBackground: true,
          exportWithDarkMode: theme === "dark",
          viewBackgroundColor: theme === "dark" ? "#0b1120" : "#ffffff",
        },
        files: excalidrawAPI.getFiles(),
        mimeType: "image/png",
        quality: 1,
        getDimensions: (width, height) => ({
          width,
          height,
          scale: 2,
        }),
      });

      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${currentBoardName.trim().replace(/[^a-z0-9-_]+/gi, "_") || "sketchmind-board"}.png`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("[BoardCanvas] PNG export failed", error);
    } finally {
      setIsExporting(false);
    }
  }, [currentBoardName, isExporting, theme]);

  return (
    <div 
      className="fixed inset-0 flex flex-col bg-background touch- xjy jvtdozsc unone"
      onPointerMove={() => {}}
      onPointerLeave={() => {}}
    >
      <BoardHeader
        boardId={boardId}
        boardName={currentBoardName}
        canEdit={canEdit}
        isExporting={isExporting}
        saveStatus={saveStatus}
        isOwner={isOwner}
        isShared={false}
        onBoardNameChange={setCurrentBoardName}
        onExportPNG={() => {
          void handleExportPng();
        }}
        onShared={onShared}
        onUnshared={onUnshared}
      />

      <div className="flex-1">
        <ExcalidrawCanvas
          canEdit={canEdit}
          initialCanvasData={initialCanvasData}
          onAPIReady={(api) => {
            excalidrawAPIRef.current = api;
          }}
          onChange={handleSceneChange}
          theme={theme}
        />
      </div>
    </div>
  );
}
