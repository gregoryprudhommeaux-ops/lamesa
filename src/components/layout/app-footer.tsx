"use client";

import { useAuth } from "@/components/auth/auth-provider";
import { Link } from "@/i18n/navigation";
import {
  NEXTSTEP_COMPANY,
  NEXTSTEP_COMPANY_URL,
  NS_SUITE_URL,
  NsMark,
} from "@ns-suite/ui/brand";
import NextLink from "next/link";
import { useTranslations } from "next-intl";

export function AppFooter() {
  const t = useTranslations("footer");
  const { isAdmin } = useAuth();
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-white/10 bg-ns-hero">
      <div className="mx-auto flex max-w-lg flex-col items-center gap-3 px-6 py-8 text-center md:py-9">
        <div className="inline-flex max-w-sm items-center gap-2.5">
          <Link
            href="/"
            className="shrink-0 transition-opacity hover:opacity-90"
            aria-label={t("homeAria")}
          >
            <NsMark size="sm" />
          </Link>
          <p className="text-left text-[11px] font-medium leading-snug text-white/45">
            {t("taglineBefore")}
            <a
              href={NS_SUITE_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="text-white/70 underline decoration-white/25 underline-offset-2 transition hover:text-ns-primary hover:decoration-ns-primary/40"
            >
              {t("taglineSuiteLink")}
            </a>
            {t("taglineAfter")}
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-[11px] text-white/35">
          <span>
            © {year}{" "}
            <a
              href={NEXTSTEP_COMPANY_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium transition hover:text-white/55"
              aria-label={t("companyAria")}
            >
              {NEXTSTEP_COMPANY}
            </a>
          </span>
          <span aria-hidden className="text-white/20">
            ·
          </span>
          <Link href="/fonctionnement" className="font-medium transition hover:text-white/55">
            {t("about")}
          </Link>
          <span aria-hidden className="text-white/20">
            ·
          </span>
          <Link href="/connexion" className="font-medium transition hover:text-white/55">
            {t("login")}
          </Link>
          {isAdmin ? (
            <>
              <span aria-hidden className="text-white/20">
                ·
              </span>
              <NextLink
                href="/admin/evenements"
                className="font-medium transition hover:text-white/55"
              >
                {t("admin")}
              </NextLink>
            </>
          ) : null}
        </div>
      </div>
    </footer>
  );
}
