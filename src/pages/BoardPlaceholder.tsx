import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { boards as boardsApi } from "@/lib/store";
import { BoardCanvas } from "@/components/board/BoardCanvas";
import type { CanvasData } from "@/types/canvas";

const BoardPlaceholder = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [status, setStatus] = useState<"loading" | "ready" | "missing">("loading");
  const [board, setBoard] = useState<Awaited<ReturnType<typeof boardsApi.get>>>(null);

  useEffect(() => {
    if (!id) {
      navigate("/dashboard", { replace: true });
      return;
    }

    let active = true;

    const load = async () => {
      try {
        const nextBoard = await boardsApi.get(id);
        if (!active) {
          return;
        }

        if (!nextBoard) {
          setStatus("missing");
          return;
        }

        setBoard(nextBoard);
        setStatus("ready");
      } catch (error) {
        if (!active) {
          return;
        }

        console.error(error);
        setStatus("missing");
      }
    };

    void load();

    return () => {
      active = false;
    };
  }, [id, navigate]);

  useEffect(() => {
    if (status !== "missing") {
      return;
    }

    toast.error("Board not found or you don't have access.");
    navigate("/dashboard", { replace: true });
  }, [navigate, status]);

  if (status !== "ready" || !board) {
    return <div className="min-h-screen bg-background" />;
  }

  return (
    <BoardCanvas
      boardId={board.id}
      boardName={board.title}
      initialCanvasData={board.canvas_state as CanvasData | null}
      role={board.role ?? "owner"}
    />
  );
};

export default BoardPlaceholder;
