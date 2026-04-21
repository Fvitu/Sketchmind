import { useState } from "react";
import { Plus, Sparkles } from "lucide-react";
import { motion } from "framer-motion";
import { useAuthUser, useBoards, boards as boardsApi, BOARD_LIMIT, Board } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { BoardCard } from "@/components/dashboard/BoardCard";
import { RenameDialog } from "@/components/dashboard/RenameDialog";
import { DeleteDialog } from "@/components/dashboard/DeleteDialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

const Dashboard = () => {
  const user = useAuthUser();
  const { boards: list, loading, refresh } = useBoards(user?.id);
  const navigate = useNavigate();
  const [renameTarget, setRenameTarget] = useState<Board | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Board | null>(null);

  if (!user) return null;

  if (loading) {
		return <DashboardSkeleton />;
  }

  const atLimit = list.length >= BOARD_LIMIT;

  const handleCreate = async () => {
    if (atLimit) {
      toast.error(`You've reached the ${BOARD_LIMIT} board limit.`);
      return;
    }

    try {
      const b = await boardsApi.create(user.id);
      toast.success("Board created");
      navigate(`/board/${b.id}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't create board");
    }
  };

  const handleRename = async (title: string) => {
    if (!renameTarget) return;

    try {
      await boardsApi.rename(user.id, renameTarget.id, title);
      toast.success("Renamed");
      setRenameTarget(null);
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't rename");
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;

    try {
      await boardsApi.remove(user.id, deleteTarget.id);
      toast.success("Board deleted");
      setDeleteTarget(null);
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't delete board");
    }
  };

  return (
		<motion.div
			initial={{ opacity: 0, y: 15, scale: 0.98 }}
			animate={{ opacity: 1, y: 0, scale: 1 }}
			transition={{ type: "spring", stiffness: 400, damping: 30, mass: 1 }}
			className="space-y-8">
			<header className="flex items-end justify-between gap-4 flex-wrap">
				<div>
					<p className="text-sm text-muted-foreground">Welcome back, {user.display_name.split(" ")[0]}</p>
					<h1 className="mt-1 text-3xl font-semibold tracking-tight">
						Your <span className="font-hand text-4xl text-gradient-brand leading-[1.2] inline-block pb-1.5 pr-1">boards</span>
					</h1>
				</div>
				<div className="flex items-center gap-3">
					<span className="text-xs text-muted-foreground tabular-nums">
						{list.length} / {BOARD_LIMIT}
					</span>
					<Button
						onClick={() => {
							void handleCreate();
						}}
						disabled={atLimit}
						className="group/new gap-2 bg-gradient-brand text-primary-foreground hover:opacity-90 disabled:opacity-50 transition-transform hover:scale-[1.03] active:scale-95">
						<Plus className="h-4 w-4 transition-transform duration-300 ease-out group-hover/new:rotate-90" />
						New board
					</Button>
				</div>
			</header>

			{atLimit && (
				<div className="rounded-xl border border-warning/40 bg-warning/5 p-3 text-xs text-warning flex items-center gap-2">
					<Sparkles className="h-3.5 w-3.5" />
					You've reached the {BOARD_LIMIT}-board limit. Delete one to create another.
				</div>
			)}

			{list.length === 0 ? (
				<EmptyState
					onCreate={() => {
						void handleCreate();
					}}
				/>
			) : (
				<div className="grid gap-5 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
					{list.map((b) => (
						<BoardCard key={b.id} board={b} onRename={setRenameTarget} onDelete={setDeleteTarget} />
					))}
				</div>
			)}

			<RenameDialog
				board={renameTarget}
				onClose={() => setRenameTarget(null)}
				onSubmit={(title) => {
					void handleRename(title);
				}}
			/>
			<DeleteDialog
				board={deleteTarget}
				onClose={() => setDeleteTarget(null)}
				onConfirm={() => {
					void handleDelete();
				}}
			/>
		</motion.div>
  );
};

const DashboardSkeleton = () => (
	<motion.div
		initial={{ opacity: 0, y: 15, scale: 0.98 }}
		animate={{ opacity: 1, y: 0, scale: 1 }}
		transition={{ type: "spring", stiffness: 400, damping: 30, mass: 1 }}
		className="space-y-8"
		aria-busy="true">
		<header className="flex items-end justify-between gap-4 flex-wrap">
			<div className="space-y-3">
				<Skeleton className="h-4 w-40" />
				<Skeleton className="h-10 w-72 max-w-full" />
			</div>
			<div className="flex items-center gap-3">
				<Skeleton className="h-4 w-16" />
				<Skeleton className="h-10 w-32 rounded-md" />
			</div>
		</header>

		<div className="grid gap-5 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
			{Array.from({ length: 6 }).map((_, index) => (
				<motion.div
					key={index}
					initial={{ opacity: 0, y: 15, scale: 0.98 }}
					animate={{ opacity: 1, y: 0, scale: 1 }}
					transition={{ type: "spring", stiffness: 400, damping: 30, mass: 1, delay: index * 0.05 }}
					className="overflow-hidden rounded-2xl border border-border bg-gradient-card shadow-soft">
					<Skeleton className="aspect-[16/10] w-full rounded-none bg-muted/70" />
					<div className="space-y-3 p-4">
						<Skeleton className="h-5 w-4/5" />
						<div className="flex items-center gap-2">
							<Skeleton className="h-5 w-16 rounded-md" />
							<Skeleton className="h-4 w-2" />
							<Skeleton className="h-4 w-24" />
						</div>
					</div>
				</motion.div>
			))}
		</div>

		<span className="sr-only">Loading boards</span>
	</motion.div>
);

const EmptyState = ({ onCreate }: { onCreate: () => void }) => (
  <div className="relative overflow-hidden rounded-2xl border border-border bg-gradient-card p-10 sm:p-16 text-center">
    <div className="absolute inset-0 bg-dotgrid opacity-40" />
    <div className="relative space-y-5 max-w-md mx-auto">
      <div className="mx-auto h-14 w-14 rounded-2xl bg-gradient-brand grid place-items-center shadow-glow-accent">
        <Plus className="h-6 w-6 text-primary-foreground" />
      </div>
      <div className="space-y-2">
        <h2 className="text-2xl font-semibold tracking-tight">
          A blank page,<br />
          <span className="font-hand text-3xl text-gradient-brand leading-[1.2] inline-block pb-1.5 pr-1">infinite ideas.</span>
        </h2>
        <p className="text-sm text-muted-foreground">
          Sketchmind is your visual workspace for studying and thinking. Start by creating your first board.
        </p>
      </div>
      <Button onClick={onCreate} className="gap-2 bg-gradient-brand text-primary-foreground hover:opacity-90">
        <Plus className="h-4 w-4 !transform-none" /> Create your first board
      </Button>
    </div>
  </div>
);

export default Dashboard;
