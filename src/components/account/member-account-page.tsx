"use client";

import { RequireAuth } from "@/components/auth/require-auth";
import { useAuth } from "@/components/auth/auth-provider";
import { useAuthFetch } from "@/hooks/use-auth-fetch";
import { Link } from "@/i18n/navigation";
import type { WaitlistRegistration } from "@/lib/types/events";
import {
  BTN_PRIMARY,
  BTN_SECONDARY,
  ERROR_TEXT,
  FORM_SECTION_TITLE,
  INPUT_CLASS,
  LABEL_CLASS,
} from "@/lib/ui/nextstep";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

type InvitationEntry = {
  participationId: string;
  status: string;
  event: {
    id: string;
    slug: string;
    title: string;
    startsAt: string;
    endsAt?: string;
    venueName?: string;
    address?: string;
    mapsUrl?: string;
    status?: string;
  };
  fellows: Array<{ fullName?: string; companyName?: string; status: string }>;
};

type MePayload = {
  ok?: boolean;
  profile: (WaitlistRegistration & { id: string }) | null;
  notOnWaitlist?: boolean;
  pastInvitations: InvitationEntry[];
  upcomingInvitations: InvitationEntry[];
  isAdmin?: boolean;
  error?: string;
};

function MemberAccountInner() {
  const t = useTranslations("account");
  const locale = useLocale();
  const router = useRouter();
  const authFetch = useAuthFetch();
  const { logout, user, isAdmin } = useAuth();
  const [data, setData] = useState<MePayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const [fullName, setFullName] = useState("");
  const [company, setCompany] = useState("");
  const [city, setCity] = useState("");
  const [phone, setPhone] = useState("");
  const [linkedinUrl, setLinkedinUrl] = useState("");
  const [extraActivities, setExtraActivities] = useState("");
  const [invitationMotivation, setInvitationMotivation] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await authFetch("/api/me");
      const json = (await res.json()) as MePayload;
      if (!res.ok || !json.ok) {
        setError(json.error ?? "error");
        return;
      }
      setData(json);
      if (json.profile) {
        setFullName(json.profile.fullName ?? "");
        setCompany(json.profile.company ?? "");
        setCity(json.profile.city ?? "");
        setPhone(json.profile.phone ?? "");
        setLinkedinUrl(json.profile.linkedinUrl ?? "");
        setExtraActivities((json.profile.extraActivities ?? []).join(", "));
        setInvitationMotivation(json.profile.invitationMotivation ?? "");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [authFetch]);

  useEffect(() => {
    void load();
  }, [load]);

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
        }),
      });
      const json = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !json.ok) {
        setError(json.error ?? "save_failed");
        return;
      }
      setSaved(true);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  async function deleteProfile() {
    setDeleting(true);
    setError(null);
    try {
      const res = await authFetch("/api/me/profile", { method: "DELETE" });
      const json = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !json.ok) {
        setError(json.error ?? "delete_failed");
        setConfirmDelete(false);
        return;
      }
      await logout();
      router.replace(`/${locale}/inscription`);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setConfirmDelete(false);
    } finally {
      setDeleting(false);
    }
  }

  if (loading) return <p className="text-sm text-ns-secondary">{t("loading")}</p>;

  if (data?.notOnWaitlist && !isAdmin) {
    return (
      <div className="space-y-4">
        <h2 className="text-xl font-bold text-ns-hero">{t("title")}</h2>
        <p className="text-sm text-ns-secondary">{t("notOnWaitlist")}</p>
        <Link href="/inscription" className={BTN_PRIMARY}>
          {t("joinWaitlist")}
        </Link>
        <button
          type="button"
          className="block text-sm text-ns-secondary hover:underline"
          onClick={() => void logout()}
        >
          {t("logout")}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-ns-hero">{t("title")}</h2>
          <p className="mt-1 text-sm text-ns-secondary">{user?.email}</p>
        </div>
        <div className="flex flex-wrap gap-3 text-sm font-semibold">
          {isAdmin && (
            <a href="/admin/evenements" className="text-ns-primary hover:underline">
              {t("adminLink")}
            </a>
          )}
          <button
            type="button"
            onClick={() => void logout().then(() => {
              window.location.href = `/${locale}/connexion`;
            })}
            className="text-ns-secondary hover:text-ns-tertiary"
          >
            {t("logout")}
          </button>
        </div>
      </div>

      {error && <p className={ERROR_TEXT}>{error}</p>}
      {saved && <p className="text-sm font-medium text-ns-primary">{t("saved")}</p>}

      {data?.profile && (
        <form onSubmit={(e) => void saveProfile(e)} className="space-y-4">
          <h3 className={FORM_SECTION_TITLE}>{t("profileTitle")}</h3>
          <div>
            <label className={LABEL_CLASS}>{t("fields.fullName")}</label>
            <input className={INPUT_CLASS} value={fullName} onChange={(e) => setFullName(e.target.value)} required />
          </div>
          <div>
            <label className={LABEL_CLASS}>{t("fields.linkedinUrl")}</label>
            <input className={INPUT_CLASS} value={linkedinUrl} onChange={(e) => setLinkedinUrl(e.target.value)} required />
          </div>
          <div>
            <label className={LABEL_CLASS}>{t("fields.company")}</label>
            <input className={INPUT_CLASS} value={company} onChange={(e) => setCompany(e.target.value)} required />
          </div>
          <div>
            <label className={LABEL_CLASS}>{t("fields.city")}</label>
            <input className={INPUT_CLASS} value={city} onChange={(e) => setCity(e.target.value)} required />
          </div>
          <div>
            <label className={LABEL_CLASS}>{t("fields.phone")}</label>
            <input className={INPUT_CLASS} value={phone} onChange={(e) => setPhone(e.target.value)} required />
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
          <button type="submit" className={BTN_PRIMARY} disabled={saving || deleting}>
            {saving ? t("saving") : t("save")}
          </button>
        </form>
      )}

      {data?.profile && (
        <section className="space-y-3 border-t border-gray-100 pt-8">
          <h3 className={FORM_SECTION_TITLE}>{t("deleteTitle")}</h3>
          <p className="text-sm text-ns-secondary">{t("deleteHint")}</p>
          {!confirmDelete ? (
            <button
              type="button"
              className={`${BTN_SECONDARY} text-red-700`}
              disabled={deleting || saving}
              onClick={() => setConfirmDelete(true)}
            >
              {t("deleteCta")}
            </button>
          ) : (
            <div className="space-y-3 rounded-xl border border-red-100 bg-red-50/60 p-4">
              <p className="text-sm font-medium text-ns-tertiary">{t("deleteConfirm")}</p>
              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  className={`${BTN_PRIMARY} bg-red-600 hover:bg-red-700`}
                  disabled={deleting}
                  onClick={() => void deleteProfile()}
                >
                  {deleting ? t("deleting") : t("deleteConfirmCta")}
                </button>
                <button
                  type="button"
                  className={BTN_SECONDARY}
                  disabled={deleting}
                  onClick={() => setConfirmDelete(false)}
                >
                  {t("deleteCancel")}
                </button>
              </div>
            </div>
          )}
        </section>
      )}

      <section className="space-y-3">
        <h3 className={FORM_SECTION_TITLE}>{t("upcomingTitle")}</h3>
        {(data?.upcomingInvitations ?? []).length === 0 ? (
          <p className="text-sm text-ns-secondary">{t("upcomingEmpty")}</p>
        ) : (
          <ul className="space-y-3">
            {(data?.upcomingInvitations ?? []).map((inv) => (
              <li key={inv.participationId} className="rounded-xl border border-gray-100 bg-ns-brand-light/50 p-4 text-sm">
                <p className="font-bold text-ns-tertiary">{inv.event.title}</p>
                <p className="mt-1 text-ns-secondary">
                  {new Date(inv.event.startsAt).toLocaleString(locale)}
                  {inv.event.venueName ? ` · ${inv.event.venueName}` : ""}
                  {inv.event.address ? ` · ${inv.event.address}` : ""}
                </p>
                <p className="mt-1 text-xs font-semibold uppercase text-ns-primary">
                  {t(`status.${inv.status}` as "status.invited")}
                </p>
                {inv.fellows.length > 0 && (
                  <p className="mt-2 text-xs text-ns-secondary">
                    {t("fellows")}:{" "}
                    {inv.fellows
                      .map((f) => f.fullName ?? t("guest"))
                      .join(", ")}
                  </p>
                )}
                <Link
                  href={`/e/${inv.event.slug}`}
                  className="mt-2 inline-block text-xs font-semibold text-ns-primary hover:underline"
                >
                  {t("viewEvent")}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-3">
        <h3 className={FORM_SECTION_TITLE}>{t("pastTitle")}</h3>
        {(data?.pastInvitations ?? []).length === 0 ? (
          <p className="text-sm text-ns-secondary">{t("pastEmpty")}</p>
        ) : (
          <ul className="space-y-3">
            {(data?.pastInvitations ?? []).map((inv) => (
              <li key={inv.participationId} className="rounded-xl border border-gray-100 p-4 text-sm">
                <p className="font-bold text-ns-tertiary">{inv.event.title}</p>
                <p className="mt-1 text-ns-secondary">
                  {new Date(inv.event.startsAt).toLocaleString(locale)}
                  {inv.event.venueName ? ` · ${inv.event.venueName}` : ""}
                  {inv.event.address ? ` · ${inv.event.address}` : ""}
                </p>
                <p className="mt-1 text-xs font-semibold uppercase text-ns-secondary">
                  {t(`status.${inv.status}` as "status.invited")}
                </p>
                {inv.fellows.length > 0 && (
                  <p className="mt-2 text-xs text-ns-secondary">
                    {t("fellows")}:{" "}
                    {inv.fellows
                      .map((f) =>
                        [f.fullName ?? t("guest"), f.companyName].filter(Boolean).join(" · "),
                      )
                      .join(" · ")}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

export function MemberAccountPage() {
  const locale = useLocale();
  return (
    <RequireAuth loginHref={`/${locale}/connexion`}>
      <MemberAccountInner />
    </RequireAuth>
  );
}
