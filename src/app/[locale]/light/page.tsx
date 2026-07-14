import { ExpressSignupForm } from "@/components/express-signup-form";
import { LaMesaShell } from "@/components/la-mesa-shell";
import { getTranslations, setRequestLocale } from "next-intl/server";

type Props = {
  params: Promise<{ locale: string }>;
};

export default async function LightSignupPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("light");

  return (
    <LaMesaShell card cardClassName="max-w-md" brandTagline={t("brandTagline")}>
      <ExpressSignupForm />
    </LaMesaShell>
  );
}
