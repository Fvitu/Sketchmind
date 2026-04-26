import { Navigate } from "react-router-dom";
import { useAuthState } from "@/lib/store";
import { LoadingScreen } from "@/components/ui/LoadingScreen";

const Index = () => {
  const { user, loading } = useAuthState();
  if (loading) return <LoadingScreen message="Checking session..." />;
  return <Navigate to={user ? "/dashboard" : "/login"} replace />;
};

export default Index;
