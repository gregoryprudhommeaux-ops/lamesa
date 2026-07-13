"use client";

import {
  BTN_PRIMARY,
  ERROR_TEXT,
  FORM_SECTION_TITLE,
  INPUT_CLASS,
  LABEL_CLASS,
} from "@/lib/ui/nextstep";
import { POSITIONS, SECTORS } from "@/lib/constants/form-options";
import { isValidLinkedInUrl } from "@/lib/linkedin";
import { PhoneInput, isValidFullPhone } from "@/components/phone-input";
import { Link } from "@/i18n/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";

type FormState = "idle" | "sending" | "success" | "error";

export function ProfileRegistrationForm() {
  const t = useTranslations("registration");
  const tFooter = useTranslations("footer");
  const locale = useLocale();
  const [state, setState] = useState<FormState>("idle");
  const [errorDetail, setErrorDetail] = useState<string | null>(null);
  const [phoneResetKey, setPhoneResetKey] = useState(0);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setState("sending");
    setErrorDetail(null);

    const form = event.currentTarget;
    const data = new FormData(form);

    const linkedinUrl = String(data.get("linkedinUrl") ?? "").trim();
    if (!isValidLinkedInUrl(linkedinUrl)) {
      setState("error");
      setErrorDetail("invalid_linkedin");
      return;
    }

    const phone = String(data.get("phone") ?? "").trim();
    if (!isValidFullPhone(phone)) {
      setState("error");
      setErrorDetail("invalid_phone");
      return;
    }

    const payload = {
      fullName: String(data.get("fullName") ?? "").trim(),
      linkedinUrl,
      email: String(data.get("email") ?? "").trim(),
      company: String(data.get("company") ?? "").trim(),
      sector: String(data.get("sector") ?? "").trim(),
      position: String(data.get("position") ?? "").trim(),
      extraActivities: [String(data.get("extraActivities") ?? "").trim()],
      city: String(data.get("city") ?? "").trim(),
      phone,
      invitationMotivation: String(data.get("invitationMotivation") ?? "").trim(),
      locale,
      website: String(data.get("website") ?? ""),
    };

    try {
      const res = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = (await res.json()) as { ok?: boolean; error?: string };

      if (!res.ok || !json.ok) {
        setState("error");
        setErrorDetail(json.error ?? "validation");
        return;
      }

      setState("success");
      form.reset();
      setPhoneResetKey((k) => k + 1);
    } catch {
      setState("error");
      setErrorDetail(null);
    }
  }

  if (state === "success") {
    return (
      <div className="flex min-h-[280px] flex-col items-center justify-center gap-6 px-2 text-center">
        <p className="max-w-md text-sm font-medium leading-relaxed text-ns-primary">
          {t("success")}
        </p>
        <div className="flex max-w-md flex-col items-center gap-3">
          <p className="text-sm font-medium leading-relaxed text-ns-secondary">
            {t("successLoginHint")}
          </p>
          <Link href="/connexion" className={BTN_PRIMARY}>
            {t("successLoginCta")}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-8">
      <input type="text" name="website" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden />

      <div>
        <h2 className="text-xl font-bold text-ns-hero">{t("title")}</h2>
        <p className="mt-1 text-sm font-medium text-ns-secondary">{t("subtitle")}</p>
      </div>

      <section className="space-y-4">
        <h3 className={FORM_SECTION_TITLE}>{t("sections.identity")}</h3>
        <div>
          <label htmlFor="fullName" className={LABEL_CLASS}>{t("fields.fullName")}</label>
          <input id="fullName" name="fullName" required minLength={3} className={INPUT_CLASS} disabled={state === "sending"} />
        </div>
        <div>
          <label htmlFor="linkedinUrl" className={LABEL_CLASS}>{t("fields.linkedinUrl")}</label>
          <input id="linkedinUrl" name="linkedinUrl" required placeholder={t("fields.linkedinPlaceholder")} className={INPUT_CLASS} disabled={state === "sending"} />
        </div>
        <div>
          <label htmlFor="email" className={LABEL_CLASS}>{t("fields.email")}</label>
          <p className="mt-1 text-sm text-ns-secondary">{t("fields.emailHint")}</p>
          <input id="email" name="email" type="email" required className={`${INPUT_CLASS} mt-2`} disabled={state === "sending"} />
        </div>
      </section>

      <section className="space-y-4">
        <h3 className={FORM_SECTION_TITLE}>{t("sections.professional")}</h3>
        <div>
          <label htmlFor="company" className={LABEL_CLASS}>{t("fields.company")}</label>
          <input id="company" name="company" required minLength={2} className={INPUT_CLASS} disabled={state === "sending"} />
        </div>
        <div>
          <label htmlFor="sector" className={LABEL_CLASS}>{t("fields.sector")}</label>
          <select id="sector" name="sector" required className={INPUT_CLASS} disabled={state === "sending"}>
            <option value="">—</option>
            {SECTORS.map((s) => (
              <option key={s} value={s}>{t(`sectors.${s}`)}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="position" className={LABEL_CLASS}>{t("fields.position")}</label>
          <select id="position" name="position" required className={INPUT_CLASS} disabled={state === "sending"}>
            <option value="">—</option>
            {POSITIONS.map((p) => (
              <option key={p} value={p}>{t(`positions.${p}`)}</option>
            ))}
          </select>
        </div>
      </section>

      <section className="space-y-4">
        <h3 className={FORM_SECTION_TITLE}>{t("sections.interests")}</h3>
        <div>
          <p className="text-sm font-medium text-ns-secondary">{t("fields.extraActivitiesIntro")}</p>
          <textarea
            id="extraActivities"
            name="extraActivities"
            required
            minLength={2}
            maxLength={500}
            rows={3}
            placeholder={t("fields.extraActivitiesPlaceholder")}
            aria-label={t("fields.extraActivitiesIntro")}
            className={`${INPUT_CLASS} mt-2 resize-y`}
            disabled={state === "sending"}
          />
        </div>
      </section>

      <section className="space-y-4">
        <h3 className={FORM_SECTION_TITLE}>{t("sections.contact")}</h3>
        <div>
          <label htmlFor="city" className={LABEL_CLASS}>{t("fields.city")}</label>
          <input id="city" name="city" required placeholder={t("fields.cityPlaceholder")} className={INPUT_CLASS} disabled={state === "sending"} />
        </div>
        <PhoneInput disabled={state === "sending"} resetKey={phoneResetKey} />
      </section>

      <div>
        <label htmlFor="invitationMotivation" className={LABEL_CLASS}>
          {t("fields.invitationMotivation")}
        </label>
        <textarea
          id="invitationMotivation"
          name="invitationMotivation"
          required
          minLength={10}
          maxLength={2000}
          rows={4}
          placeholder={t("fields.invitationMotivationPlaceholder")}
          className={`${INPUT_CLASS} mt-1 resize-y`}
          disabled={state === "sending"}
        />
      </div>

      {state === "error" && (
        <p className={ERROR_TEXT}>
          {errorDetail && errorDetail in { invalid_linkedin: 1, validation: 1, invalid_phone: 1 }
            ? t(`errors.${errorDetail}` as "errors.invalid_linkedin")
            : t("error")}
        </p>
      )}

      <div>
        <button type="submit" className={BTN_PRIMARY} disabled={state === "sending"}>
          {state === "sending" ? t("submitting") : t("submit")}
        </button>
        <p className="mt-3">
          <Link
            href="/fonctionnement"
            className="text-xs font-medium text-ns-secondary/55 transition hover:text-ns-secondary/80"
          >
            {tFooter("about")}
          </Link>
        </p>
      </div>
    </form>
  );
}
