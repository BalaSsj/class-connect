import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";

export default function Index() {
  const { user, loading, primaryRole } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      navigate("/login", { replace: true });
      return;
    }
    if (primaryRole === "admin") navigate("/admin", { replace: true });
    else if (primaryRole === "hod") navigate("/hod", { replace: true });
    else if (primaryRole === "faculty") navigate("/faculty", { replace: true });
    else navigate("/login", { replace: true });
  }, [user, loading, primaryRole, navigate]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
    </div>
  );
}
