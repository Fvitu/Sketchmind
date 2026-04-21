import { useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { MoreHorizontal, Pencil, Trash2, Lock } from "lucide-react";
import { Board } from "@/lib/store";
import { relativeTime } from "@/lib/format";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

type Props = {
  board: Board;
  onRename: (b: Board) => void;
  onDelete: (b: Board) => void;
};

const palettes = [
  "from-[hsl(195_80%_55%/0.25)] to-[hsl(220_80%_55%/0.15)]",
  "from-[hsl(280_70%_60%/0.22)] to-[hsl(200_70%_55%/0.12)]",
  "from-[hsl(150_60%_55%/0.22)] to-[hsl(195_70%_55%/0.12)]",
  "from-[hsl(40_85%_60%/0.22)] to-[hsl(20_70%_55%/0.12)]",
  "from-[hsl(330_70%_60%/0.22)] to-[hsl(260_70%_55%/0.12)]",
];

const handStrokes = [
  "M10 80 C 60 20, 140 140, 200 60",
  "M20 60 Q 100 130, 190 50",
  "M30 100 C 80 20, 130 130, 200 40",
  "M15 50 Q 90 110, 200 70",
];

export const BoardCard = ({ board, onRename, onDelete }: Props) => {
  const [open, setOpen] = useState(false);
  const seed = board.id.charCodeAt(0) + board.id.charCodeAt(board.id.length - 1);
  const palette = palettes[seed % palettes.length];
  const stroke = handStrokes[seed % handStrokes.length];

  return (
    <motion.div
      data-reactive-glow
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      whileHover={{ y: -3 }}
      className="group relative rounded-2xl border border-border bg-gradient-card shadow-soft transition-colors overflow-hidden"
    >
      <Link to={`/board/${board.id}`} className="block">
        <div className={`relative aspect-[16/10] overflow-hidden bg-gradient-to-br ${palette}`}>
          <div className="absolute inset-0 bg-dotgrid opacity-60" />
          <svg viewBox="0 0 220 140" className="absolute inset-0 w-full h-full p-6">
            <path d={stroke} stroke="hsl(var(--primary))" strokeOpacity="0.55" strokeWidth="2.5" fill="none" strokeLinecap="round" />
            <circle cx="50" cy="40" r="14" stroke="hsl(var(--foreground))" strokeOpacity="0.18" strokeWidth="2" fill="none" />
            <rect x="140" y="80" width="40" height="28" rx="4" stroke="hsl(var(--foreground))" strokeOpacity="0.18" strokeWidth="2" fill="none" />
          </svg>
        </div>
      </Link>

      <div className="flex items-start justify-between gap-2 p-4">
        <Link to={`/board/${board.id}`} className="min-w-0 flex-1">
          <h3 className="truncate text-sm font-semibold text-foreground group-hover:text-primary transition-colors">
            {board.title}
          </h3>
          <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1 rounded-md bg-accent/60 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide">
              <Lock className="h-2.5 w-2.5" /> Private
            </span>
            <span>·</span>
            <span>Edited {relativeTime(board.last_edited_at)}</span>
          </div>
        </Link>

        <DropdownMenu open={open} onOpenChange={setOpen}>
          <DropdownMenuTrigger asChild>
            <motion.button
              whileHover={{ scale: 1.1, rotate: 360 }}
              transition={{ duration: 0.45, ease: "easeOut" }}
              className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground opacity-0 group-hover:opacity-100 data-[state=open]:opacity-100 transition-opacity"
              aria-label="Board actions"
            >
              <MoreHorizontal className="h-4 w-4" />
            </motion.button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            className="w-40 data-[state=open]:[animation:none] data-[state=closed]:[animation:none]"
          >
            <DropdownMenuItem
              onClick={() => onRename(board)}
              className="group/item gap-2 focus:bg-accent focus:text-foreground"
            >
              <Pencil className="h-4 w-4 transition-transform duration-200 group-hover/item:scale-125 group-hover/item:-rotate-12" />
              Rename
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => onDelete(board)}
              className="text-destructive focus:text-destructive focus:bg-destructive/10 group/item gap-2"
            >
              <Trash2 className="h-4 w-4 transition-transform duration-200 group-hover/item:scale-125 group-hover/item:-rotate-12" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </motion.div>
  );
};
