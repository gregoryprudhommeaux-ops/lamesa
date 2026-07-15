"use client";

import { PhoneInput } from "@/components/phone-input";
import { Link } from "@/i18n/navigation";
import { isValidFullPhone } from "@/lib/constants/phone-countries";
import {
  BTN_PRIMARY,
  ERROR_TEXT,
  INPUT_CLASS,
  LABEL_CLASS,
} from "@/lib/ui/nextstep";
import { useLocale, useTranslations } from "next-intl";
import { useState, type FormEvent } from "react";

export function ContactPageContent() {
  const t = useTranslations("contact");
  const tReg = useTranslations("registration");
  const locale = useLocale();
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resetKey, setResetKey] = useState(0);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const form = e.currentTarget;
    const fd = new FormData(form);
    const phone = String(fd.get("phone") ?? "").trim();

    if (!isValidFullPhone(phone)) {
      setError(tReg("errors.invalid_phone"));
      return;
    }

    const payload = {
      fullName: String(fd.get("fullName") ?? "").trim(),
      email: String(fd.get("email") ?? "").trim().toLowerCase(),
      phone,
      company: String(fd.get("company") ?? "").trim(),
      topic: String(fd.get("topic") ?? ""),
      message: String(fd.get("message") ?? "").trim(),
      locale,
      website: String(fd.get("website") ?? "").trim() || undefined,
    };

    setSubmitting(true);
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !json.ok) {
        setError(
          json.error === "validation" ? t("errors.validation") : t("errors.generic"),
        );
        return;
      }
      setDone(true);
      form.reset();
      setResetKey((k) => k + 1);
    } catch {
      setError(t("errors.generic"));
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <div className="space-y-4 text-center">
        <h2 className="text-2xl font-black uppercase tracking-[0.04em] text-ns-hero">
          {t("successTitle")}
        </h2>
        <p className="text-sm leading-relaxed text-ns-secondary">{t("successBody")}</p>
        <Link href="/" className={`${BTN_PRIMARY} inline-flex`}>
          {t("successCta")}
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header>
        <h2 className="text-2xl font-black uppercase tracking-[0.04em] text-ns-hero">
          {t("title")}
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-ns-secondary">{t("intro")}</p>
      </header>

      <form onSubmit={(e) => void onSubmit(e)} className="space-y-5" noValidate>
        <input
          type="text"
          name="website"
          tabIndex={-1}
          autoComplete="off"
          className="absolute left-[-9999px] h-0 w-0 opacity-0"
          aria-hidden
        />

        <div>
          <label htmlFor="contact-topic" className={LABEL_CLASS}>
            {t("fields.topic")}
          </label>
          <select
            id="contact-topic"
            name="topic"
            required
            disabled={submitting}
            className={INPUT_CLASS}
            defaultValue=""
          >
            <option value="" disabled>
              {t("fields.topicPlaceholder")}
            </option>
            <option value="question">{t("topics.question")}</option>
            <option value="partnership">{t("topics.partnership")}</option>
          </select>
        </div>

        <div>
          <label htmlFor="contact-fullName" className={LABEL_CLASS}>
            {t("fields.fullName")}
          </label>
          <input
            id="contact-fullName"
            name="fullName"
            type="text"
            autoComplete="name"
            required
            minLength={2}
            maxLength={120}
            disabled={submitting}
            className={INPUT_CLASS}
          />
        </div>

        <div>
          <label htmlFor="contact-email" className={LABEL_CLASS}>
            {t("fields.email")}
          </label>
          <input
            id="contact-email"
            name="email"
            type="email"
            autoComplete="email"
            required
            maxLength={254}
            disabled={submitting}
            className={INPUT_CLASS}
          />
        </div>

        <PhoneInput
          id="phone"
          required
          disabled={submitting}
          resetKey={resetKey}
          label={t("fields.phone")}
        />

        <div>
          <label htmlFor="contact-company" className={LABEL_CLASS}>
            {t("fields.company")}
            <span className="font-normal text-ns-secondary"> ({t("fields.optional")})</span>
          </label>
          <input
            id="contact-company"
            name="company"
            type="text"
            autoComplete="organization"
            maxLength={120}
            disabled={submitting}
            className={INPUT_CLASS}
          />
        </div>

        <div>
          <label htmlFor="contact-message" className={LABEL_CLASS}>
            {t("fields.message")}
          </label>
          <textarea
            id="contact-message"
            name="message"
            required
            minLength={20}
            maxLength={4000}
            rows={6}
            disabled={submitting}
            className={`${INPUT_CLASS} min-h-[9rem] resize-y`}
            placeholder={t("fields.messagePlaceholder")}
          />
        </div>

        {error ? <p className={ERROR_TEXT}>{error}</p> : null}

        <button type="submit" disabled={submitting} className={`${BTN_PRIMARY} w-full sm:w-auto`}>
          {submitting ? t("submitting") : t("submit")}
        </button>
      </form>
    </div>
  );
}
