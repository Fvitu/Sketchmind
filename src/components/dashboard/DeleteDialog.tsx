import { motion } from "framer-motion";
import { Trash2 } from "lucide-react";
import { Board } from "@/lib/store";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export const DeleteDialog = ({
  board,
  onClose,
  onConfirm,
}: {
  board: Board | null;
  onClose: () => void;
  onConfirm: () => void;
}) => (
  <AlertDialog open={!!board} onOpenChange={(o) => !o && onClose()}>
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>Delete this board?</AlertDialogTitle>
        <AlertDialogDescription>
          “{board?.title}” will be permanently removed. This can’t be undone.
        </AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel onClick={onClose}>Cancel</AlertDialogCancel>
        <AlertDialogAction
          onClick={onConfirm}
          className="group bg-destructive text-destructive-foreground hover:bg-destructive/90 transition-transform hover:scale-[1.03] active:scale-95 gap-2"
        >
          <motion.span
            whileHover={{ rotate: -8, scale: 1.15 }}
            whileTap={{ scale: 0.85 }}
            transition={{ type: "spring", stiffness: 400, damping: 14 }}
            className="inline-flex"
          >
            <Trash2 className="h-4 w-4" />
          </motion.span>
          Delete
        </AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
);
