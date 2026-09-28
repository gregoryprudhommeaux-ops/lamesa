"use client";

import { useAuth } from "@/components/auth/auth-provider";
import { DinnerSubjectPicker } from "@/components/dinner-subject-picker";
import { useAuthFetch } from "@/hooks/use-auth-fetch";
import { Link } from "@/i18n/navigation";
import { withNextQuery } from "@/lib/auth/safe-next-path";
import {
  computeProfileCompletionPercent,
  isProfileIncomplete,
  listMissingProfileFieldsForLocale,
} from "@/lib/member/profile-completion";
import type { DinnerSubjectInterest, WaitlistRegistration } from "@/lib/types/events";
import { BTN_PRIMARY, BTN_SECONDARY, ERROR_TEXT } from "@/lib/ui/nextstep";
import { useLocale, useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";

type Profile = WaitlistRegistration & { id: string };

type Gate =
  | "loading"
  | "anonymous"
  | "not_on_waitlist"
  | "incomplete"
  | "ready";

export function PublicSubjectsPage() {
  const t = useTranslations("subjectsPage");
  const tReg = useTranslations("registration");
  const locale = useLocale();
  const { user, loading: authLoading } = useAuth();
  const authFetch = useAuthFetch();

  const [gate, setGate] = useState<Gate>("loading");
  const [profile, setProfile] = useState<Profile | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const nextThemes = "/themes";
  const loginHref = withNextQuery("/connexion", nextThemes);
  const signupHref = withNextQuery("/inscription", nextThemes);
  const compteHref = withNextQuery("/compte?tab=profil", nextThemes);

  const loadProfile = useCallback(async () => {
    if (!user) {
      setGate("anonymous");
      setProfile(null);
      return;
    }
    setGate("loading");
    setError(null);
    try {
      const res = await authFetch(`/api/me?locale=${encodeURIComponent(locale)}`);
      const json = (await res.json()) as {
        ok?: boolean;
        profile?: Profile | null;
        notOnWaitlist?: boolean;
      };
      if (!res.ok || !json.ok) {
        setError(t("errors.loadFailed"));
        setGate("anonymous");
        return;
      }
      if (json.notOnWaitlist || !json.profile) {
        setProfile(null);
        setGate("not_on_waitlist");
        return;
      }
      setProfile(json.profile);
      setSelectedIds(
        (json.profile.dinnerSubjectInterests ?? []).map(
          (row: DinnerSubjectInterest) => row.subjectId,
        ),
      );
      setGate(isProfileIncomplete(json.profile) ? "incomplete" : "ready");
    } catch {
      setError(t("errors.loadFailed"));
      setGate("anonymous");
    }
  }, [authFetch, locale, t, user]);

  useEffect(() => {
    if (authLoading) return;
    void loadProfile();
  }, [authLoading, loadProfile]);

  async function save() {
    if (gate !== "ready") return;
    setSaving(true);
    setSaved(false);
    setError(null);
    try {
      const res = await authFetch("/api/me/dinner-subjects", {
        method: "PATCH",
        body: JSON.stringify({ dinnerSubjectIds: selectedIds }),
      });
      const json = (await res.json()) as {
        ok?: boolean;
        error?: string;
        dinnerSubjectInterests?: DinnerSubjectInterest[];
      };
      if (!res.ok || !json.ok) {
        if (json.error === "profile_incomplete") {
          setGate("incomplete");
          setError(t("errors.profileIncomplete"));
        } else {
          setError(t("errors.saveFailed"));
        }
        return;
      }
      if (json.dinnerSubjectInterests && profile) {
        setProfile({ ...profile, dinnerSubjectInterests: json.dinnerSubjectInterests });
      }
      setSaved(true);
    } catch {
      setError(t("errors.saveFailed"));
    } finally {
      setSaving(false);
    }
  }

  const missing =
    profile && gate === "incomplete"
      ? listMissingProfileFieldsForLocale(profile, locale)
      : [];

  return (
    <div className="space-y-6">
      <header className="space-y-2 text-center">
        <h1 className="text-2xl font-bold text-ns-primary sm:text-3xl">{t("title")}</h1>
        <p className="mx-auto max-w-xl text-sm leading-relaxed text-ns-secondary">
          {t("intro")}
        </p>
      </header>

      <DinnerSubjectPicker
        locale={locale}
        selectedIds={selectedIds}
        onChange={(ids) => {
          if (gate !== "ready") return;
          setSelectedIds(ids);
          setSaved(false);
        }}
        disabled={gate !== "ready" || saving}
        label={t("listLabel")}
        hint={t("pickerHint")}
        emptyLabel={tReg("fields.dinnerSubjectsEmpty")}
      />

      {gate === "loading" || authLoading ? (
        <p className="text-center text-sm text-ns-secondary">{t("loading")}</p>
      ) : null}

      {gate === "anonymous" ? (
        <div className="space-y-3 rounded-md border border-white/10 bg-white/5 p-4 text-center">
          <p className="text-sm text-ns-secondary">{t("gateAnonymous")}</p>
          <div className="flex flex-wrap justify-center gap-2">
            <Link href={loginHref} className={BTN_PRIMARY}>
              {t("ctaLogin")}
            </Link>
            <Link href={signupHref} className={BTN_SECONDARY}>
              {t("ctaRegister")}
            </Link>
          </div>
        </div>
      ) : null}

      {gate === "not_on_waitlist" ? (
        <div className="space-y-3 rounded-md border border-amber-200/40 bg-amber-50/10 p-4 text-center">
          <p className="text-sm text-ns-secondary">{t("gateNotMember")}</p>
          <Link href={signupHref} className={BTN_PRIMARY}>
            {t("ctaRegister")}
          </Link>
        </div>
      ) : null}

      {gate === "incomplete" && profile ? (
        <div className="space-y-3 rounded-md border border-amber-200/40 bg-amber-50/10 p-4">
          <p className="text-sm font-semibold text-ns-primary">
            {t("gateIncomplete", {
              percent: computeProfileCompletionPercent(profile),
            })}
          </p>
          {missing.length > 0 ? (
            <p className="text-xs text-ns-secondary">
              {t("missingFields", { fields: missing.join(", ") })}
            </p>
          ) : null}
          <Link href={compteHref} className={BTN_PRIMARY}>
            {t("ctaCompleteProfile")}
          </Link>
        </div>
      ) : null}

      {gate === "ready" ? (
        <div className="flex flex-col items-center gap-2">
          <button
            type="button"
            className={BTN_PRIMARY}
            disabled={saving || selectedIds.length === 0}
            onClick={() => void save()}
          >
            {saving ? t("saving") : t("ctaSave")}
          </button>
          {selectedIds.length === 0 ? (
            <p className="text-xs text-ns-secondary">{t("selectAtLeastOne")}</p>
          ) : null}
          {saved ? <p className="text-sm font-semibold text-emerald-700">{t("saved")}</p> : null}
          <p className="max-w-md text-center text-xs text-ns-secondary">{t("validationNote")}</p>
        </div>
      ) : null}

      {error ? <p className={`${ERROR_TEXT} text-center`}>{error}</p> : null}
    </div>
  );
}
