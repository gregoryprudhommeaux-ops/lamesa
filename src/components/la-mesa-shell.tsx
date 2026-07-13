"use client";

import { useAuth } from "@/components/auth/auth-provider";
import { AppFooter } from "@/components/layout/app-footer";
import { LaMesaBrandHeader } from "@/components/la-mesa-brand-header";
import { Link, usePathname, useRouter } from "@/i18n/navigation";
import { routing, type AppLocale } from "@/i18n/routing";
import { NsLanguageSwitcher } from "@ns-suite/ui/components";
import { useLocale, useTranslations } from "next-intl";
import type { ReactNode } from "react";

const LOCALE_LABELS: Record<AppLocale, string> = {
  en: "EN",
  fr: "FR",
  es: "ES",
};

export function LanguageSwitcher() {
  const locale = useLocale() as AppLocale;
  const pathname = usePathname();
  const router = useRouter();

  function switchLocale(next: AppLocale) {
    if (next === locale) return;
    router.replace(pathname, { locale: next });
  }

  return (
    <NsLanguageSwitcher
      variant="dark"
      locales={routing.locales}
      activeLocale={locale}
      localeLabels={LOCALE_LABELS}
      onLocaleChange={(loc) => switchLocale(loc as AppLocale)}
    />
  );
}

const TOP_BAR_LINK_CLASS =
  "whitespace-nowrap text-xs font-medium text-white/45 transition hover:text-white/70";

function TopBarLoginLink() {
  const tLanding = useTranslations("landing");
  const tAccount = useTranslations("account");
  const pathname = usePathname();
  const { user, loading } = useAuth();

  if (pathname === "/connexion" || pathname.startsWith("/connexion/")) return null;
  if (loading) return null;

  if (user) {
    return (
      <div className="flex items-center gap-3">
        <Link href="/compte?tab=calendrier" className={TOP_BAR_LINK_CLASS}>
          {tLanding("myAccountLink")}
        </Link>
        <Link href="/reglages" className={TOP_BAR_LINK_CLASS}>
          {tAccount("settingsLink")}
        </Link>
      </div>
    );
  }

  return (
    <Link href="/connexion" className={TOP_BAR_LINK_CLASS}>
      {tLanding("loginLink")}
    </Link>
  );
}

type LaMesaShellProps = {
  children: ReactNode;
  card?: boolean;
  cardClassName?: string;
  /** Admin pages force FR in layout — hide switcher to avoid mixed locales. */
  showLanguageSwitcher?: boolean;
};

export function LaMesaShell({
  children,
  card = false,
  cardClassName = "",
  showLanguageSwitcher = true,
}: LaMesaShellProps) {
  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden bg-ns-hero">
      <div className="pointer-events-none absolute inset-0 opacity-20">
        <div className="absolute left-1/4 top-1/4 h-64 w-64 rounded-full bg-ns-primary blur-[120px]" />
        <div className="absolute bottom-1/4 right-1/4 h-64 w-64 rounded-full bg-ns-secondary blur-[120px]" />
      </div>
      {showLanguageSwitcher ? (
        <div className="absolute right-4 top-4 z-20 flex items-center gap-3">
          <TopBarLoginLink />
          <LanguageSwitcher />
        </div>
      ) : null}
      <main className="relative z-10 flex flex-1 flex-col items-center justify-center px-4 py-12">
        <LaMesaBrandHeader />
        {card ? (
          <div
            className={`w-full rounded-2xl border border-white/10 bg-ns-surface p-8 shadow-2xl ${cardClassName}`}
          >
            {children}
          </div>
        ) : (
          <div className={`w-full ${cardClassName}`}>{children}</div>
        )}
      </main>
      <div className="relative z-10 w-full">
        <AppFooter />
      </div>
    </div>
  );
}
