"use client";

import { Link } from "@/i18n/navigation";
import { NsMark } from "@ns-suite/ui/brand";
import { useTranslations } from "next-intl";

type LaMesaBrandHeaderProps = {
  /** Override default brand.tagline (e.g. light signup page) */
  tagline?: string;
};

export function LaMesaBrandHeader({ tagline }: LaMesaBrandHeaderProps) {
  const t = useTranslations("brand");

  return (
    <header className="mb-8 flex max-w-2xl flex-col items-center gap-3 px-2 text-center">
      <div className="flex items-center gap-3">
        <Link
          href="/"
          className="shrink-0 transition-opacity hover:opacity-90"
          aria-label={t("nsMarkAria")}
          title={t("nsMarkAria")}
        >
          <NsMark size="lg" />
        </Link>
        <Link
          href="/"
          className="font-display text-[2.75rem] leading-none tracking-wide text-white transition-opacity hover:opacity-90 md:text-[3.5rem]"
        >
          {t("name")}
        </Link>
      </div>
      <p className="text-pretty text-sm leading-relaxed text-white/65 md:text-base">
        {tagline ?? t("tagline")}
      </p>
    </header>
  );
}
