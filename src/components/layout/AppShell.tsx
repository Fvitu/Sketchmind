import { NavLink, Outlet, useNavigate, useLocation } from "react-router-dom";
import { LayoutGrid, User as UserIcon, LogOut, Plus } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Logo } from "@/components/brand/Logo";
import { auth, useAuthUser, boards as boardsApi, BOARD_LIMIT } from "@/lib/store";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { initials } from "@/lib/format";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const navItem =
  "group/nav flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-sidebar-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground";
const navItemActive = "bg-sidebar-accent text-sidebar-accent-foreground";

export const AppShell = () => {
  const user = useAuthUser();
  const navigate = useNavigate();

  if (!user) return null;

  const handleNewBoard = async () => {
    try {
      const b = await boardsApi.create(user.id);
      toast.success("Board created");
      navigate(`/board/${b.id}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't create board");
    }
  };

  const handleSignOut = async () => {
    try {
      await auth.signOut();
      navigate("/login", { replace: true });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't sign out");
    }
  };

  return (
    <div className="relative min-h-screen bg-background flex overflow-hidden">
      <div aria-hidden="true" className="page-reactive-glow" />

      <aside className="relative z-10 hidden md:flex w-64 flex-col border-r border-sidebar-border bg-sidebar">
        <div className="px-5 py-5">
          <Logo />
        </div>

        <div className="px-3">
          <Button
            onClick={() => {
              void handleNewBoard();
            }}
            className="group/new w-full justify-start gap-2 bg-gradient-brand text-primary-foreground hover:opacity-90 shadow-glow-accent"
          >
            <Plus className="h-4 w-4 transition-transform duration-300 ease-out group-hover/new:rotate-90" />
            New board
          </Button>
        </div>

        <nav className="mt-6 px-3 space-y-1">
          <NavLink to="/dashboard" className={({ isActive }) => cn(navItem, isActive && navItemActive)}>
            {({ isActive }) => (
              <>
                <LayoutGrid className={cn("h-4 w-4 transition-transform duration-200 ease-out", !isActive && "group-hover/nav:scale-125 group-hover/nav:-rotate-6")} />
                Dashboard
              </>
            )}
          </NavLink>
          <NavLink to="/profile" className={({ isActive }) => cn(navItem, isActive && navItemActive)}>
            {({ isActive }) => (
              <>
                <UserIcon className={cn("h-4 w-4 transition-transform duration-200 ease-out", !isActive && "group-hover/nav:scale-125 group-hover/nav:-rotate-6")} />
                Profile
              </>
            )}
          </NavLink>
        </nav>

        <div className="mt-auto p-3 space-y-3">
          <div className="flex items-center gap-3 rounded-lg p-2">
            <Avatar className="h-8 w-8">
              <AvatarFallback className="bg-accent text-foreground text-xs">{initials(user.display_name)}</AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{user.display_name}</p>
              <p className="truncate text-xs text-muted-foreground">{user.email}</p>
            </div>
            <motion.button
              onClick={handleSignOut}
              whileHover={{ scale: 1.18, rotate: -12 }}
              whileTap={{ scale: 0.85, rotate: 8 }}
              transition={{ type: "spring", stiffness: 420, damping: 14 }}
              className="rounded-md p-1.5 text-muted-foreground hover:bg-destructive/15 hover:text-destructive transition-colors"
              aria-label="Sign out"
              title="Sign out"
            >
              <LogOut className="h-4 w-4" />
            </motion.button>
          </div>
        </div>
      </aside>

      {/* Mobile top bar */}
      <header className="md:hidden fixed top-0 inset-x-0 z-40 flex items-center justify-between border-b border-border bg-background/80 backdrop-blur px-4 h-14">
        <Logo />
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            onClick={() => {
              void handleNewBoard();
            }}
            className="bg-gradient-brand text-primary-foreground"
          >
            <Plus className="h-4 w-4 mr-1" /> New
          </Button>
          <motion.button
            onClick={handleSignOut}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.92 }}
            className="p-2 text-muted-foreground hover:text-destructive transition-colors"
          >
            <LogOut className="h-4 w-4" />
          </motion.button>
        </div>
      </header>

      <main className="relative z-10 flex-1 min-w-0 pt-14 md:pt-0">
        <div className="mx-auto max-w-6xl px-5 md:px-8 py-8">
          <AnimatedOutlet />
        </div>

        {/* Mobile bottom nav */}
        <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 grid grid-cols-2 border-t border-border bg-background/95 backdrop-blur">
          <NavLink to="/dashboard" className={({ isActive }) => cn("flex flex-col items-center py-2.5 text-xs gap-1", isActive ? "text-primary" : "text-muted-foreground")}>
            <LayoutGrid className="h-5 w-5" /> Boards
          </NavLink>
          <NavLink to="/profile" className={({ isActive }) => cn("flex flex-col items-center py-2.5 text-xs gap-1", isActive ? "text-primary" : "text-muted-foreground")}>
            <UserIcon className="h-5 w-5" /> Profile
          </NavLink>
        </nav>
        <div className="md:hidden h-14" />
      </main>
    </div>
  );
};

const AnimatedOutlet = () => {
  const location = useLocation();
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={location.pathname}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
      >
        <Outlet />
      </motion.div>
    </AnimatePresence>
  );
};

export { BOARD_LIMIT };

