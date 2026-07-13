import { AboutPageContent } from "@/components/about-page";
import { LaMesaShell } from "@/components/la-mesa-shell";
import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

type Props = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "about" });
  return {
    title: t("metaTitle"),
    description: t("metaDescription"),
  };
}

export default async function FonctionnementPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <LaMesaShell card cardClassName="max-w-2xl">
      <AboutPageContent />
    </LaMesaShell>
  );
}
