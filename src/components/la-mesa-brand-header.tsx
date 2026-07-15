"use client";

import { LaMesaLogo } from "@/components/la-mesa-logo";
import { LaMesaMark } from "@/components/la-mesa-mark";
import { Link } from "@/i18n/navigation";
import { useTranslations } from "next-intl";

type LaMesaBrandHeaderProps = {
  /** Optional line under the wordmark (e.g. light signup page) */
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
          <LaMesaMark size="lg" priority />
        </Link>
        <Link
          href="/"
          className="transition-opacity hover:opacity-90"
          aria-label={t("name")}
        >
          <LaMesaLogo size="xl" variant="horizontal" priority />
        </Link>
      </div>
      {tagline ? (
        <p className="text-pretty text-sm leading-relaxed text-white/65 md:text-base">
          {tagline}
        </p>
      ) : null}
    </header>
  );
}
