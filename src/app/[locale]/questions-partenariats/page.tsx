import { ContactPageContent } from "@/components/contact-page";
import { LaMesaShell } from "@/components/la-mesa-shell";
import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

type Props = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "contact" });
  return {
    title: t("metaTitle"),
    description: t("metaDescription"),
  };
}

export default async function QuestionsPartenariatsPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <LaMesaShell card cardClassName="max-w-2xl">
      <ContactPageContent />
    </LaMesaShell>
  );
}
