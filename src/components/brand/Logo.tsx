import { cn } from "@/lib/utils";

export const Logo = ({ className, showWordmark = true }: { className?: string; showWordmark?: boolean }) => (
	<div className={cn("flex items-center gap-2.5", className)}>
		<div className="relative h-8 w-8 rounded-lg bg-gradient-brand shadow-glow-accent grid place-items-center">
			<svg
				viewBox="0 0 24 24"
				className="h-4 w-4 text-primary-foreground"
				fill="none"
				stroke="currentColor"
				strokeWidth="2"
				strokeLinecap="round"
				strokeLinejoin="round">
				<path d="M12 20h8" />
				<path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
			</svg>
		</div>
		{showWordmark && (
			<span className="inline-flex items-end whitespace-nowrap text-lg font-semibold tracking-tight">
				Sketch
				<span className="inline-block align-baseline font-hand text-3xl leading-none pb-0.5 pr-2 text-gradient-brand">
					mind
				</span>
			</span>
		)}
	</div>
);
