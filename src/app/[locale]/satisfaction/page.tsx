import { SatisfactionSurveyForm } from "@/components/satisfaction/satisfaction-survey-form";
import { LaMesaShell } from "@/components/la-mesa-shell";
import { setRequestLocale } from "next-intl/server";
import { Suspense } from "react";

type Props = { params: Promise<{ locale: string }> };

export default async function SatisfactionPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <LaMesaShell card cardClassName="max-w-lg">
      <Suspense fallback={<p className="text-sm text-ns-secondary">Cargando…</p>}>
        <SatisfactionSurveyForm />
      </Suspense>
    </LaMesaShell>
  );
}
