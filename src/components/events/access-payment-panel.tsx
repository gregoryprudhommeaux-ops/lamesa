"use client";

import { useAuthFetch } from "@/hooks/use-auth-fetch";
import { EVENT_PAYMENT_BANK, formatPaymentDeadlineDate } from "@/lib/events/payment-details";
import { computeEventIva, formatMxn } from "@/lib/events/pricing";
import { BTN_SECONDARY, FORM_SECTION_TITLE } from "@/lib/ui/nextstep";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";

type AccessPaymentPanelProps = {
  participationId: string;
  priceMxn?: number | null;
  priceIncludesIva?: boolean;
  priceIncludesService?: boolean;
  paymentDeadlineAt?: string | null;
  paymentDeclaredAt?: string | null;
  onDeclared?: (iso: string) => void;
};

/**
 * Bank transfer + « j’ai viré » for public `/e` when formal invite is out.
 */
export function AccessPaymentPanel({
  participationId,
  priceMxn,
  priceIncludesIva = true,
  priceIncludesService = true,
  paymentDeadlineAt,
  paymentDeclaredAt,
  onDeclared,
}: AccessPaymentPanelProps) {
  const t = useTranslations("publicEvent");
  const locale = useLocale() as "fr" | "en" | "es";
  const authFetch = useAuthFetch();
  const [declaring, setDeclaring] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [declaredAt, setDeclaredAt] = useState<string | null>(paymentDeclaredAt ?? null);

  const pricing =
    typeof priceMxn === "number" && priceMxn > 0
      ? computeEventIva(priceMxn, {
          includeIva: priceIncludesIva,
          includeService: priceIncludesService,
        })
      : null;

  const deadlineLabel = paymentDeadlineAt
    ? formatPaymentDeadlineDate(paymentDeadlineAt, locale)
    : "";

  async function declarePayment() {
    if (declaring || declaredAt) return;
    setDeclaring(true);
    setError(null);
    try {
      const res = await authFetch(
        `/api/me/participations/${encodeURIComponent(participationId)}/declare-payment`,
        { method: "POST", body: "{}" },
      );
      const json = (await res.json()) as {
        ok?: boolean;
        error?: string;
        paymentDeclaredAt?: string;
      };
      if (!res.ok || !json.ok) {
        throw new Error(json.error ?? "declare_failed");
      }
      const iso = json.paymentDeclaredAt ?? new Date().toISOString();
      setDeclaredAt(iso);
      onDeclared?.(iso);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setDeclaring(false);
    }
  }

  return (
    <div id="access" className="mt-8 space-y-4">
      <h2 className={FORM_SECTION_TITLE}>{t("accessTitle")}</h2>
      <p className="text-sm text-ns-secondary">{t("accessIntro")}</p>
      {pricing ? (
        <p className="text-sm font-semibold text-ns-tertiary">
          {t("accessPrice", {
            amount: formatMxn(pricing.totalWithIva, locale),
          })}
        </p>
      ) : null}
      {deadlineLabel ? (
        <p className="text-sm font-semibold text-ns-tertiary">
          {t("accessDeadline", { date: deadlineLabel })}
        </p>
      ) : null}
      <div className="rounded-xl border border-gray-100 bg-ns-brand-light/60 px-4 py-3 text-sm text-ns-secondary">
        <p className="font-semibold text-ns-tertiary">{t("accessBankTitle")}</p>
        <p className="mt-1">
          {EVENT_PAYMENT_BANK.entidad} · CLABE {EVENT_PAYMENT_BANK.clabe}
        </p>
        <p>
          {EVENT_PAYMENT_BANK.cuenta} · {EVENT_PAYMENT_BANK.nombre}
        </p>
        <p className="mt-2 text-xs">{t("accessBankHint")}</p>
      </div>
      {declaredAt ? (
        <p className="text-sm font-semibold text-ns-primary">{t("accessDeclared")}</p>
      ) : (
        <button
          type="button"
          className={`${BTN_SECONDARY} text-sm`}
          disabled={declaring}
          onClick={() => void declarePayment()}
        >
          {declaring ? t("accessDeclaring") : t("accessDeclareCta")}
        </button>
      )}
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </div>
  );
}
