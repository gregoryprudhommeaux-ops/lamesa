"use client";

import { useAuth } from "@/components/auth/auth-provider";
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
      router.replace(loginHref);
      return;
    }
    if (admin && !isAdmin) {
      router.replace(`${loginHref}?error=forbidden`);
    }
  }, [user, loading, isAdmin, admin, loginHref, router]);

  if (loading) {
    return <p className="text-sm text-ns-secondary">Chargement…</p>;
  }
  if (!user || (admin && !isAdmin)) {
    return null;
  }
  return <>{children}</>;
}
