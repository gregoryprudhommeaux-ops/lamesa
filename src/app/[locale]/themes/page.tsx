import { PublicSubjectsPage } from "@/components/public-subjects-page";
import { LaMesaShell } from "@/components/la-mesa-shell";
import { PRODUCTION_SITE_URL } from "@/lib/site-url";
import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Suspense } from "react";

type Props = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "subjectsPage" });
  const path = `/${locale}/themes`;
  return {
    title: t("metaTitle"),
    description: t("metaDescription"),
    openGraph: {
      title: t("metaTitle"),
      description: t("metaDescription"),
      url: `${PRODUCTION_SITE_URL}${path}`,
      type: "website",
    },
    alternates: {
      canonical: `${PRODUCTION_SITE_URL}${path}`,
    },
  };
}

export default async function ThemesPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("subjectsPage");

  return (
    <LaMesaShell card cardClassName="max-w-2xl">
      <Suspense fallback={<p className="text-sm text-ns-secondary">{t("loading")}</p>}>
        <PublicSubjectsPage />
      </Suspense>
    </LaMesaShell>
  );
}
