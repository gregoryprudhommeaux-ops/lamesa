"use client";

import { useAuthFetch } from "@/hooks/use-auth-fetch";
import { Link } from "@/i18n/navigation";
import { POSITIONS, SECTORS } from "@/lib/constants/form-options";
import { CITY_HUBS, resolveCityHub } from "@/lib/constants/city-hubs";
import type { WaitlistRegistration } from "@/lib/types/events";
import {
  BTN_PRIMARY,
  ERROR_TEXT,
  FORM_SECTION_TITLE,
  INPUT_CLASS,
  LABEL_CLASS,
} from "@/lib/ui/nextstep";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";

type Profile = WaitlistRegistration & { id: string };

type MemberProfilePanelProps = {
  profile: Profile;
  completionPercent: number;
  onSaved: () => void | Promise<void>;
};

export function MemberProfilePanel({
  profile,
  completionPercent,
  onSaved,
}: MemberProfilePanelProps) {
  const t = useTranslations("account");
  const tReg = useTranslations("registration");
  const authFetch = useAuthFetch();
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [fullName, setFullName] = useState(profile.fullName ?? "");
  const [company, setCompany] = useState(profile.company ?? "");
  const [sector, setSector] = useState(profile.sector ?? "");
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
    setSector(profile.sector ?? "");
    setPosition(profile.position ?? "");
    setCity(resolveCityHub(profile.city) ?? "");
    setPhone(profile.phone ?? "");
    setLinkedinUrl(profile.linkedinUrl ?? "");
    setExtraActivities((profile.extraActivities ?? []).join(", "));
    setInvitationMotivation(profile.invitationMotivation ?? "");
    setCanBring(profile.canBring ?? "");
    setIsSeeking(profile.isSeeking ?? "");
  }, [profile]);

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSaved(false);
    setError(null);
    try {
      const res = await authFetch("/api/me/profile", {
        method: "PATCH",
        body: JSON.stringify({
          fullName,
          company,
          sector,
          position,
          city,
          phone,
          linkedinUrl,
          extraActivities: [extraActivities.trim()].filter(Boolean),
          invitationMotivation,
          canBring,
          isSeeking,
        }),
      });
      const json = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !json.ok) {
        setError(json.error ?? "save_failed");
        return;
      }
      setSaved(true);
      await onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  const incomplete = completionPercent < 100;

  return (
    <div className="space-y-6">
      {incomplete ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 sm:px-5">
          <p className="text-sm font-bold text-ns-tertiary">
            {t("completionRate", { percent: completionPercent })}
          </p>
          <p className="mt-1.5 text-sm leading-relaxed text-ns-secondary">
            {t("completionHint")}
          </p>
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-amber-100">
            <div
              className="h-full rounded-full bg-amber-500 transition-[width]"
              style={{ width: `${completionPercent}%` }}
            />
          </div>
        </div>
      ) : null}

      {error && <p className={ERROR_TEXT}>{error}</p>}
      {saved && <p className="text-sm font-medium text-ns-primary">{t("saved")}</p>}

      <form onSubmit={(e) => void saveProfile(e)} className="space-y-4">
        <h3 className={FORM_SECTION_TITLE}>{t("profileTitle")}</h3>
        <div>
          <label className={LABEL_CLASS}>{t("fields.fullName")}</label>
          <input
            className={INPUT_CLASS}
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            required
          />
        </div>
        <div>
          <label className={LABEL_CLASS}>{t("fields.linkedinUrl")}</label>
          <input
            className={INPUT_CLASS}
            value={linkedinUrl}
            onChange={(e) => setLinkedinUrl(e.target.value)}
            required
          />
        </div>
        <div>
          <label className={LABEL_CLASS}>{t("fields.company")}</label>
          <input
            className={INPUT_CLASS}
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
            className={INPUT_CLASS}
            value={sector}
            onChange={(e) => setSector(e.target.value)}
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
        <div>
          <label className={LABEL_CLASS} htmlFor="member-position">
            {t("fields.position")}
          </label>
          <select
            id="member-position"
            className={INPUT_CLASS}
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
            className={INPUT_CLASS}
            value={city}
            onChange={(e) => setCity(e.target.value)}
            required
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
            className={INPUT_CLASS}
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            required
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
            className={`${INPUT_CLASS} resize-y`}
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

      <p className="border-t border-gray-100 pt-6 text-sm">
        <Link href="/reglages" className="font-semibold text-ns-primary hover:underline">
          {t("settingsLink")}
        </Link>
      </p>
    </div>
  );
}
