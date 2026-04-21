import { cn } from "@/lib/utils";

export const Logo = ({ className, showWordmark = true }: { className?: string; showWordmark?: boolean }) => (
  <div className={cn("flex items-center gap-2.5", className)}>
    <div className="relative h-8 w-8 rounded-lg bg-gradient-brand shadow-glow-accent grid place-items-center">
      <svg viewBox="0 0 24 24" className="h-4 w-4 text-primary-foreground" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 18c2-6 6-9 9-9s5 2 5 5-2 5-5 5-4-2-4-4 1-3 3-3 2 1 2 2" />
      </svg>
    </div>
    {showWordmark && (
      <span className="text-lg font-semibold tracking-tight inline-flex items-baseline">
        Sketch
        <span className="font-hand text-2xl text-gradient-brand leading-[1.15] pb-1 pr-0.5">
          mind
        </span>
      </span>
    )}
  </div>
);
