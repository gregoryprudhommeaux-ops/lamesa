"use client";

import { RequireAuth } from "@/components/auth/require-auth";
import { useAuth } from "@/components/auth/auth-provider";
import { Link as LocaleLink } from "@/i18n/navigation";
import { LaMesaLogo } from "@/components/la-mesa-logo";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

type AdminShellProps = {
  children: ReactNode;
  title?: string;
  /**
   * @deprecated Always workspace chrome — kept for call-site compatibility.
   */
  density?: "default" | "workspace";
};

/** Top-level destinations — Dashboard is the front door; everything else is a métier hub. */
const ADMIN_NAV: Array<{
  href: string;
  label: string;
  /** Path prefixes that mark this item active (legacy redirects included). */
  match: string[];
}> = [
  { href: "/admin/dashboard", label: "Dashboard", match: ["/admin/dashboard"] },
  {
    href: "/admin/evenements",
    label: "Dîners",
    match: ["/admin/evenements", "/admin/calendrier"],
  },
  {
    href: "/admin/personnes",
    label: "Personnes",
    match: ["/admin/personnes", "/admin/inscrits", "/admin/prospects", "/admin/contacts"],
  },
  { href: "/admin/tables", label: "Tables", match: ["/admin/tables"] },
  { href: "/admin/templates", label: "Coms", match: ["/admin/templates"] },
];

function navItemActive(pathname: string, match: string[]): boolean {
  return match.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

/**
 * Homogeneous admin chrome: logo + 5 hubs, no public SITE_NAV, no footer.
 * Ops product feel — not a site-within-a-site.
 */
export function AdminShell({
  children,
  title = "LA MESA — Admin",
}: AdminShellProps) {
  const { logout, user } = useAuth();
  const pathname = usePathname() ?? "";

  return (
    <RequireAuth admin loginHref="/admin/login">
      <div className="flex min-h-screen min-w-0 flex-col overflow-x-hidden bg-ns-brand-light">
        <header className="sticky top-0 z-40 border-b border-white/10 bg-ns-hero shadow-md">
          <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-2 px-3 py-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex min-w-0 flex-wrap items-center gap-3">
                <LocaleLink
                  href="/"
                  className="inline-flex shrink-0 items-center transition-opacity hover:opacity-90"
                  aria-label="LA MESA — retour à l'accueil"
                >
                  <LaMesaLogo size="sm" variant="horizontal" />
                </LocaleLink>
                <nav
                  className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs font-bold sm:text-sm"
                  aria-label="Administration"
                >
                  {ADMIN_NAV.map((item) => {
                    const active = navItemActive(pathname, item.match);
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
              </div>
              {user?.email ? (
                <p className="truncate text-[11px] text-white/35">{user.email}</p>
              ) : null}
            </div>
          </div>
        </header>

        <div className="mx-auto w-full min-w-0 max-w-[1600px] flex-1 px-3 py-3">
          <h1 className="sr-only">{title}</h1>
          {children}
        </div>
      </div>
    </RequireAuth>
  );
}
