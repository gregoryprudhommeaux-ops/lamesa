"use client";

import { useAuthFetch } from "@/hooks/use-auth-fetch";
import { Link } from "@/i18n/navigation";
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
  onSaved: () => void | Promise<void>;
};

export function MemberProfilePanel({ profile, onSaved }: MemberProfilePanelProps) {
  const t = useTranslations("account");
  const authFetch = useAuthFetch();
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [fullName, setFullName] = useState(profile.fullName ?? "");
  const [company, setCompany] = useState(profile.company ?? "");
  const [city, setCity] = useState(profile.city ?? "");
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
    setCity(profile.city ?? "");
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

  return (
    <div className="space-y-6">
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
          <label className={LABEL_CLASS}>{t("fields.city")}</label>
          <input
            className={INPUT_CLASS}
            value={city}
            onChange={(e) => setCity(e.target.value)}
            required
          />
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
