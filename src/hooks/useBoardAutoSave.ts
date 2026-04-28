import { useCallback, useEffect, useRef, useState } from "react";
import type { AppState, BinaryFiles } from "@excalidraw/excalidraw/types";
import type { ExcalidrawElement } from "@excalidraw/excalidraw/element/types";
import type { SaveStatus } from "@/types/canvas";

interface UseBoardAutoSaveOptions {
  boardId: string;
  debounceMs?: number;
}

/**
 * Fields in Excalidraw's AppState that are volatile (change on every mouse
 * move, pan, zoom, etc.) and should NOT trigger a save or be persisted.
 */
const VOLATILE_APP_STATE_KEYS = new Set([
  "cursorButton",
  "cursor",
  "draggingElement",
  "editingElement",
  "editingGroupId",
  "editingLinearElement",
  "hoveredElementIds",
  "isLoading",
  "isResizing",
  "isRotating",
  "lastPointerDownWith",
  "mouseMoving",
  "offsetLeft",
  "offsetTop",
  "pendingImageElementId",
  "previousSelectedElementIds",
  "resizingElement",
  "scrolledOutside",
  "scrollX",
  "scrollY",
  "selectedElementIds",
  "selectedGroupIds",
  "selectedLinearElement",
  "selectionElement",
  "shouldCacheIgnoreZoom",
  "startBoundElement",
  "suggestedBindings",
  "toastMessage",
  "zoom",
  "activeEmbeddable",
  "croppingElementId",
  "frameToHighlight",
  "newElement",
  "objectsSnapModeEnabled",
  "snapLines",
  "originSnapOffset",
  "collaborators",
]);

/**
 * Strip volatile fields from AppState before comparison or persistence.
 * Only persistent, user-configurable settings are kept.
 */
function toPersistableAppState(
  appState: AppState & { sketchmindGridEnabled?: boolean },
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const key of Object.keys(appState) as (keyof typeof appState)[]) {
    if (!VOLATILE_APP_STATE_KEYS.has(key as string)) {
      result[key as string] = appState[key];
    }
  }
  return result;
}

/** Stable fingerprint of elements: id + version (covers moves, resizes, edits). */
function elementsFingerprint(elements: readonly ExcalidrawElement[]): string {
  return elements
    .map((el) => `${el.id}:${el.version}:${el.isDeleted ? 1 : 0}`)
    .join("|");
}

interface LatestScene {
  elements: readonly ExcalidrawElement[];
  persistableAppState: Record<string, unknown>;
  files: BinaryFiles;
}

export function useBoardAutoSave({
  boardId,
  debounceMs = 2000,
}: UseBoardAutoSaveOptions) {
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const statusTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestSceneRef = useRef<LatestScene | null>(null);

  // Baselines use lightweight fingerprints/keys to avoid stringifying huge payloads
  const lastSavedElementsFingerprintRef = useRef<string>("");
  const lastSavedAppStateRef = useRef<string>("");
  const lastSavedFileIdsRef = useRef<Set<string>>(new Set());

  const isSavingRef = useRef(false);
  const skipInitialChangeRef = useRef(true);
  const hasPendingChangesRef = useRef(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

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
    async () => {
      if (isSavingRef.current || !latestSceneRef.current) {
        return;
      }

      const { elements, persistableAppState, files } = latestSceneRef.current;

      // --- Compute what changed ---
      const currentFingerprint = elementsFingerprint(elements);
      const elementsChanged = currentFingerprint !== lastSavedElementsFingerprintRef.current;

      const currentAppStateJson = JSON.stringify(persistableAppState);
      const appStateChanged = currentAppStateJson !== lastSavedAppStateRef.current;

      // Only send files that haven't been uploaded yet
      const newFiles: BinaryFiles = {};
      let hasNewFiles = false;
      for (const id of Object.keys(files)) {
        if (!lastSavedFileIdsRef.current.has(id)) {
          newFiles[id] = files[id];
          hasNewFiles = true;
        }
      }

      if (!elementsChanged && !appStateChanged && !hasNewFiles) {
        hasPendingChangesRef.current = false;
        setHasUnsavedChanges(false);
        return;
      }

      isSavingRef.current = true;
      hasPendingChangesRef.current = false;
      setHasUnsavedChanges(true);
      setTransientStatus("saving");

      // Build the smallest possible patch
      const patch: Record<string, unknown> = {};
      if (elementsChanged) patch.elements = elements;
      if (appStateChanged) patch.appState = persistableAppState;
      if (hasNewFiles) patch.files = newFiles;

      try {
        const response = await fetch(`/api/boards/${encodeURIComponent(boardId)}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            canvas_state: patch,
            partial: true,
          }),
        });

        if (!response.ok) {
          const errorPayload = await response.json().catch(() => ({}));
          throw new Error((errorPayload as { error?: string }).error || `Board save failed with status ${response.status}`);
        }

        // Update baselines — only after confirmed success
        if (elementsChanged) lastSavedElementsFingerprintRef.current = currentFingerprint;
        if (appStateChanged) lastSavedAppStateRef.current = currentAppStateJson;
        if (hasNewFiles) {
          for (const id of Object.keys(newFiles)) {
            lastSavedFileIdsRef.current.add(id);
          }
        }

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
        setHasUnsavedChanges(hasPendingChangesRef.current);

        if (hasPendingChangesRef.current) {
          void persistScene();
        }
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
      const persistableAppState = toPersistableAppState(
        appState as AppState & { sketchmindGridEnabled?: boolean },
      );

      if (skipInitialChangeRef.current) {
        skipInitialChangeRef.current = false;
        // Seed baselines from the initial scene so the first real edit is caught
        lastSavedElementsFingerprintRef.current = elementsFingerprint(elements);
        lastSavedAppStateRef.current = JSON.stringify(persistableAppState);
        lastSavedFileIdsRef.current = new Set(Object.keys(files));
        latestSceneRef.current = { elements, persistableAppState, files };
        return;
      }

      latestSceneRef.current = { elements, persistableAppState, files };

      // Quick change detection using the same cheap fingerprints
      const fingerprint = elementsFingerprint(elements);
      const appStateJson = JSON.stringify(persistableAppState);
      const hasNewFiles = Object.keys(files).some(
        (id) => !lastSavedFileIdsRef.current.has(id),
      );
      const hasChanges =
        fingerprint !== lastSavedElementsFingerprintRef.current ||
        appStateJson !== lastSavedAppStateRef.current ||
        hasNewFiles;

      if (!hasChanges) {
        hasPendingChangesRef.current = false;
        setHasUnsavedChanges(false);
        return;
      }

      hasPendingChangesRef.current = true;
      setHasUnsavedChanges(true);

      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }

      timerRef.current = setTimeout(() => {
        void persistScene();
      }, debounceMs);
    },
    [debounceMs, persistScene],
  );

  const flush = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }

    if (latestSceneRef.current) {
      void persistScene();
    }
  }, [persistScene]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (statusTimerRef.current) clearTimeout(statusTimerRef.current);
    };
  }, []);

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasPendingChangesRef.current || isSavingRef.current) {
        e.preventDefault();
        e.returnValue = "";
        void persistScene();
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [persistScene]);

  return {
    flush,
    saveStatus,
    scheduleSave,
    hasUnsavedChanges,
  };
}
