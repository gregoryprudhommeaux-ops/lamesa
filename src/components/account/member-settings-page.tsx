"use client";

import { useAuth } from "@/components/auth/auth-provider";
import { RequireAuth } from "@/components/auth/require-auth";
import { useAuthFetch } from "@/hooks/use-auth-fetch";
import { Link } from "@/i18n/navigation";
import type { WaitlistRegistration } from "@/lib/types/events";
import { BTN_PRIMARY, BTN_SECONDARY, ERROR_TEXT, FORM_SECTION_TITLE } from "@/lib/ui/nextstep";
import { deleteUser } from "firebase/auth";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

type Profile = WaitlistRegistration & { id: string };

type MeLite = {
  ok?: boolean;
  profile: Profile | null;
  notOnWaitlist?: boolean;
  error?: string;
};

function MemberSettingsInner() {
  const t = useTranslations("account");
  const locale = useLocale();
  const router = useRouter();
  const authFetch = useAuthFetch();
  const { user, logout } = useAuth();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await authFetch("/api/me");
      const json = (await res.json()) as MeLite;
      if (!res.ok || !json.ok) {
        setError(json.error ?? "error");
        return;
      }
      setProfile(json.profile ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [authFetch]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleSignOut() {
    await logout();
    window.location.href = `/${locale}/connexion`;
  }

  async function handleDelete() {
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

      if (user) {
        try {
          await deleteUser(user);
        } catch (err) {
          const code = (err as { code?: string } | null)?.code;
          if (code === "auth/requires-recent-login") {
            setError(t("settings.requiresRecentLogin"));
            setConfirmDelete(false);
            return;
          }
          throw err;
        }
      }

      router.replace(`/${locale}/inscription`);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setConfirmDelete(false);
    } finally {
      setDeleting(false);
    }
  }

  if (loading) return <p className="text-sm text-ns-secondary">{t("loading")}</p>;

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-xl font-bold text-ns-hero">{t("settings.title")}</h2>
        <p className="mt-1 text-sm text-ns-secondary">{user?.email}</p>
        {profile?.fullName && <p className="text-sm text-ns-secondary">{profile.fullName}</p>}
      </div>

      {error && <p className={ERROR_TEXT}>{error}</p>}

      <div className="flex flex-wrap gap-4 text-sm font-semibold">
        <Link href="/compte?tab=profil" className="text-ns-primary hover:underline">
          {t("settings.profileLink")}
        </Link>
        <button
          type="button"
          onClick={() => void handleSignOut()}
          className="text-ns-secondary hover:text-ns-tertiary"
        >
          {t("logout")}
        </button>
      </div>

      {profile && (
        <section className="space-y-3 border-t border-gray-100 pt-8">
          <h3 className={FORM_SECTION_TITLE}>{t("settings.deleteTitle")}</h3>
          <p className="text-sm text-ns-secondary">{t("settings.deleteHint")}</p>
          {!confirmDelete ? (
            <button
              type="button"
              className={`${BTN_SECONDARY} text-red-700`}
              disabled={deleting}
              onClick={() => setConfirmDelete(true)}
            >
              {t("settings.deleteCta")}
            </button>
          ) : (
            <div className="space-y-3 rounded-xl border border-red-100 bg-red-50/60 p-4">
              <p className="text-sm font-medium text-ns-tertiary">{t("settings.deleteConfirm")}</p>
              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  className={`${BTN_PRIMARY} bg-red-600 hover:bg-red-700`}
                  disabled={deleting}
                  onClick={() => void handleDelete()}
                >
                  {deleting ? t("settings.deleting") : t("settings.deleteConfirmCta")}
                </button>
                <button
                  type="button"
                  className={BTN_SECONDARY}
                  disabled={deleting}
                  onClick={() => setConfirmDelete(false)}
                >
                  {t("settings.deleteCancel")}
                </button>
              </div>
            </div>
          )}
        </section>
      )}
    </div>
  );
}

export function MemberSettingsPage() {
  const locale = useLocale();
  return (
    <RequireAuth loginHref={`/${locale}/connexion`}>
      <MemberSettingsInner />
    </RequireAuth>
  );
}
