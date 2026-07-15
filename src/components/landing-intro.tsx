"use client";

import { Link } from "@/i18n/navigation";
import { BTN_PRIMARY_LG } from "@/lib/ui/nextstep";
import { useTranslations } from "next-intl";

export function LandingIntro() {
  const t = useTranslations("landing");

  return (
    <div className="mx-auto max-w-lg text-center">
      <h1 className="font-display text-xl leading-snug tracking-wide text-white md:text-2xl">
        {t("headline")}
      </h1>
      <p className="mt-3 text-pretty text-sm leading-relaxed text-white/65 md:text-base">
        {t("supportLine1")}
        <br />
        {t("supportLine2")}
      </p>
      <Link href="/inscription" className={`${BTN_PRIMARY_LG} mt-6 inline-flex`}>
        {t("cta")}
      </Link>
      <p className="mt-3 text-xs leading-relaxed text-white/45 md:text-sm">
        {t("seasonNote")}
      </p>
      <p className="mt-4">
        <Link
          href="/fonctionnement"
          className="text-xs font-medium text-white/40 transition hover:text-white/60"
        >
          {t("aboutLink")}
        </Link>
      </p>
    </div>
  );
}
