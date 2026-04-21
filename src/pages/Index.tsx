import { Navigate } from "react-router-dom";
import { useAuthState } from "@/lib/store";

const Index = () => {
  const { user, loading } = useAuthState();
  if (loading) return null;
  return <Navigate to={user ? "/dashboard" : "/login"} replace />;
};

export default Index;
