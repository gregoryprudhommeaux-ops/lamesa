"use client";

import { PhoneInput } from "@/components/phone-input";
import { Link, useRouter } from "@/i18n/navigation";
import { isValidFullPhone } from "@/lib/constants/phone-countries";
import { BTN_PRIMARY, BTN_SECONDARY, ERROR_TEXT, INPUT_CLASS, LABEL_CLASS } from "@/lib/ui/nextstep";
import { useLocale, useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { useMemo, useState, type FormEvent } from "react";

/** Relative app path only — blocks open redirects. */
function safeNextPath(raw: string | null): string | null {
  if (!raw) return null;
  const path = raw.trim();
  if (!path.startsWith("/") || path.startsWith("//") || path.includes("://")) return null;
  if (path.includes("\\")) return null;
  if (path === "/admin" || path.startsWith("/admin/")) return null;
  return path;
}

export function ExpressSignupForm() {
  const t = useTranslations("light");
  const tReg = useTranslations("registration");
  const locale = useLocale();
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextPath = useMemo(() => safeNextPath(searchParams.get("next")), [searchParams]);

  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [existingEmail, setExistingEmail] = useState<string | null>(null);
  const [resetKey, setResetKey] = useState(0);

  function connexionHref(email?: string) {
    const params = new URLSearchParams();
    params.set("mode", "signin");
    if (email) params.set("email", email);
    if (nextPath) params.set("next", nextPath);
    return `/connexion?${params.toString()}`;
  }

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setExistingEmail(null);
    const form = e.currentTarget;
    const fd = new FormData(form);
    const fullName = String(fd.get("fullName") ?? "").trim();
    const email = String(fd.get("email") ?? "").trim().toLowerCase();
    const phone = String(fd.get("phone") ?? "").trim();
    const website = String(fd.get("website") ?? "").trim();

    if (!isValidFullPhone(phone)) {
      setError(tReg("errors.invalid_phone"));
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/register/light", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName,
          email,
          phone,
          locale,
          website: website || undefined,
        }),
      });
      const json = (await res.json()) as { ok?: boolean; error?: string };
      if (res.status === 409 || json.error === "already_registered") {
        // Known member: send them to sign-in with email prefilled (don't leave "S'inscrire").
        setExistingEmail(email);
        router.push(connexionHref(email));
        return;
      }
      if (!res.ok || !json.ok) {
        setError(
          json.error === "validation" ? tReg("errors.validation") : t("errors.generic"),
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
        <h1 className="font-display text-3xl text-ns-hero sm:text-4xl">{t("successTitle")}</h1>
        <p className="text-sm leading-relaxed text-ns-secondary">{t("successBody")}</p>
        <Link
          href={connexionHref()}
          className={`${BTN_PRIMARY} inline-flex w-full items-center justify-center sm:w-auto`}
        >
          {t("successCta")}
        </Link>
      </div>
    );
  }

  if (existingEmail) {
    return (
      <div className="space-y-4 text-center">
        <p className={ERROR_TEXT}>{t("errors.alreadyRegistered")}</p>
        <Link
          href={connexionHref(existingEmail)}
          className={`${BTN_PRIMARY} inline-flex w-full items-center justify-center`}
        >
          {t("alreadyRegisteredCta")}
        </Link>
        <button
          type="button"
          className={`${BTN_SECONDARY} w-full`}
          onClick={() => setExistingEmail(null)}
        >
          {t("tryOtherEmail")}
        </button>
      </div>
    );
  }

  return (
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
        <label htmlFor="fullName" className={LABEL_CLASS}>
          {t("fields.fullName")}
        </label>
        <input
          id="fullName"
          name="fullName"
          type="text"
          autoComplete="name"
          required
          minLength={3}
          maxLength={120}
          disabled={submitting}
          className={INPUT_CLASS}
          placeholder={t("fields.fullNamePlaceholder")}
        />
      </div>

      <PhoneInput id="phone" required disabled={submitting} resetKey={resetKey} label={t("fields.whatsapp")} />

      <div>
        <label htmlFor="email" className={LABEL_CLASS}>
          {t("fields.email")}
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          maxLength={254}
          disabled={submitting}
          className={INPUT_CLASS}
          placeholder={t("fields.emailPlaceholder")}
        />
      </div>

      {error && <p className={ERROR_TEXT}>{error}</p>}

      <div className="space-y-3">
        <button type="submit" className={`${BTN_PRIMARY} w-full`} disabled={submitting}>
          {submitting ? t("submitting") : t("submitCreate")}
        </button>
        <Link
          href={connexionHref()}
          className={`${BTN_SECONDARY} flex w-full items-center justify-center`}
        >
          {t("submitLogin")}
        </Link>
        <p className="text-center text-xs leading-relaxed text-ns-secondary">{t("submitHint")}</p>
      </div>
    </form>
  );
}
