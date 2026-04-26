import { Navigate, useLocation } from "react-router-dom";
import { useAuthState } from "@/lib/store";
import { LoadingScreen } from "@/components/ui/LoadingScreen";

export const RequireAuth = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuthState();
  const location = useLocation();
  if (loading) return <LoadingScreen message="Authenticating..." />;
  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }
  return <>{children}</>;
};
