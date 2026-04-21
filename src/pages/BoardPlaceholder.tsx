import { Link, useNavigate, useParams } from "react-router-dom";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Sparkles, Pencil } from "lucide-react";
import { boards as boardsApi, Board, useAuthUser } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/brand/Logo";
import { RenameDialog } from "@/components/dashboard/RenameDialog";
import { toast } from "sonner";
import { relativeTime } from "@/lib/format";

const BoardPlaceholder = () => {
  const { id } = useParams<{ id: string }>();
  const user = useAuthUser();
  const navigate = useNavigate();
  const [board, setBoard] = useState<Board | null>(null);
  const [renaming, setRenaming] = useState<Board | null>(null);

  useEffect(() => {
    if (!id) return;

    let active = true;
    const load = async () => {
      try {
        const b = await boardsApi.get(id);
        if (!active || !b || (user && b.owner_id !== user.id)) {
          toast.error("Board not found");
          navigate("/dashboard", { replace: true });
          return;
        }

        setBoard(b);
      } catch (e) {
        if (!active) return;
        toast.error(e instanceof Error ? e.message : "Board not found");
        navigate("/dashboard", { replace: true });
      }
    };

    void load();

    return () => {
      active = false;
    };
  }, [id, user, navigate]);

  if (!board) return null;

  const handleRename = async (title: string) => {
    if (!user) return;

    try {
      const next = await boardsApi.rename(user.id, board.id, title);
      setBoard(next);
      setRenaming(null);
      toast.success("Renamed");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't rename");
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="flex items-center justify-between gap-4 px-5 sm:px-8 h-14 border-b border-border bg-background/80 backdrop-blur">
        <div className="flex items-center gap-3 min-w-0">
          <Link to="/dashboard" className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors" aria-label="Back to dashboard">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <Logo showWordmark={false} />
          <div className="h-5 w-px bg-border mx-1" />
          <button
            onClick={() => setRenaming(board)}
            className="group flex items-center gap-2 min-w-0 rounded-md px-2 py-1 hover:bg-accent transition-colors"
          >
            <span className="truncate text-sm font-medium">{board.title}</span>
            <Pencil className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
          </button>
        </div>
        <div className="hidden sm:flex items-center gap-2 text-xs text-muted-foreground">
          <span className="rounded-md bg-accent/60 px-2 py-1">Private</span>
          <span>Edited {relativeTime(board.last_edited_at)}</span>
        </div>
      </header>

      <main className="flex-1 relative overflow-hidden bg-grid">
        <div className="absolute inset-0 grid place-items-center p-6">
          <motion.div
            initial={{ opacity: 0, scale: 0.92 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            className="max-w-md text-center space-y-5"
          >
            <motion.div
              animate={{ y: [0, -6, 0] }}
              transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
              className="mx-auto h-14 w-14 rounded-2xl bg-gradient-brand grid place-items-center shadow-glow-accent"
            >
              <Sparkles className="h-6 w-6 text-primary-foreground" />
            </motion.div>
            <div className="space-y-2">
              <h1 className="text-3xl font-semibold tracking-tight">
                Canvas <span className="font-hand text-4xl text-gradient-brand">coming soon</span>
              </h1>
              <p className="text-sm text-muted-foreground leading-relaxed">
                The collaborative drawing surface lands in the next phase. For now this is a placeholder so the routing and data model are ready.
              </p>
            </div>
            <Button asChild variant="outline">
              <Link to="/dashboard"><ArrowLeft className="h-4 w-4 mr-1.5" /> Back to dashboard</Link>
            </Button>
          </motion.div>
        </div>
      </main>

      <RenameDialog
        board={renaming}
        onClose={() => setRenaming(null)}
        onSubmit={(title) => {
          void handleRename(title);
        }}
      />
    </div>
  );
};

export default BoardPlaceholder;
