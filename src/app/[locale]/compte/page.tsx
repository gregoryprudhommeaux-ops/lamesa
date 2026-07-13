import { MemberAccountPage } from "@/components/account/member-account-page";
import { LaMesaShell } from "@/components/la-mesa-shell";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Suspense } from "react";

type Props = { params: Promise<{ locale: string }> };

export default async function ComptePage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("account");

  return (
    <LaMesaShell card cardClassName="max-w-2xl">
      <Suspense fallback={<p className="text-sm text-ns-secondary">{t("loading")}</p>}>
        <MemberAccountPage />
      </Suspense>
    </LaMesaShell>
  );
}
