"use client";

import { useAuth } from "@/components/auth/auth-provider";
import { useAuthFetch } from "@/hooks/use-auth-fetch";
import { POSITIONS, SECTORS, isSectorCode } from "@/lib/constants/form-options";
import { CITY_HUBS, resolveCityHub } from "@/lib/constants/city-hubs";
import { isValidLinkedInUrl, normalizeLinkedInUrl } from "@/lib/linkedin";
import { listMissingProfileFieldsForLocale } from "@/lib/member/profile-completion";
import type { WaitlistRegistration } from "@/lib/types/events";
import {
  BTN_PRIMARY,
  BTN_SECONDARY,
  FORM_SECTION_TITLE,
  INPUT_CLASS,
  LABEL_CLASS,
} from "@/lib/ui/nextstep";
import { deleteUser } from "firebase/auth";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

type Profile = WaitlistRegistration & { id: string };

type MemberProfilePanelProps = {
  profile: Profile;
  completionPercent: number;
  onSaved: () => void | Promise<void>;
};

type FieldKey =
  | "linkedinUrl"
  | "sectorOther"
  | "phone"
  | "city"
  | "fullName"
  | "company"
  | "sector"
  | "position"
  | "invitationMotivation";

function initialSectorState(profile: Profile): { sector: string; sectorOther: string } {
  const raw = (profile.sector ?? "").trim();
  if (!raw) return { sector: "", sectorOther: "" };
  if (isSectorCode(raw)) {
    return {
      sector: raw,
      sectorOther: raw === "other" ? (profile.sectorOther ?? "").trim() : "",
    };
  }
  // Legacy free-text stored as sector value.
  return {
    sector: "other",
    sectorOther: (profile.sectorOther ?? raw).trim(),
  };
}

function fieldInputClass(hasError: boolean): string {
  return hasError
    ? `${INPUT_CLASS} border-red-400 ring-1 ring-red-300`
    : INPUT_CLASS;
}

function formatJoinedAt(iso: string | undefined, locale: string): string {
  if (!iso?.trim()) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(locale === "en" ? "en-US" : locale === "es" ? "es-MX" : "fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export function MemberProfilePanel({
  profile,
  completionPercent,
  onSaved,
}: MemberProfilePanelProps) {
  const t = useTranslations("account");
  const tReg = useTranslations("registration");
  const locale = useLocale();
  const router = useRouter();
  const authFetch = useAuthFetch();
  const { user, logout } = useAuth();
  const errorRef = useRef<HTMLDivElement | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorField, setErrorField] = useState<FieldKey | null>(null);
  const [leaving, setLeaving] = useState(false);
  const [confirmLeave, setConfirmLeave] = useState(false);

  const [fullName, setFullName] = useState(profile.fullName ?? "");
  const [company, setCompany] = useState(profile.company ?? "");
  const [{ sector, sectorOther }, setSectorState] = useState(() => initialSectorState(profile));
  const [position, setPosition] = useState(profile.position ?? "");
  const [city, setCity] = useState(() => resolveCityHub(profile.city) ?? "");
  const [phone, setPhone] = useState(profile.phone ?? "");
  const [linkedinUrl, setLinkedinUrl] = useState(profile.linkedinUrl ?? "");
  const [extraActivities, setExtraActivities] = useState(
    (profile.extraActivities ?? []).join(", "),
  );
  const [invitationMotivation, setInvitationMotivation] = useState(
    profile.invitationMotivation ?? "",
  );
  const [canBring, setCanBring] = useState(profile.canBring ?? "");
  const [isSeeking, setIsSeeking] = useState(profile.isSeeking ?? "");

  useEffect(() => {
    setFullName(profile.fullName ?? "");
    setCompany(profile.company ?? "");
    setSectorState(initialSectorState(profile));
    setPosition(profile.position ?? "");
    setCity(resolveCityHub(profile.city) ?? "");
    setPhone(profile.phone ?? "");
    setLinkedinUrl(profile.linkedinUrl ?? "");
    setExtraActivities((profile.extraActivities ?? []).join(", "));
    setInvitationMotivation(profile.invitationMotivation ?? "");
    setCanBring(profile.canBring ?? "");
    setIsSeeking(profile.isSeeking ?? "");
  }, [profile]);

  const missingFields = useMemo(
    () => listMissingProfileFieldsForLocale(profile, locale),
    [profile, locale],
  );

  function showSaveError(message: string, field: FieldKey | null = null) {
    setError(message);
    setErrorField(field);
    setSaved(false);
    requestAnimationFrame(() => {
      errorRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    });
  }

  function mapApiError(code: string | undefined): { message: string; field: FieldKey | null } {
    switch (code) {
      case "sector_other_required":
        return { message: t("errors.sector_other_required"), field: "sectorOther" };
      case "invalid_linkedin":
        return { message: t("errors.invalid_linkedin"), field: "linkedinUrl" };
      case "invalid_phone":
        return { message: t("errors.invalid_phone"), field: "phone" };
      case "invalid_city":
        return { message: t("errors.invalid_city"), field: "city" };
      case "unauthorized":
        return { message: t("errors.unauthorized"), field: null };
      case "forbidden":
        return { message: t("errors.forbidden"), field: null };
      case "not_on_waitlist":
        return { message: t("errors.not_on_waitlist"), field: null };
      case "validation":
        return { message: t("errors.validation"), field: null };
      default:
        return {
          message: code ? `${t("errors.generic")} (${code})` : t("errors.generic"),
          field: null,
        };
    }
  }

  function normalizeLinkedinField() {
    const normalized = normalizeLinkedInUrl(linkedinUrl);
    if (normalized && normalized !== linkedinUrl.trim()) {
      setLinkedinUrl(normalized);
    }
    return normalized;
  }

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSaved(false);
    setError(null);
    setErrorField(null);

    if (sector === "other" && !sectorOther.trim()) {
      showSaveError(`${t("saveFailedPrefix")} ${t("errors.sector_other_required")}`, "sectorOther");
      setSaving(false);
      return;
    }

    const normalizedLinkedin = normalizeLinkedinField();
    if (!isValidLinkedInUrl(normalizedLinkedin || linkedinUrl)) {
      showSaveError(`${t("saveFailedPrefix")} ${t("errors.invalid_linkedin")}`, "linkedinUrl");
      setSaving(false);
      return;
    }

    try {
      const res = await authFetch("/api/me/profile", {
        method: "PATCH",
        body: JSON.stringify({
          fullName,
          company,
          sector,
          sectorOther: sector === "other" ? sectorOther.trim() : "",
          position,
          city,
          phone,
          linkedinUrl: normalizedLinkedin || linkedinUrl.trim(),
          extraActivities: [extraActivities.trim()].filter(Boolean),
          invitationMotivation,
          canBring,
          isSeeking,
        }),
      });
      const json = (await res.json()) as { ok?: boolean; error?: string; field?: string };
      if (!res.ok || !json.ok) {
        const mapped = mapApiError(json.error);
        const apiField = json.field;
        const knownFields: FieldKey[] = [
          "linkedinUrl",
          "sectorOther",
          "phone",
          "city",
          "fullName",
          "company",
          "sector",
          "position",
          "invitationMotivation",
        ];
        const field =
          apiField && knownFields.includes(apiField as FieldKey)
            ? (apiField as FieldKey)
            : mapped.field;
        showSaveError(`${t("saveFailedPrefix")} ${mapped.message}`, field);
        return;
      }
      setLinkedinUrl(normalizedLinkedin || linkedinUrl.trim());
      setSaved(true);
      await onSaved();
    } catch (err) {
      showSaveError(
        `${t("saveFailedPrefix")} ${err instanceof Error ? err.message : t("errors.save_failed")}`,
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleSignOut() {
    await logout();
    window.location.href = `/${locale}/connexion`;
  }

  async function handleLeaveLaMesa() {
    setLeaving(true);
    setError(null);
    try {
      const res = await authFetch("/api/me/profile", { method: "DELETE" });
      const json = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !json.ok) {
        setError(json.error ?? "delete_failed");
        setConfirmLeave(false);
        return;
      }

      if (user) {
        try {
          await deleteUser(user);
        } catch (err) {
          const code = (err as { code?: string } | null)?.code;
          if (code === "auth/requires-recent-login") {
            setError(t("settings.requiresRecentLogin"));
            setConfirmLeave(false);
            return;
          }
          throw err;
        }
      }

      router.replace(`/${locale}/`);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setConfirmLeave(false);
    } finally {
      setLeaving(false);
    }
  }

  const incomplete = completionPercent < 100;
  const email = (profile.email || user?.email || "").trim();

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-gray-100 bg-ns-brand-light/40 px-4 py-4 sm:px-5">
        <h3 className={FORM_SECTION_TITLE}>{t("accountSummaryTitle")}</h3>
        <dl className="mt-3 space-y-2 text-sm">
          <div className="flex flex-wrap gap-x-3 gap-y-0.5">
            <dt className="font-semibold text-ns-tertiary">{t("joinedAtLabel")}</dt>
            <dd className="text-ns-secondary">{formatJoinedAt(profile.createdAt, locale)}</dd>
          </div>
          <div className="flex flex-wrap gap-x-3 gap-y-0.5">
            <dt className="font-semibold text-ns-tertiary">{t("emailLabel")}</dt>
            <dd className="break-all text-ns-secondary">{email || "—"}</dd>
          </div>
          <div className="flex flex-wrap gap-x-3 gap-y-0.5">
            <dt className="font-semibold text-ns-tertiary">{t("completionRateLabel")}</dt>
            <dd className="text-ns-secondary">{completionPercent}%</dd>
          </div>
        </dl>
      </section>

      {incomplete ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 sm:px-5">
          <p className="text-sm font-bold text-ns-tertiary">
            {t("completionRate", { percent: completionPercent })}
          </p>
          <p className="mt-1.5 text-sm leading-relaxed text-ns-secondary">
            {t("completionHint")}
          </p>
          {missingFields.length > 0 ? (
            <p className="mt-2 text-sm leading-relaxed text-ns-tertiary">
              <span className="font-semibold">{t("missingFieldsTitle")}</span>{" "}
              {missingFields.join(", ")}.
            </p>
          ) : null}
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-amber-100">
            <div
              className="h-full rounded-full bg-amber-500 transition-[width]"
              style={{ width: `${completionPercent}%` }}
            />
          </div>
        </div>
      ) : null}

      {error ? (
        <div
          ref={errorRef}
          role="alert"
          className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium leading-relaxed text-red-800"
        >
          {error}
        </div>
      ) : null}
      {saved && !error ? (
        <p className="text-sm font-medium text-ns-primary" role="status">
          {t("saved")}
        </p>
      ) : null}

      <form onSubmit={(e) => void saveProfile(e)} className="space-y-4" noValidate>
        <h3 className={FORM_SECTION_TITLE}>{t("profileTitle")}</h3>
        <div>
          <label className={LABEL_CLASS}>{t("fields.fullName")}</label>
          <input
            className={fieldInputClass(errorField === "fullName")}
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            required
          />
        </div>
        <div>
          <label className={LABEL_CLASS} htmlFor="member-linkedin">
            {t("fields.linkedinUrl")}
          </label>
          <input
            id="member-linkedin"
            className={fieldInputClass(errorField === "linkedinUrl")}
            value={linkedinUrl}
            onChange={(e) => setLinkedinUrl(e.target.value)}
            onBlur={() => normalizeLinkedinField()}
            placeholder={tReg("fields.linkedinPlaceholder")}
            required
            aria-invalid={errorField === "linkedinUrl"}
            aria-describedby="member-linkedin-hint"
          />
          <p id="member-linkedin-hint" className="mt-1.5 text-xs leading-relaxed text-ns-secondary">
            {t("linkedinHint")}
          </p>
        </div>
        <div>
          <label className={LABEL_CLASS}>{t("fields.company")}</label>
          <input
            className={fieldInputClass(errorField === "company")}
            value={company}
            onChange={(e) => setCompany(e.target.value)}
            required
          />
        </div>
        <div>
          <label className={LABEL_CLASS} htmlFor="member-sector">
            {t("fields.sector")}
          </label>
          <select
            id="member-sector"
            className={fieldInputClass(errorField === "sector" || errorField === "sectorOther")}
            value={sector}
            onChange={(e) => {
              const next = e.target.value;
              setSectorState((prev) => ({
                sector: next,
                sectorOther: next === "other" ? prev.sectorOther : "",
              }));
            }}
            required
          >
            <option value="">{t("fields.selectPlaceholder")}</option>
            {SECTORS.map((s) => (
              <option key={s} value={s}>
                {tReg(`sectors.${s}`)}
              </option>
            ))}
          </select>
        </div>
        {sector === "other" ? (
          <div>
            <label className={LABEL_CLASS} htmlFor="member-sector-other">
              {tReg("fields.sectorOther")}
            </label>
            <input
              id="member-sector-other"
              className={fieldInputClass(errorField === "sectorOther")}
              value={sectorOther}
              onChange={(e) =>
                setSectorState((prev) => ({ ...prev, sectorOther: e.target.value }))
              }
              required
              minLength={2}
              maxLength={120}
              placeholder={tReg("fields.sectorOtherPlaceholder")}
              aria-invalid={errorField === "sectorOther"}
              aria-describedby="member-sector-other-hint"
            />
            <p
              id="member-sector-other-hint"
              className="mt-1.5 text-xs leading-relaxed text-ns-secondary"
            >
              {t("sectorOtherHint")}
            </p>
          </div>
        ) : null}
        <div>
          <label className={LABEL_CLASS} htmlFor="member-position">
            {t("fields.position")}
          </label>
          <select
            id="member-position"
            className={fieldInputClass(errorField === "position")}
            value={position}
            onChange={(e) => setPosition(e.target.value)}
            required
          >
            <option value="">{t("fields.selectPlaceholder")}</option>
            {POSITIONS.map((p) => (
              <option key={p} value={p}>
                {tReg(`positions.${p}`)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={LABEL_CLASS} htmlFor="member-city">
            {t("fields.city")}
          </label>
          <select
            id="member-city"
            className={fieldInputClass(errorField === "city")}
            value={city}
            onChange={(e) => setCity(e.target.value)}
            required
            aria-invalid={errorField === "city"}
          >
            <option value="">{t("fields.selectPlaceholder")}</option>
            {CITY_HUBS.map((hub) => (
              <option key={hub} value={hub}>
                {tReg(`cityHubs.${hub}`)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={LABEL_CLASS}>{t("fields.phone")}</label>
          <input
            className={fieldInputClass(errorField === "phone")}
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            required
            aria-invalid={errorField === "phone"}
          />
        </div>
        <div>
          <label className={LABEL_CLASS}>{t("fields.extraActivities")}</label>
          <textarea
            className={`${INPUT_CLASS} resize-y`}
            rows={2}
            value={extraActivities}
            onChange={(e) => setExtraActivities(e.target.value)}
          />
        </div>
        <div>
          <label className={LABEL_CLASS}>{t("fields.canBring")}</label>
          <textarea
            className={`${INPUT_CLASS} resize-y`}
            rows={2}
            minLength={2}
            maxLength={280}
            value={canBring}
            onChange={(e) => setCanBring(e.target.value)}
          />
        </div>
        <div>
          <label className={LABEL_CLASS}>{t("fields.isSeeking")}</label>
          <textarea
            className={`${INPUT_CLASS} resize-y`}
            rows={2}
            minLength={2}
            maxLength={280}
            value={isSeeking}
            onChange={(e) => setIsSeeking(e.target.value)}
          />
        </div>
        <div>
          <label className={LABEL_CLASS}>{t("fields.invitationMotivation")}</label>
          <textarea
            className={fieldInputClass(errorField === "invitationMotivation")}
            rows={3}
            value={invitationMotivation}
            onChange={(e) => setInvitationMotivation(e.target.value)}
            required
            minLength={10}
          />
        </div>
        <button type="submit" className={BTN_PRIMARY} disabled={saving}>
          {saving ? t("saving") : t("save")}
        </button>
      </form>

      <section className="space-y-4 border-t border-gray-100 pt-6">
        <h3 className={FORM_SECTION_TITLE}>{t("accountActionsTitle")}</h3>
        <button
          type="button"
          onClick={() => void handleSignOut()}
          className={BTN_SECONDARY}
        >
          {t("logout")}
        </button>

        <div className="space-y-3 rounded-xl border border-red-100 bg-red-50/50 p-4">
          <h4 className="text-sm font-bold text-ns-tertiary">{t("leaveTitle")}</h4>
          <p className="text-sm leading-relaxed text-ns-secondary">{t("leaveHint")}</p>
          {!confirmLeave ? (
            <button
              type="button"
              className={`${BTN_SECONDARY} text-red-700`}
              disabled={leaving}
              onClick={() => setConfirmLeave(true)}
            >
              {t("leaveCta")}
            </button>
          ) : (
            <div className="space-y-3">
              <p className="text-sm font-medium text-ns-tertiary">{t("leaveConfirm")}</p>
              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  className={`${BTN_PRIMARY} bg-red-600 hover:bg-red-700`}
                  disabled={leaving}
                  onClick={() => void handleLeaveLaMesa()}
                >
                  {leaving ? t("settings.deleting") : t("leaveConfirmCta")}
                </button>
                <button
                  type="button"
                  className={BTN_SECONDARY}
                  disabled={leaving}
                  onClick={() => setConfirmLeave(false)}
                >
                  {t("settings.deleteCancel")}
                </button>
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
