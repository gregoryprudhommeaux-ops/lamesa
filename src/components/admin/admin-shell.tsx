"use client";

import { RequireAuth } from "@/components/auth/require-auth";
import { useAuth } from "@/components/auth/auth-provider";
import { AppFooter } from "@/components/layout/app-footer";
import { Link as LocaleLink } from "@/i18n/navigation";
import { LaMesaLogo } from "@/components/la-mesa-logo";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

type AdminShellProps = {
  children: ReactNode;
  title?: string;
};

const ADMIN_NAV = [
  { href: "/admin/inscrits", label: "Membres" },
  { href: "/admin/calendrier", label: "Calendrier" },
  { href: "/admin/evenements", label: "Événements" },
  { href: "/admin/tables", label: "Tables" },
  { href: "/admin/dashboard", label: "Dashboard" },
  { href: "/admin/templates", label: "Templates" },
] as const;

const SITE_NAV = [
  { href: "/" as const, label: "Accueil" },
  { href: "/fonctionnement" as const, label: "Fonctionnement" },
  { href: "/light" as const, label: "Inscription express" },
  { href: "/connexion" as const, label: "Espace membre" },
];

export function AdminShell({ children, title = "LA MESA — Admin" }: AdminShellProps) {
  const { logout, user } = useAuth();
  const pathname = usePathname() ?? "";

  return (
    <RequireAuth admin loginHref="/admin/login">
      <div className="flex min-h-screen flex-col bg-ns-brand-light">
        <header className="sticky top-0 z-40 border-b border-white/10 bg-ns-hero shadow-md">
          <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-3 sm:py-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <LocaleLink
                href="/"
                className="inline-flex items-center gap-2.5 transition-opacity hover:opacity-90"
                aria-label="LA MESA — retour à l'accueil"
              >
                <LaMesaLogo size="sm" variant="horizontal" />
              </LocaleLink>
              <nav
                className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-semibold text-white/55"
                aria-label="Site public"
              >
                {SITE_NAV.map((item) => (
                  <LocaleLink
                    key={item.href}
                    href={item.href}
                    className="transition hover:text-white"
                  >
                    {item.label}
                  </LocaleLink>
                ))}
              </nav>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-3">
              <nav
                className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm font-bold"
                aria-label="Administration"
              >
                {ADMIN_NAV.map((item) => {
                  const active =
                    pathname === item.href || pathname.startsWith(`${item.href}/`);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={
                        active
                          ? "text-ns-primary"
                          : "text-white/70 transition hover:text-white"
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
                  className="font-semibold text-white/45 transition hover:text-white/70"
                >
                  Déconnexion
                </button>
              </nav>
              {user?.email ? (
                <p className="text-[11px] text-white/35">{user.email}</p>
              ) : null}
            </div>
          </div>
        </header>

        <div className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
          <h1 className="sr-only">{title}</h1>
          {children}
        </div>

        <AppFooter />
      </div>
    </RequireAuth>
  );
}
