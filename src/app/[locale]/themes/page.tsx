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
  const title = t("metaTitle");
  const description = t("metaDescription");
  /** Explicit og:image — child openGraph without images drops the layout logo for LinkedIn. */
  const ogImage = {
    url: "/og-share.png",
    width: 2400,
    height: 1260,
    alt: "LA MESA",
    type: "image/png" as const,
  };
  return {
    title,
    description,
    openGraph: {
      type: "website",
      locale: locale === "es" ? "es_MX" : locale === "fr" ? "fr_FR" : "en_US",
      siteName: "LA MESA",
      title,
      description,
      url: `${PRODUCTION_SITE_URL}${path}`,
      images: [ogImage],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [ogImage.url],
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
