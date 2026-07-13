"use client";

import { MemberCalendar } from "@/components/account/member-calendar";
import { MemberDashboard } from "@/components/account/member-dashboard";
import { MemberShell, useMemberTab } from "@/components/account/member-shell";
import { MemberProfilePanel } from "@/components/account/member-profile-panel";
import { RequireAuth } from "@/components/auth/require-auth";
import { useAuth } from "@/components/auth/auth-provider";
import { useAuthFetch } from "@/hooks/use-auth-fetch";
import { Link } from "@/i18n/navigation";
import type { MePayload } from "@/lib/types/member-me";
import { BTN_PRIMARY, ERROR_TEXT } from "@/lib/ui/nextstep";
import { useLocale, useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";

function MemberAccountInner() {
  const t = useTranslations("account");
  const authFetch = useAuthFetch();
  const { logout, isAdmin } = useAuth();
  const tab = useMemberTab();
  const [data, setData] = useState<MePayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [authFetch]);

  useEffect(() => {
    void load();
  }, [load]);

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
    <MemberShell>
      <div className="space-y-8">
        {error && <p className={ERROR_TEXT}>{error}</p>}

        {tab === "dashboard" && data && <MemberDashboard data={data} />}

        {tab === "calendrier" && <MemberCalendar />}

        {tab === "profil" && data?.profile && (
          <MemberProfilePanel profile={data.profile} onSaved={load} />
        )}
      </div>
    </MemberShell>
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
