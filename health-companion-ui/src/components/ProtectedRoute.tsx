import { ReactNode, useEffect } from "react";
import { useRouter } from "next/router";
import type { UserRole } from "@/lib/auth";
import { useAuth } from "@/lib/auth";
import { getDashboardPath } from "@/lib/routes";

interface ProtectedRouteProps {
  children: ReactNode;
  allowedRoles?: UserRole[];
}

export const ProtectedRoute = ({ children, allowedRoles }: ProtectedRouteProps) => {
  const router = useRouter();
  const { user, loading } = useAuth();
  const roleAllowed = !allowedRoles || (user && allowedRoles.includes(user.role));

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/login");
      return;
    }

    if (!loading && user && allowedRoles && !allowedRoles.includes(user.role)) {
      router.replace(getDashboardPath(user.role));
    }
  }, [allowedRoles, loading, router, user]);

  if (loading || !user || !roleAllowed) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface">
        <div className="rounded-lg border border-border bg-card px-5 py-4 text-sm text-muted-foreground shadow-soft">
          Preparing your workspace...
        </div>
      </div>
    );
  }

  return <>{children}</>;
};
