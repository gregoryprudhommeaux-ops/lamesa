import { SatisfactionSurveyForm } from "@/components/satisfaction/satisfaction-survey-form";
import { LaMesaShell } from "@/components/la-mesa-shell";
import { surveyLocaleFrom, SURVEY_COPY } from "@/lib/satisfaction/survey-copy";
import { setRequestLocale } from "next-intl/server";
import { Suspense } from "react";

type Props = { params: Promise<{ locale: string }> };

export default async function SatisfactionPage({ params }: Props) {
  const { locale: raw } = await params;
  const locale = surveyLocaleFrom(raw);
  setRequestLocale(locale);
  const loading = SURVEY_COPY[locale].loading;

  return (
    <LaMesaShell card cardClassName="max-w-lg">
      <Suspense fallback={<p className="text-sm text-ns-secondary">{loading}</p>}>
        <SatisfactionSurveyForm />
      </Suspense>
    </LaMesaShell>
  );
}
