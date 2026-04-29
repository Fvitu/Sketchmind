import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Download, LoaderCircle, PencilLine, Share2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { boards as boardsApi } from "@/lib/store";
import type { SaveStatus } from "@/types/canvas";
import { PresenceAvatars } from "./PresenceAvatars";
import { ShareDialog } from "./ShareDialog";
import { RenameDialog } from "./RenameDialog";
import { useOthers, useSelf } from "@liveblocks/react/suspense";
import { motion } from "framer-motion";

const MotionLink = motion(Link);

type ConnectionStatus = "initial" | "connecting" | "connected" | "reconnecting" | "disconnected";

interface BoardHeaderProps {
  boardId: string;
  boardName: string;
  canEdit: boolean;
  isExporting: boolean;
  saveStatus: SaveStatus;
  connectionStatus?: ConnectionStatus;
  isOwner?: boolean;
  self?: any;
  others?: readonly any[];
  isShared: boolean;
  onBoardNameChange: (nextName: string) => void;
  onExportPNG: () => void;
  onShared?: () => void;
  onUnshared?: () => void;
  hasUnsavedChanges?: boolean;
}



export function BoardHeader({
  boardId,
  boardName,
  canEdit,
  isExporting,
  saveStatus,
  connectionStatus,
  isOwner = false,
  self,
  others,
  isShared,
  onBoardNameChange,
  onExportPNG,
  onShared,
  onUnshared,
  hasUnsavedChanges = false,
}: BoardHeaderProps) {
  const navigate = useNavigate();
  const [isRenameDialogOpen, setIsRenameDialogOpen] = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);


  const handleRename = async (nextName: string) => {
    setIsRenaming(true);

    try {
      const updated = await boardsApi.rename("", boardId, nextName);
      onBoardNameChange(updated.title);
      toast.success("Board renamed");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't rename board");
      throw error; // Re-throw to be caught by the dialog
    } finally {
      setIsRenaming(false);
    }
  };

  return (
    <header className="sketchmind-topbar relative z-10 flex h-14 items-center gap-2 sm:gap-3 border-b border-border/55 bg-background/72 px-4 backdrop-blur-2xl backdrop-saturate-150 shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_10px_28px_-24px_rgba(0,0,0,0.62)] supports-[backdrop-filter]:bg-background/64 supports-[backdrop-filter]:shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_10px_28px_-24px_rgba(0,0,0,0.62)] before:pointer-events-none before:absolute before:inset-0 before:bg-gradient-to-b before:from-white/[0.04] before:via-transparent before:to-black/[0.03] before:content-['']">
      <motion.button
        type="button"
        onClick={() => {
          if (hasUnsavedChanges && !window.confirm("You have unsaved changes that may be lost. Are you sure you want to leave?")) {
            return;
          }
          navigate("/dashboard");
        }}
        whileHover="hover"
        whileTap="tap"
        className="group relative flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-border/40 bg-background/40 transition-all hover:border-primary/40 hover:bg-primary/5 hover:shadow-[0_0_15px_-3px_rgba(34,211,238,0.2)]"
        title="Back to Dashboard"
      >
        <motion.div
          variants={{
            hover: { x: -2 },
            tap: { scale: 0.92 }
          }}
          transition={{ type: "spring", stiffness: 400, damping: 17 }}
        >
          <ArrowLeft className="h-4 w-4 text-muted-foreground transition-colors group-hover:text-primary" />
        </motion.div>
      </motion.button>

      <div className="min-w-0 flex-1">
        <button
          type="button"
          onClick={() => {
            if (!canEdit || isRenaming) {
              return;
            }

            setIsRenameDialogOpen(true);
          }}
          style={{ maxWidth: "clamp(120px, 50vw, 600px)" }}
          className={cn(
            "flex items-center gap-2 truncate text-left text-sm font-medium text-foreground",
            canEdit && "transition-colors hover:text-primary",
          )}
          disabled={!canEdit || isRenaming}
          title={canEdit ? "Rename board" : boardName}
        >
          <span className="truncate">{boardName}</span>
          {canEdit && <PencilLine className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />}
        </button>
      </div>



      {!canEdit && (
        <span className="rounded-md border border-border bg-accent/60 px-2 py-1 text-[11px] uppercase tracking-wide text-muted-foreground">
          View only
        </span>
      )}







      {/* Connection status indicator */}
      {connectionStatus && (
        <div className="flex items-center gap-1.5">
          <div
            className={cn(
              "h-1.5 w-1.5 rounded-full transition-colors",
              connectionStatus === "connected" && "bg-green-500",
              (connectionStatus === "reconnecting" || connectionStatus === "connecting") && "bg-yellow-500 animate-pulse",
              (connectionStatus === "initial" || connectionStatus === "disconnected") && "bg-muted-foreground",
            )}
            title={connectionStatus}
          />
          {connectionStatus === "reconnecting" && (
            <span className="text-xs text-muted-foreground">Reconnecting...</span>
          )}
        </div>
      )}

      {/* Presence avatars moved next to Export PNG */}
      {self !== undefined && others !== undefined && (
        <PresenceAvatars self={self} others={others} />
      )}

      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={onExportPNG}
        disabled={isExporting}
        className="btn-export gap-2"
        title="Export PNG"
      >
        {isExporting ? (
          <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Download className="h-3.5 w-3.5" />
        )}
        <span className="hidden md:inline">Export PNG</span>
      </Button>

      {/* Share button — visible only to the board owner */}
      {isOwner && (
        <Button
          type="button"
          size="sm"
          onClick={() => setIsShareModalOpen(true)}
          className="btn-share gap-2 bg-primary text-primary-foreground hover:bg-primary/90"
          title="Share"
        >
          <Share2 className="h-3.5 w-3.5" />
          <span className="hidden md:inline">Share</span>
        </Button>
      )}

      {/* Share modal */}
      <ShareDialog
        boardId={boardId}
        boardName={boardName}
        isOpen={isShareModalOpen}
        isShared={isShared}
        onClose={() => setIsShareModalOpen(false)}
        onShared={onShared}
        onUnshared={onUnshared}
      />

      {/* Rename modal */}
      <RenameDialog
        boardId={boardId}
        currentName={boardName}
        isOpen={isRenameDialogOpen}
        onClose={() => setIsRenameDialogOpen(false)}
        onRename={handleRename}
      />
    </header>
  );
}
