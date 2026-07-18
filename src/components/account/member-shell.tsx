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
  /** Show red notification dot on "Mon profil" when profile is under 100%. */
  profileIncomplete?: boolean;
};

export function MemberShell({
  children,
  title,
  profileIncomplete = false,
}: MemberShellProps) {
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
            const showBadge = id === "profil" && profileIncomplete;
            return (
              <Link
                key={id}
                href={`/compte?tab=${id}`}
                className={
                  isActive
                    ? "relative border-b-2 border-ns-primary px-3 py-1 text-ns-primary"
                    : "relative px-3 py-1 text-ns-secondary hover:text-ns-tertiary"
                }
                aria-label={
                  showBadge
                    ? `${t(`tabs.${id}`)} — ${t("profileIncompleteBadge")}`
                    : undefined
                }
              >
                {t(`tabs.${id}`)}
                {showBadge ? (
                  <span
                    className="absolute right-0.5 top-0 h-2 w-2 rounded-full bg-red-500"
                    aria-hidden
                  />
                ) : null}
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
