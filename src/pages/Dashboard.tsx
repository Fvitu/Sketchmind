import { useState, useMemo, useEffect, useRef, useLayoutEffect } from "react";
import { Plus, Sparkles, Search, ChevronDown, Clock, Calendar, SortAsc } from "lucide-react";
import { motion } from "framer-motion";
import { useAuthUser, useBoards, boards as boardsApi, Board } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { BoardCard } from "@/components/dashboard/BoardCard";
import { RenameDialog } from "@/components/dashboard/RenameDialog";
import { DeleteDialog } from "@/components/dashboard/DeleteDialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type SortOption = "name" | "updated_at" | "created_at";
type TabOption = "my_boards" | "shared";

const sortOptions = [
	{ value: "updated_at", label: "Last edited", icon: Clock },
	{ value: "created_at", label: "Date created", icon: Calendar },
	{ value: "name", label: "Name (A → Z)", icon: SortAsc },
] as const;

const getSavedSort = (): SortOption => {
	const saved = localStorage.getItem("sketchmind_sort_preference");
	if (saved === "name" || saved === "updated_at" || saved === "created_at") {
		return saved;
	}
	return "updated_at";
};

const Dashboard = () => {
	const user = useAuthUser();
	const { boards: list, loading, refresh } = useBoards(user?.id);
	const navigate = useNavigate();
	const [renameTarget, setRenameTarget] = useState<Board | null>(null);
	const [deleteTarget, setDeleteTarget] = useState<Board | null>(null);
	const [activeTab, setActiveTab] = useState<TabOption>("my_boards");
	const [sortBy, setSortBy] = useState<SortOption>(getSavedSort());
	const [sortWidth, setSortWidth] = useState<number | null>(null);
	const measureRef = useRef<HTMLDivElement | null>(null);
	const [searchQuery, setSearchQuery] = useState("");
	const activeSort = sortOptions.find((option) => option.value === sortBy) ?? sortOptions[0];
	const ActiveSortIcon = activeSort.icon;

	useEffect(() => {
		localStorage.setItem("sketchmind_sort_preference", sortBy);
	}, [sortBy]);

	useLayoutEffect(() => {
		if (!measureRef.current) return;
		setSortWidth(Math.ceil(measureRef.current.scrollWidth));
	}, []);

	useEffect(() => {
		setSearchQuery("");
	}, [activeTab]);

	const myBoards = useMemo(() => list.filter((b) => b.owner_id === user?.id), [list, user?.id]);
	const sharedBoards = useMemo(() => list.filter((b) => b.owner_id !== user?.id), [list, user?.id]);

	const currentList = activeTab === "my_boards" ? myBoards : sharedBoards;

	const filteredList = useMemo(() => {
		let result = [...currentList];
		if (searchQuery.trim()) {
			const q = searchQuery.toLowerCase();
			result = result.filter((b) => b.title.toLowerCase().includes(q));
		}

		result.sort((a, b) => {
			if (sortBy === "name") {
				return a.title.localeCompare(b.title);
			} else if (sortBy === "created_at") {
				return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
			} else {
				return new Date(b.last_edited_at).getTime() - new Date(a.last_edited_at).getTime();
			}
		});

		return result;
	}, [currentList, searchQuery, sortBy]);

	if (loading) {
		return <DashboardSkeleton />;
	}

	if (!user) return null;

	const boardLimit = user.board_limit;
	const atLimit = list.length >= boardLimit;
	const activeBoardId = renameTarget?.id ?? deleteTarget?.id;

	const handleCreate = async () => {
		if (atLimit) {
			toast.error(`You've reached your database-defined limit of ${boardLimit} boards.`);
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

	const handleDuplicate = async (board: Board) => {
		try {
			const duplicate = await boardsApi.create(user.id, `Copy of ${board.title}`, {
				description: board.description,
				visibility: board.visibility,
				thumbnail_path: board.thumbnail_path,
				canvas_state: board.canvas_state ? JSON.parse(JSON.stringify(board.canvas_state)) : null,
			});
			toast.success("Board duplicated");
			navigate(`/board/${duplicate.id}`);
		} catch (e) {
			toast.error(e instanceof Error ? e.message : "Couldn't duplicate board");
		}
	};

	const handleDelete = async () => {
		if (!deleteTarget) return;

		// If this is a shared board, leave it instead of deleting
		if (deleteTarget.owner_id !== user.id) {
			try {
				await fetch(`/api/boards/${encodeURIComponent(deleteTarget.id)}/leave`, {
					method: "DELETE",
				});
				toast.success("Removed from your shared boards");
				setDeleteTarget(null);
				await refresh();
			} catch (e) {
				toast.error(e instanceof Error ? e.message : "Couldn't leave board");
			}
			return;
		}

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
				<div className="flex flex-col sm:flex-row items-end sm:items-center gap-3 w-full sm:w-auto">
					<div className="relative w-full sm:w-[200px]">
						<Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
						<input
							type="text"
							placeholder="Search boards..."
							value={searchQuery}
							onChange={(e) => setSearchQuery(e.target.value)}
							className="w-full h-9 pl-9 pr-8 rounded-lg bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.1)] text-sm focus:outline-none focus:ring-1 focus:ring-primary focus:border-transparent transition-all placeholder:text-[rgba(255,255,255,0.45)]"
						/>
						{searchQuery && (
							<button
								onClick={() => setSearchQuery("")}
								className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
								<span className="text-lg leading-none">&times;</span>
							</button>
						)}
					</div>

					<DropdownMenu>
						<DropdownMenuTrigger asChild>
							<Button
								variant="outline"
								className="h-9 rounded-lg bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.1)] text-sm px-3 hover:bg-[rgba(255,255,255,0.08)] font-normal justify-between group/sort whitespace-nowrap"
								style={sortWidth ? { width: `${sortWidth}px` } : undefined}>
								<span className="inline-flex items-center gap-2 min-w-0">
									<ActiveSortIcon className="h-4 w-4 flex-shrink-0 transition-transform duration-200 group-hover/sort:scale-110 group-hover/sort:-rotate-6" />
									<span>{activeSort.label}</span>
								</span>
								<ChevronDown className="h-4 w-4 ml-2 opacity-50" />
							</Button>
						</DropdownMenuTrigger>
						<DropdownMenuContent
							align="end"
							className="bg-background border-[rgba(255,255,255,0.1)]"
							style={sortWidth ? { width: `${sortWidth}px` } : undefined}>
							{sortOptions.map((option) => {
								const OptionIcon = option.icon;

								return (
									<DropdownMenuItem
										key={option.value}
										className="text-sm cursor-pointer group/item gap-2"
										onClick={() => setSortBy(option.value)}>
										<OptionIcon className="h-4 w-4 transition-transform duration-200 group-hover/item:scale-125 group-hover/item:-rotate-12" />
										{option.label}
									</DropdownMenuItem>
								);
							})}
						</DropdownMenuContent>
					</DropdownMenu>
					<div
						ref={measureRef}
						className="absolute left-[-9999px] top-0 pointer-events-none flex flex-col gap-2 whitespace-nowrap text-sm"
						aria-hidden>
						{sortOptions.map((option) => {
							const OptionIcon = option.icon;

							return (
								<div
									key={option.value}
									className="inline-flex h-9 items-center justify-between rounded-lg border border-[rgba(255,255,255,0.1)] px-3 font-normal">
									<span className="inline-flex items-center gap-2">
										<OptionIcon className="h-4 w-4 flex-shrink-0" />
										<span>{option.label}</span>
									</span>
									<ChevronDown className="h-4 w-4 ml-2 opacity-50" />
								</div>
							);
						})}
					</div>

					<div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-start mt-2 sm:mt-0">
						<span className="text-xs text-muted-foreground tabular-nums whitespace-nowrap">
							{list.length} / {boardLimit}
						</span>
						<Button
							onClick={() => {
								void handleCreate();
							}}
							disabled={atLimit}
							className="group/new gap-2 bg-gradient-brand text-primary-foreground hover:opacity-90 disabled:opacity-50 transition-transform hover:scale-[1.03] active:scale-95 whitespace-nowrap">
							<Plus className="h-4 w-4 transition-transform duration-300 ease-out group-hover/new:rotate-90" />
							New board
						</Button>
					</div>
				</div>
			</header>

			<div className="flex gap-2">
				<button
					onClick={() => setActiveTab("my_boards")}
					className={cn(
						"px-4 py-1.5 rounded-full text-sm font-medium transition-all",
						activeTab === "my_boards"
							? "bg-[rgba(255,255,255,0.1)] text-primary shadow-[inset_0_0_0_1px_rgba(34,211,238,0.2)]"
							: "bg-transparent text-[rgba(255,255,255,0.45)] hover:text-[rgba(255,255,255,0.7)]",
					)}>
					My Boards ({myBoards.length})
				</button>
				<button
					onClick={() => setActiveTab("shared")}
					className={cn(
						"px-4 py-1.5 rounded-full text-sm font-medium transition-all",
						activeTab === "shared"
							? "bg-[rgba(255,255,255,0.1)] text-primary shadow-[inset_0_0_0_1px_rgba(34,211,238,0.2)]"
							: "bg-transparent text-[rgba(255,255,255,0.45)] hover:text-[rgba(255,255,255,0.7)]",
					)}>
					Shared with me ({sharedBoards.length})
				</button>
			</div>

			{atLimit && (
				<div className="rounded-xl border border-warning/40 bg-warning/5 p-3 text-xs text-warning flex items-center gap-2">
					<Sparkles className="h-3.5 w-3.5" />
					You've reached the database-defined limit of {boardLimit} boards. Delete one to create another.
				</div>
			)}

			{list.length === 0 && activeTab === "my_boards" && searchQuery === "" ? (
				<div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
					<p className="text-muted-foreground">You don't have any boards yet.</p>
					<Button onClick={() => void handleCreate()} disabled={atLimit} className="gap-2 bg-gradient-brand text-primary-foreground">
						<Plus className="h-4 w-4" />
						Create your first board
					</Button>
				</div>
			) : activeTab === "shared" && sharedBoards.length === 0 && searchQuery === "" ? (
				<div className="flex items-center justify-center py-20">
					<p className="text-[rgba(255,255,255,0.35)]">No one has shared a board with you yet.</p>
				</div>
			) : filteredList.length === 0 && searchQuery !== "" ? (
				<div className="flex items-center justify-center py-20">
					<p className="text-[rgba(255,255,255,0.35)]">No boards match "{searchQuery}".</p>
				</div>
			) : (
				<div className="grid gap-5 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
					{filteredList.map((b) => (
						<div key={b.id} className="relative">
							<BoardCard
								board={b}
								onRename={setRenameTarget}
								onDuplicate={(item) => void handleDuplicate(item)}
								onDelete={setDeleteTarget}
								isActionsActive={activeBoardId === b.id}
							/>
							{activeTab === "shared" && (
								<div className="absolute top-3 right-3 z-10 pointer-events-none">
									<span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold tracking-wider uppercase bg-violet-500/20 text-violet-400 border border-violet-500/30 backdrop-blur-md">
										EDITOR
									</span>
								</div>
							)}
						</div>
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
					A blank page,
					<br />
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
