"use client";

import { useAuth } from "@/components/auth/auth-provider";
import { withNextQuery } from "@/lib/auth/safe-next-path";
import { useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";

type RequireAuthProps = {
  children: ReactNode;
  /** Require platform admin (Gregory allowlist). */
  admin?: boolean;
  loginHref?: string;
};

export function RequireAuth({
  children,
  admin = false,
  loginHref = "/admin/login",
}: RequireAuthProps) {
  const { user, loading, isAdmin } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      const next = `${window.location.pathname}${window.location.search}`;
      router.replace(withNextQuery(loginHref, next));
      return;
    }
    if (admin && !isAdmin) {
      const sep = loginHref.includes("?") ? "&" : "?";
      router.replace(`${loginHref}${sep}error=forbidden`);
    }
  }, [user, loading, isAdmin, admin, loginHref, router]);

  if (loading || !user || (admin && !isAdmin)) {
    return <p className="text-sm text-ns-secondary">Chargement…</p>;
  }
  return <>{children}</>;
}
