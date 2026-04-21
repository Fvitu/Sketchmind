import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Pencil } from "lucide-react";
import { Board } from "@/lib/store";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

type Props = {
  board: Board | null;
  onClose: () => void;
  onSubmit: (title: string) => void;
};

export const RenameDialog = ({ board, onClose, onSubmit }: Props) => {
  const [title, setTitle] = useState("");
  useEffect(() => { if (board) setTitle(board.title); }, [board]);

  return (
    <Dialog open={!!board} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Rename board</DialogTitle>
          <DialogDescription>Give your board a clearer name.</DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const t = title.trim();
            if (!t) return;
            onSubmit(t);
          }}
          className="space-y-4"
        >
          <Input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={80} autoFocus placeholder="Untitled board" />
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
            <Button
              type="submit"
              disabled={!title.trim()}
              className="gap-2 bg-gradient-brand text-primary-foreground transition-transform hover:scale-[1.03] active:scale-95"
            >
              <motion.span
                whileHover={{ rotate: -10, scale: 1.15 }}
                whileTap={{ scale: 0.85 }}
                transition={{ type: "spring", stiffness: 400, damping: 14 }}
                className="inline-flex"
              >
                <Pencil className="h-4 w-4" />
              </motion.span>
              Save
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
