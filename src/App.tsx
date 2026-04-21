import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, useLocation } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import Index from "./pages/Index.tsx";
import Login from "./pages/Login.tsx";
import Dashboard from "./pages/Dashboard.tsx";
import Profile from "./pages/Profile.tsx";
import BoardPlaceholder from "./pages/BoardPlaceholder.tsx";
import NotFound from "./pages/NotFound.tsx";
import { RequireAuth } from "./components/layout/RequireAuth.tsx";
import { AppShell } from "./components/layout/AppShell.tsx";
import { useReactiveGlow } from "./hooks/useReactiveGlow.ts";

const queryClient = new QueryClient();

const pageTransition = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
  transition: { duration: 0.35, ease: [0.22, 1, 0.36, 1] as const },
};

const AnimatedRoutes = () => {
  const location = useLocation();
  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        <Route path="/" element={<motion.div {...pageTransition}><Index /></motion.div>} />
        <Route path="/login" element={<motion.div {...pageTransition}><Login /></motion.div>} />

        <Route
          element={
            <RequireAuth>
              <AppShell />
            </RequireAuth>
          }
        >
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/profile" element={<Profile />} />
        </Route>

        <Route
          path="/board/:id"
          element={
            <RequireAuth>
              <motion.div {...pageTransition}><BoardPlaceholder /></motion.div>
            </RequireAuth>
          }
        />

        <Route path="*" element={<motion.div {...pageTransition}><NotFound /></motion.div>} />
      </Routes>
    </AnimatePresence>
  );
};

const App = () => {
  useReactiveGlow();
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Sonner />
        <BrowserRouter>
          <AnimatedRoutes />
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
