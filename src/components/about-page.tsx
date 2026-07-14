"use client";

import { Link } from "@/i18n/navigation";
import { BTN_PRIMARY, BTN_GHOST, FORM_SECTION_TITLE } from "@/lib/ui/nextstep";
import { useTranslations } from "next-intl";

const FAQ_KEYS = ["seats", "payment", "price", "absence", "themes", "sponsors", "speakers", "join"] as const;

export function AboutPageContent() {
  const t = useTranslations("about");

  return (
    <div className="space-y-8">
      <header>
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-ns-primary">{t("eyebrow")}</p>
        <h2 className="mt-3 text-2xl font-black uppercase tracking-[0.04em] text-ns-hero">{t("title")}</h2>
        <p className="mt-4 text-base font-semibold leading-relaxed text-ns-tertiary">{t("introLead")}</p>
        <p className="mt-3 text-sm leading-relaxed text-ns-secondary">{t("introBody")}</p>
      </header>

      <section className="space-y-5">
        <h3 className={FORM_SECTION_TITLE}>{t("faqTitle")}</h3>
        <dl className="space-y-5">
          {FAQ_KEYS.map((key) => (
            <div key={key} className="rounded-xl border border-gray-100 bg-ns-brand-light/40 p-4">
              <dt className="text-sm font-bold text-ns-tertiary">{t(`faq.${key}.q`)}</dt>
              <dd className="mt-2 text-sm leading-relaxed text-ns-secondary">{t(`faq.${key}.a`)}</dd>
            </div>
          ))}
        </dl>
      </section>

      <div className="flex flex-col gap-3 border-t border-gray-100 pt-6 sm:flex-row sm:items-center sm:justify-between">
        <Link href="/" className={`${BTN_GHOST} text-center`}>
          {t("backHome")}
        </Link>
        <Link href="/inscription" className={`${BTN_PRIMARY} text-center`}>
          {t("cta")}
        </Link>
      </div>
    </div>
  );
}
