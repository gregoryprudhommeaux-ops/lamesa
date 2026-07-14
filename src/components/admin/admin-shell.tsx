"use client";

import { RequireAuth } from "@/components/auth/require-auth";
import { useAuth } from "@/components/auth/auth-provider";
import Link from "next/link";
import type { ReactNode } from "react";

type AdminShellProps = {
  children: ReactNode;
  title: string;
  navEvents: string;
  navRegistrants: string;
  navCalendar: string;
  navTemplates?: string;
  navDashboard?: string;
  logoutLabel: string;
};

export function AdminShell({
  children,
  title,
  navEvents,
  navRegistrants,
  navCalendar,
  navTemplates = "Templates",
  navDashboard = "Dashboard",
  logoutLabel,
}: AdminShellProps) {
  const { logout, user } = useAuth();

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
              <Link href="/admin/dashboard" className="text-ns-tertiary hover:text-ns-primary">
                {navDashboard}
              </Link>
              <Link href="/admin/evenements" className="text-ns-tertiary hover:text-ns-primary">
                {navEvents}
              </Link>
              <Link href="/admin/calendrier" className="text-ns-tertiary hover:text-ns-primary">
                {navCalendar}
              </Link>
              <Link href="/admin/inscrits" className="text-ns-tertiary hover:text-ns-primary">
                {navRegistrants}
              </Link>
              <Link href="/admin/templates" className="text-ns-tertiary hover:text-ns-primary">
                {navTemplates}
              </Link>
              <button
                type="button"
                onClick={() => void logout().then(() => {
                  window.location.href = "/admin/login";
                })}
                className="text-ns-secondary hover:text-ns-tertiary"
              >
                {logoutLabel}
              </button>
            </nav>
          </div>
          {children}
        </div>
      </div>
    </RequireAuth>
  );
}
