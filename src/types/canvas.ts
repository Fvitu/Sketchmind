import type {
  AppState,
  BinaryFiles,
  ExcalidrawElement,
} from "@excalidraw/excalidraw/types";

export interface CanvasData {
  type: "excalidraw";
  version: number;
  source: string;
  elements: ExcalidrawElement[];
  appState: Partial<AppState>;
  files: BinaryFiles;
}

export type SaveStatus = "idle" | "saving" | "saved" | "error";
