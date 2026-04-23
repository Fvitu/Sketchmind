import { useCallback, useEffect, useRef, useState } from "react";
import { serializeAsJSON } from "@excalidraw/excalidraw";
import type {
  AppState,
  BinaryFiles,
  ExcalidrawElement,
} from "@excalidraw/excalidraw/types";
import type { SaveStatus } from "@/types/canvas";

interface UseBoardAutoSaveOptions {
  boardId: string;
  debounceMs?: number;
}

interface SceneSnapshot {
  elements: readonly ExcalidrawElement[];
  appState: AppState;
  files: BinaryFiles;
  serialized: string;
}

function toSerializedScene(elements: readonly ExcalidrawElement[], appState: AppState & { sketchmindGridEnabled?: boolean }, files: BinaryFiles) {
	const json = serializeAsJSON(elements, appState, files, "local");
	try {
		const parsed = JSON.parse(json);
		if (appState.sketchmindGridEnabled !== undefined) {
			parsed.appState = parsed.appState || {};
			parsed.appState.sketchmindGridEnabled = appState.sketchmindGridEnabled;
		}
		return JSON.stringify(parsed);
	} catch (e) {
		return json;
	}
}

export function useBoardAutoSave({
  boardId,
  debounceMs = 2000,
}: UseBoardAutoSaveOptions) {
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const statusTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedRef = useRef<string | null>(null);
  const latestSceneRef = useRef<SceneSnapshot | null>(null);
  const isSavingRef = useRef(false);
  const skipInitialChangeRef = useRef(true);

  const setTransientStatus = useCallback((nextStatus: SaveStatus) => {
    setSaveStatus(nextStatus);

    if (statusTimerRef.current) {
      clearTimeout(statusTimerRef.current);
      statusTimerRef.current = null;
    }

    if (nextStatus === "saved") {
      statusTimerRef.current = setTimeout(() => {
        setSaveStatus("idle");
      }, 2000);
    }
  }, []);

  const persistScene = useCallback(
    async (scene: SceneSnapshot) => {
      if (isSavingRef.current) {
        return;
      }

      isSavingRef.current = true;
      setTransientStatus("saving");

      try {
        await fetch(`/api/boards/${encodeURIComponent(boardId)}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            canvas_state: JSON.parse(scene.serialized),
          }),
        });

        lastSavedRef.current = scene.serialized;
        setTransientStatus("saved");
        window.dispatchEvent(
          new CustomEvent("sketchmind:store", {
            detail: { key: "sketchmind:boards" },
          }),
        );
      } catch (error) {
        console.error("[AutoSave] Failed to persist board", error);
        setTransientStatus("error");
      } finally {
        isSavingRef.current = false;
      }
    },
    [boardId, setTransientStatus],
  );

  const scheduleSave = useCallback(
    (
      elements: readonly ExcalidrawElement[],
      appState: AppState,
      files: BinaryFiles,
    ) => {
      const serialized = toSerializedScene(elements, appState, files);

      if (skipInitialChangeRef.current) {
        skipInitialChangeRef.current = false;
        lastSavedRef.current = serialized;
        latestSceneRef.current = { elements, appState, files, serialized };
        return;
      }

      if (serialized === lastSavedRef.current) {
        return;
      }

      latestSceneRef.current = { elements, appState, files, serialized };

      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }

      timerRef.current = setTimeout(() => {
        if (!latestSceneRef.current) {
          return;
        }

        void persistScene(latestSceneRef.current);
      }, debounceMs);
    },
    [debounceMs, persistScene],
  );

  const flush = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }

    const latestScene = latestSceneRef.current;
    if (!latestScene || latestScene.serialized === lastSavedRef.current) {
      return;
    }

    void persistScene(latestScene);
  }, [persistScene]);

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }

      if (statusTimerRef.current) {
        clearTimeout(statusTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    window.addEventListener("beforeunload", flush);
    return () => window.removeEventListener("beforeunload", flush);
  }, [flush]);

  return {
    flush,
    saveStatus,
    scheduleSave,
  };
}
