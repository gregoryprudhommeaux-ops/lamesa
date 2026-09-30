"use client";

import { Link } from "@/i18n/navigation";
import { useAuthFetch } from "@/hooks/use-auth-fetch";
import { computeEventIva, formatMxn } from "@/lib/events/pricing";
import { EVENT_PAYMENT_BANK } from "@/lib/events/payment-details";
import type { MemberNextAction } from "@/lib/member/next-actions";
import { BTN_PRIMARY, BTN_SECONDARY, FORM_SECTION_TITLE } from "@/lib/ui/nextstep";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";

type MemberNextActionsCardProps = {
  actions: MemberNextAction[];
  onDeclared?: () => void;
};

function ActionCta({
  action,
  label,
  primary,
}: {
  action: MemberNextAction;
  label: string;
  primary?: boolean;
}) {
  const className = primary ? `${BTN_PRIMARY} text-sm` : `${BTN_SECONDARY} text-sm`;
  const external = action.href.startsWith("http");
  if (external) {
    return (
      <a href={action.href} className={className}>
        {label}
      </a>
    );
  }
  return (
    <Link href={action.href} className={className}>
      {label}
    </Link>
  );
}

export function MemberNextActionsCard({ actions, onDeclared }: MemberNextActionsCardProps) {
  const t = useTranslations("account.nextActions");
  const locale = useLocale() as "fr" | "en" | "es";
  const authFetch = useAuthFetch();
  const [declaring, setDeclaring] = useState(false);
  const [declareError, setDeclareError] = useState<string | null>(null);
  const [declaredLocal, setDeclaredLocal] = useState<string | null>(null);

  if (actions.length === 0) return null;

  const primary = actions[0]!;
  const rest = actions.slice(1);
  const paymentDeclared =
    Boolean(primary.paymentDeclaredAt) ||
    (primary.participationId != null && declaredLocal === primary.participationId);

  async function declarePayment() {
    if (!primary.participationId || declaring) return;
    setDeclaring(true);
    setDeclareError(null);
    try {
      const res = await authFetch(
        `/api/me/participations/${encodeURIComponent(primary.participationId)}/declare-payment`,
        { method: "POST", body: "{}" },
      );
      const json = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !json.ok) {
        throw new Error(json.error ?? "declare_failed");
      }
      setDeclaredLocal(primary.participationId);
      onDeclared?.();
    } catch (e) {
      setDeclareError(e instanceof Error ? e.message : String(e));
    } finally {
      setDeclaring(false);
    }
  }

  return (
    <section className="space-y-4 rounded-2xl border border-ns-primary/30 bg-gradient-to-br from-ns-surface via-ns-surface to-ns-brand-light/40 p-5 shadow-sm">
      <div>
        <p className="text-[11px] font-bold uppercase tracking-wide text-ns-primary">
          {t("eyebrow")}
        </p>
        <h3 className={`mt-1 ${FORM_SECTION_TITLE}`}>{t(`kinds.${primary.kind}.title`)}</h3>
        <p className="mt-1 text-sm text-ns-secondary">
          {primary.kind === "complete_profile"
            ? t("kinds.complete_profile.reason", {
                percent: primary.completionPercent ?? 0,
              })
            : primary.kind === "pay_access"
              ? paymentDeclared
                ? t("kinds.pay_access.declaredReason", {
                    event: primary.event?.title ?? "",
                  })
                : t("kinds.pay_access.reason", {
                    event: primary.event?.title ?? "",
                  })
              : primary.kind === "fill_survey"
                ? t("kinds.fill_survey.reason", {
                    event: primary.event?.title ?? "",
                  })
                : t("kinds.open_event.reason", {
                    event: primary.event?.title ?? "",
                  })}
        </p>
        {primary.event?.startsAt ? (
          <p className="mt-1 text-xs text-ns-secondary">
            {new Date(primary.event.startsAt).toLocaleString(locale)}
          </p>
        ) : null}
      </div>

      {primary.kind === "pay_access" ? (
        <div className="rounded-xl border border-gray-100 bg-white/80 px-3 py-2.5 text-xs text-ns-secondary">
          {typeof primary.priceMxn === "number" && primary.priceMxn > 0 ? (
            <p className="font-semibold text-ns-tertiary">
              {t("accessPrice", {
                amount: formatMxn(
                  computeEventIva(primary.priceMxn, {
                    includeIva: primary.priceIncludesIva !== false,
                    includeService: primary.priceIncludesService !== false,
                  }).totalWithIva,
                  locale,
                ),
              })}
            </p>
          ) : null}
          <p className="mt-1 font-semibold text-ns-tertiary">{t("bankTitle")}</p>
          <p className="mt-0.5">
            {EVENT_PAYMENT_BANK.entidad} · CLABE {EVENT_PAYMENT_BANK.clabe}
          </p>
          <p>
            {EVENT_PAYMENT_BANK.cuenta} · {EVENT_PAYMENT_BANK.nombre}
          </p>
          <p className="mt-1 text-[11px]">{t("bankHint")}</p>
          {paymentDeclared ? (
            <p className="mt-2 font-semibold text-ns-primary">{t("declaredBadge")}</p>
          ) : primary.participationId ? (
            <button
              type="button"
              className={`${BTN_SECONDARY} mt-2 text-xs`}
              disabled={declaring}
              onClick={() => void declarePayment()}
            >
              {declaring ? t("declaring") : t("declareCta")}
            </button>
          ) : null}
          {declareError ? (
            <p className="mt-1 text-[11px] text-red-600">{declareError}</p>
          ) : null}
        </div>
      ) : null}

      <ActionCta action={primary} label={t(`kinds.${primary.kind}.cta`)} primary />

      {rest.length > 0 ? (
        <ul className="space-y-2 border-t border-gray-100 pt-3">
          {rest.map((action) => (
            <li
              key={action.id}
              className="flex flex-wrap items-center justify-between gap-2 text-sm"
            >
              <div className="min-w-0">
                <p className="font-semibold text-ns-tertiary">
                  {t(`kinds.${action.kind}.title`)}
                </p>
                {action.event?.title ? (
                  <p className="truncate text-xs text-ns-secondary">{action.event.title}</p>
                ) : null}
              </div>
              <ActionCta action={action} label={t(`kinds.${action.kind}.cta`)} />
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
