import { useCallback } from "react";

export function useImageUpload(boardId: string) {
  const upload = useCallback(
    async (file: File): Promise<string> => {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch(`/api/boards/${encodeURIComponent(boardId)}/assets`, {
        method: "POST",
        body: formData,
      });

      const payload = await response.json().catch(() => ({}));

      if (!response.ok || typeof payload?.url !== "string") {
        throw new Error(
          payload && typeof payload.error === "string" ? payload.error : "Upload failed",
        );
      }

      return payload.url;
    },
    [boardId],
  );

  return { upload };
}
