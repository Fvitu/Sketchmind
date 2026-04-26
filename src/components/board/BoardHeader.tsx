import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Download, LoaderCircle, PencilLine, Share2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { boards as boardsApi } from "@/lib/store";
import type { SaveStatus } from "@/types/canvas";
import { PresenceAvatars } from "./PresenceAvatars";
import { ShareDialog } from "./ShareDialog";
import type { useOthers, useSelf } from "@liveblocks/react/suspense";

type ConnectionStatus = "initial" | "connecting" | "connected" | "reconnecting" | "disconnected";

interface BoardHeaderProps {
  boardId: string;
  boardName: string;
  canEdit: boolean;
  isExporting: boolean;
  saveStatus: SaveStatus;
  connectionStatus?: ConnectionStatus;
  isOwner?: boolean;
  self?: ReturnType<typeof useSelf>;
  others?: ReturnType<typeof useOthers>;
  onBoardNameChange: (nextName: string) => void;
  onExportPNG: () => void;
  onShared?: () => void;
}

const saveStatusLabel: Record<SaveStatus, string> = {
  idle: "",
  saving: "Saving...",
  saved: "Saved",
  error: "Save failed",
};

const saveStatusTone: Record<SaveStatus, string> = {
  idle: "text-transparent",
  saving: "text-muted-foreground",
  saved: "text-emerald-400",
  error: "text-destructive",
};

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
  onBoardNameChange,
  onExportPNG,
  onShared,
}: BoardHeaderProps) {
  const [draftName, setDraftName] = useState(boardName);
  const [isEditing, setIsEditing] = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setDraftName(boardName);
  }, [boardName]);

  useEffect(() => {
    if (isEditing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [isEditing]);

  const handleRename = async () => {
    const trimmed = draftName.trim();

    setIsEditing(false);

    if (!trimmed) {
      setDraftName(boardName);
      return;
    }

    if (trimmed === boardName) {
      return;
    }

    setIsRenaming(true);

    try {
      const updated = await boardsApi.rename("", boardId, trimmed);
      onBoardNameChange(updated.title);
      toast.success("Board renamed");
    } catch (error) {
      setDraftName(boardName);
      toast.error(error instanceof Error ? error.message : "Couldn't rename board");
    } finally {
      setIsRenaming(false);
    }
  };

  return (
    <header className="relative z-10 flex h-14 items-center gap-3 border-b border-border/55 bg-background/72 px-4 backdrop-blur-2xl backdrop-saturate-150 shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_10px_28px_-24px_rgba(0,0,0,0.62)] supports-[backdrop-filter]:bg-background/64 supports-[backdrop-filter]:shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_10px_28px_-24px_rgba(0,0,0,0.62)] before:pointer-events-none before:absolute before:inset-0 before:bg-gradient-to-b before:from-white/[0.04] before:via-transparent before:to-black/[0.03] before:content-['']">
      <Link
        to="/dashboard"
        className="text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        ← Dashboard
      </Link>

      <span className="text-border">|</span>

      <div className="min-w-0 flex-1">
        {canEdit && isEditing ? (
          <Input
            ref={inputRef}
            value={draftName}
            onChange={(event) => setDraftName(event.target.value)}
            onBlur={() => {
              void handleRename();
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                void handleRename();
              }

              if (event.key === "Escape") {
                setDraftName(boardName);
                setIsEditing(false);
              }
            }}
            maxLength={80}
            disabled={isRenaming}
            className="h-9 w-full max-w-sm bg-transparent"
            aria-label="Board name"
          />
        ) : (
          <button
            type="button"
            onClick={() => {
              if (!canEdit || isRenaming) {
                return;
              }

              setIsEditing(true);
            }}
            className={cn(
              "flex max-w-sm items-center gap-2 truncate text-left text-sm font-medium text-foreground",
              canEdit && "transition-colors hover:text-primary",
            )}
            disabled={!canEdit || isRenaming}
            title={canEdit ? "Rename board" : boardName}
          >
            <span className="truncate">{boardName}</span>
            {canEdit && <PencilLine className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />}
          </button>
        )}
      </div>

      {!canEdit && (
        <span className="rounded-md border border-border bg-accent/60 px-2 py-1 text-[11px] uppercase tracking-wide text-muted-foreground">
          View only
        </span>
      )}





      <span className={cn("min-w-16 text-right text-xs transition-colors", saveStatusTone[saveStatus])}>
        {saveStatusLabel[saveStatus]}
      </span>

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
        className="gap-2"
      >
        {isExporting ? (
          <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Download className="h-3.5 w-3.5" />
        )}
        Export PNG
      </Button>

      {/* Share button — visible only to the board owner */}
      {isOwner && (
        <Button
          type="button"
          size="sm"
          onClick={() => setIsShareModalOpen(true)}
          className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90"
        >
          <Share2 className="h-3.5 w-3.5" />
          Share
        </Button>
      )}

      {/* Share modal */}
      <ShareDialog
        boardId={boardId}
        boardName={boardName}
        isOpen={isShareModalOpen}
        onClose={() => setIsShareModalOpen(false)}
        onShared={onShared}
      />
    </header>
  );
}
