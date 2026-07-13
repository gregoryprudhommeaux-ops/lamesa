"use client";

import { Link } from "@/i18n/navigation";
import { BTN_PRIMARY_LG } from "@/lib/ui/nextstep";
import { useTranslations } from "next-intl";

export function LandingIntro() {
  const t = useTranslations("landing");

  return (
    <div className="mx-auto max-w-lg text-center">
      <Link href="/inscription" className={`${BTN_PRIMARY_LG} mt-2 inline-flex`}>
        {t("cta")}
      </Link>
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
