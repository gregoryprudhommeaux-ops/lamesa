"use client";

import { NsMark } from "../brand/ns-mark";
import { NEXTSTEP_COMPANY, NS_SUITE_URL } from "../brand/ns-suite";
import type { NsLinkComponent } from "../types/link";

export type NsAppFooterLabels = {
  /** Full tagline when taglineLead / taglineSuiteLink are not used. */
  tagline: string;
  /** Text before the NS Suite link, e.g. "LA MESA : …, " */
  taglineLead?: string;
  /** Linked phrase pointing to the NS Suite hub. */
  taglineSuiteLink?: string;
  rights: string;
  /** Discreet link to admin login (e.g. /admin/login). */
  admin?: string;
  /** Discreet link to about / how-it-works page. */
  about?: string;
  footerNavAria?: string;
  home?: string;
  library?: string;
  pricing?: string;
  signup?: string;
  login?: string;
};

export type NsAppFooterProps = {
  Link: NsLinkComponent;
  labels: NsAppFooterLabels;
  variant?: "dark" | "light";
  showAuthLinks?: boolean;
  showAppLinks?: boolean;
  /** Override company line (default: NextStep Services). */
  companyName?: string;
};

export function NsAppFooter({
  Link,
  labels,
  variant = "dark",
  showAuthLinks = false,
  showAppLinks = false,
  companyName = NEXTSTEP_COMPANY,
}: NsAppFooterProps) {
  const isDark = variant === "dark";
  const navAria = labels.footerNavAria ?? "Footer";

  return (
    <footer
      className={
        isDark
          ? "border-t border-white/10 bg-ns-hero text-white/70"
          : "border-t border-gray-100 bg-ns-brand-light text-ns-secondary"
      }
    >
      <div
        className={`mx-auto max-w-5xl px-4 py-8 md:px-8 md:py-10 ${
          isDark ? "pb-10 pl-14 md:pb-8 md:pl-0" : ""
        }`}
      >
        <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
          <div className="flex gap-3">
            <NsMark size="sm" className="mt-0.5 shrink-0" />
            <div className="min-w-0 space-y-1.5">
              <p
                className={`text-sm font-bold ${isDark ? "text-white" : "text-ns-tertiary"}`}
              >
                {companyName}
              </p>
              <p
                className={`text-xs font-medium leading-relaxed ${
                  isDark ? "text-white/60" : "text-ns-secondary"
                }`}
              >
                {labels.taglineLead && labels.taglineSuiteLink && NS_SUITE_URL ? (
                  <>
                    {labels.taglineLead}
                    <a
                      href={NS_SUITE_URL}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={
                        isDark
                          ? "text-ns-primary underline decoration-ns-primary/40 underline-offset-2 hover:text-ns-primary/90"
                          : "text-ns-tertiary underline decoration-ns-primary/35 underline-offset-2 hover:text-ns-primary"
                      }
                    >
                      {labels.taglineSuiteLink}
                    </a>
                  </>
                ) : (
                  labels.tagline
                )}
              </p>
              <p className={`text-[11px] ${isDark ? "text-white/40" : "text-ns-secondary/70"}`}>
                {labels.rights}
              </p>
              {(labels.about || labels.admin) && (
                <p className="flex flex-wrap gap-x-3 gap-y-1 pt-1">
                  {labels.about ? (
                    <Link
                      href="/fonctionnement"
                      className={`text-[11px] font-medium transition ${
                        isDark
                          ? "text-white/30 hover:text-white/50"
                          : "text-ns-secondary/45 hover:text-ns-secondary/70"
                      }`}
                    >
                      {labels.about}
                    </Link>
                  ) : null}
                  {labels.admin ? (
                    <Link
                      href="/admin/login"
                      className={`text-[11px] font-medium transition ${
                        isDark
                          ? "text-white/30 hover:text-white/50"
                          : "text-ns-secondary/45 hover:text-ns-secondary/70"
                      }`}
                    >
                      {labels.admin}
                    </Link>
                  ) : null}
                </p>
              )}
            </div>
          </div>

          <nav
            className="flex flex-wrap gap-x-4 gap-y-2 text-sm font-semibold md:max-w-xs md:justify-end md:pt-1"
            aria-label={navAria}
          >
            {showAppLinks && labels.home && (
              <Link
                href="/"
                className={
                  isDark
                    ? "text-white/80 hover:text-white"
                    : "text-ns-secondary hover:text-ns-tertiary"
                }
              >
                {labels.home}
              </Link>
            )}
            {showAppLinks && labels.library && (
              <Link
                href="/dashboard"
                className={
                  isDark
                    ? "text-white/80 hover:text-white"
                    : "text-ns-secondary hover:text-ns-tertiary"
                }
              >
                {labels.library}
              </Link>
            )}
            {showAppLinks && labels.pricing && (
              <Link
                href="/pricing"
                className={
                  isDark
                    ? "text-white/80 hover:text-white"
                    : "text-ns-secondary hover:text-ns-tertiary"
                }
              >
                {labels.pricing}
              </Link>
            )}
            {showAuthLinks && labels.signup && labels.login && (
              <>
                <Link
                  href="/signup"
                  className={
                    isDark
                      ? "text-ns-primary hover:text-ns-primary/90"
                      : "text-ns-tertiary hover:text-ns-primary"
                  }
                >
                  {labels.signup}
                </Link>
                <Link
                  href="/login"
                  className={
                    isDark
                      ? "text-white/80 hover:text-white"
                      : "text-ns-secondary hover:text-ns-tertiary"
                  }
                >
                  {labels.login}
                </Link>
              </>
            )}
          </nav>
        </div>
      </div>
    </footer>
  );
}
