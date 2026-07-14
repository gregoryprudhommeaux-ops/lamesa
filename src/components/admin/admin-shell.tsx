"use client";

import { RequireAuth } from "@/components/auth/require-auth";
import { useAuth } from "@/components/auth/auth-provider";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

type AdminShellProps = {
  children: ReactNode;
  title?: string;
};

const NAV_ITEMS = [
  { href: "/admin/inscrits", label: "Membres" },
  { href: "/admin/calendrier", label: "Calendrier" },
  { href: "/admin/evenements", label: "Événements" },
  { href: "/admin/dashboard", label: "Dashboard" },
] as const;

export function AdminShell({ children, title = "LA MESA — Admin" }: AdminShellProps) {
  const { logout, user } = useAuth();
  const pathname = usePathname() ?? "";

  return (
    <RequireAuth admin loginHref="/admin/login">
      <div className="min-h-screen bg-ns-brand-light px-4 py-8">
        <div className="mx-auto max-w-6xl">
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl font-black uppercase tracking-[0.06em] text-ns-tertiary">
                {title}
              </h1>
              {user?.email && (
                <p className="mt-1 text-xs text-ns-secondary">{user.email}</p>
              )}
            </div>
            <nav className="flex flex-wrap items-center gap-3 text-sm font-semibold">
              {NAV_ITEMS.map((item) => {
                const active =
                  pathname === item.href || pathname.startsWith(`${item.href}/`);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={
                      active
                        ? "text-ns-primary"
                        : "text-ns-tertiary hover:text-ns-primary"
                    }
                    aria-current={active ? "page" : undefined}
                  >
                    {item.label}
                  </Link>
                );
              })}
              <button
                type="button"
                onClick={() =>
                  void logout().then(() => {
                    window.location.href = "/admin/login";
                  })
                }
                className="text-ns-secondary hover:text-ns-tertiary"
              >
                Déconnexion
              </button>
            </nav>
          </div>
          {children}
        </div>
      </div>
    </RequireAuth>
  );
}
