import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { MoreHorizontal, Pencil, Trash2, Lock, Copy } from "lucide-react";
import { Board } from "@/lib/store";
import { relativeTime } from "@/lib/format";
import { exportToSvg } from "@excalidraw/excalidraw";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";

const BoardThumbnail = ({ board, palette }: { board: Board; palette: string }) => {
	const [svgStr, setSvgStr] = useState<string | null>(null);
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		let active = true;

		async function generate() {
			if (!board.canvas_state || !board.canvas_state.elements || board.canvas_state.elements.length === 0) {
				if (active) setLoading(false);
				return;
			}

			try {
				const svgElement = await exportToSvg({
					elements: board.canvas_state.elements,
					appState: {
						exportBackground: true,
						viewBackgroundColor: board.canvas_state.appState?.viewBackgroundColor || "#1a1a2e",
					},
					files: board.canvas_state.files || {},
				});

				svgElement.setAttribute("preserveAspectRatio", "xMidYMid slice");
				svgElement.setAttribute("width", "100%");
				svgElement.setAttribute("height", "100%");

				if (active) {
					setSvgStr(svgElement.outerHTML);
					setLoading(false);
				}
			} catch (err) {
				console.error("Failed to generate SVG thumbnail", err);
				if (active) setLoading(false);
			}
		}

		generate();

		return () => {
			active = false;
		};
	}, [board.canvas_state]);

	const isEmpty = !loading && !svgStr;

	if (loading) {
		return <div className={`relative w-full h-full bg-gradient-to-br ${palette} animate-pulse`} />;
	}

	if (isEmpty) {
		return (
			<div className={`relative w-full h-full bg-gradient-to-br ${palette} flex items-center justify-center`}>
				<div className="absolute inset-0 bg-dotgrid opacity-40 mix-blend-overlay" />
				<span className="text-muted-foreground text-xs font-medium tracking-wide">Empty board</span>
			</div>
		);
	}

	return (
		<div className="relative w-full h-full overflow-hidden">
			<div
				className="w-full h-full transition-[filter] duration-200 ease-in-out group-hover:brightness-[1.08]"
				dangerouslySetInnerHTML={{ __html: svgStr! }}
			/>
			<div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-card to-transparent pointer-events-none" />
		</div>
	);
};

type Props = {
	board: Board;
	onRename: (b: Board) => void;
	onDuplicate: (b: Board) => void;
	onDelete: (b: Board) => void;
	isActionsActive?: boolean;
};

const palettes = [
	"from-[hsl(195_80%_55%/0.25)] to-[hsl(220_80%_55%/0.15)]",
	"from-[hsl(280_70%_60%/0.22)] to-[hsl(200_70%_55%/0.12)]",
	"from-[hsl(150_60%_55%/0.22)] to-[hsl(195_70%_55%/0.12)]",
	"from-[hsl(40_85%_60%/0.22)] to-[hsl(20_70%_55%/0.12)]",
	"from-[hsl(330_70%_60%/0.22)] to-[hsl(260_70%_55%/0.12)]",
];

export const BoardCard = ({ board, onRename, onDuplicate, onDelete, isActionsActive = false }: Props) => {
	const [open, setOpen] = useState(false);
	const seed = board.id.charCodeAt(0) + board.id.charCodeAt(board.id.length - 1);
	const palette = palettes[seed % palettes.length];
	const triggerActive = open || isActionsActive;

	return (
		<motion.div
			data-reactive-glow
			initial={{ opacity: 0, y: 15, scale: 0.98 }}
			animate={{ opacity: 1, y: 0, scale: 1 }}
			transition={{ type: "spring", stiffness: 400, damping: 30, mass: 1 }}
			whileHover={{ y: -3 }}
			className="group relative rounded-2xl border border-border bg-gradient-card shadow-soft transition-colors overflow-hidden">
			<Link to={`/board/${board.id}`} className="block">
				<div className="relative aspect-[16/10] overflow-hidden">
					<BoardThumbnail board={board} palette={palette} />
				</div>
			</Link>

			<div className="flex items-start justify-between gap-2 p-4">
				<Link to={`/board/${board.id}`} className="min-w-0 flex-1">
					<h3 className="truncate text-sm font-semibold text-foreground group-hover:text-primary transition-colors">{board.title}</h3>
					<div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
						<span className="inline-flex items-center gap-1 rounded-md bg-accent/60 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide">
							<Lock className="h-2.5 w-2.5" /> Private
						</span>
						<span>·</span>
						<span>Edited {relativeTime(board.last_edited_at)}</span>
					</div>
				</Link>

				<DropdownMenu open={open} onOpenChange={setOpen} modal={false}>
					<DropdownMenuTrigger asChild>
						<button
							data-active={triggerActive}
							className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground opacity-0 group-hover:opacity-100 data-[state=open]:opacity-100 data-[active=true]:opacity-100 data-[active=true]:bg-accent data-[active=true]:text-foreground transition-opacity"
							aria-label="Board actions">
							<motion.div whileHover={triggerActive ? undefined : { scale: 1.1, rotate: 360 }} transition={{ duration: 0.45, ease: "easeOut" }}>
								<MoreHorizontal className="h-4 w-4" />
							</motion.div>
						</button>
					</DropdownMenuTrigger>
					<DropdownMenuContent align="end" className="w-40 data-[state=open]:[animation:none] data-[state=closed]:[animation:none]">
						<DropdownMenuItem onClick={() => onRename(board)} className="group/item gap-2 focus:bg-accent focus:text-foreground">
							<Pencil className="h-4 w-4 transition-transform duration-200 group-hover/item:scale-125 group-hover/item:-rotate-12" />
							Rename
						</DropdownMenuItem>
						<DropdownMenuItem onClick={() => onDuplicate(board)} className="group/item gap-2 focus:bg-accent focus:text-foreground">
							<Copy className="h-4 w-4 transition-transform duration-200 group-hover/item:scale-125 group-hover/item:-rotate-12" />
							Duplicate
						</DropdownMenuItem>
						<DropdownMenuSeparator />
						<DropdownMenuItem
							onClick={() => onDelete(board)}
							className="text-destructive focus:text-destructive focus:bg-destructive/10 group/item gap-2">
							<Trash2 className="h-4 w-4 transition-transform duration-200 group-hover/item:scale-125 group-hover/item:-rotate-12" />
							Delete
						</DropdownMenuItem>
					</DropdownMenuContent>
				</DropdownMenu>
			</div>
		</motion.div>
	);
};
