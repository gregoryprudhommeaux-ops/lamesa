"use client";

import { useAuth } from "@/components/auth/auth-provider";
import { Link } from "@/i18n/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import type { ReactNode } from "react";

export type MemberTab = "calendrier" | "dashboard" | "profil";

const TABS: MemberTab[] = ["calendrier", "dashboard", "profil"];
export const DEFAULT_MEMBER_TAB: MemberTab = "calendrier";

type MemberShellProps = {
  children: ReactNode;
  title?: string;
};

export function MemberShell({ children, title }: MemberShellProps) {
  const t = useTranslations("account");
  const locale = useLocale();
  const { logout, isAdmin } = useAuth();
  const searchParams = useSearchParams();
  const tabParam = searchParams.get("tab") as MemberTab | null;
  const active =
    tabParam && TABS.includes(tabParam) ? tabParam : DEFAULT_MEMBER_TAB;
  const heading = title ?? t("title");

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-ns-hero">{heading}</h2>
          <div className="mt-2 flex flex-wrap gap-3 text-xs font-semibold">
            {isAdmin && (
              <a href="/admin/evenements" className="text-ns-primary hover:underline">
                {t("adminLink")}
              </a>
            )}
            <button
              type="button"
              onClick={() =>
                void logout().then(() => {
                  window.location.href = `/${locale}/connexion`;
                })
              }
              className="text-ns-secondary hover:text-ns-tertiary"
            >
              {t("logout")}
            </button>
          </div>
        </div>
        <nav
          className="flex items-center gap-1 text-sm font-semibold"
          aria-label="Member tabs"
        >
          {TABS.map((id) => {
            const isActive = active === id;
            return (
              <Link
                key={id}
                href={`/compte?tab=${id}`}
                className={
                  isActive
                    ? "border-b-2 border-ns-primary px-3 py-1 text-ns-primary"
                    : "px-3 py-1 text-ns-secondary hover:text-ns-tertiary"
                }
              >
                {t(`tabs.${id}`)}
              </Link>
            );
          })}
        </nav>
      </div>
      {children}
    </div>
  );
}

export function useMemberTab(): MemberTab {
  const searchParams = useSearchParams();
  const tab = searchParams.get("tab") as MemberTab | null;
  if (tab && TABS.includes(tab)) return tab;
  return DEFAULT_MEMBER_TAB;
}
