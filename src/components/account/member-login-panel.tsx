"use client";

import { GoogleLoginButton } from "@/components/auth/google-login-button";
import { useAuth } from "@/components/auth/auth-provider";
import { Link } from "@/i18n/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export function MemberLoginPanel() {
  const t = useTranslations("account");
  const { user, loading, isAdmin } = useAuth();
  const router = useRouter();
  const locale = useLocale();

  useEffect(() => {
    if (loading || !user) return;
    if (isAdmin) {
      router.replace("/admin/evenements");
      return;
    }
    router.replace(`/${locale}/compte`);
  }, [user, loading, isAdmin, router, locale]);

  return (
    <div className="mx-auto flex max-w-sm flex-col items-center space-y-4 text-center">
      <h2 className="text-xl font-bold text-ns-hero">{t("loginTitle")}</h2>
      <p className="text-sm text-ns-secondary">{t("loginHint")}</p>
      <div className="w-full">
        <GoogleLoginButton label={t("googleLogin")} redirectingLabel={t("googleRedirecting")} />
      </div>
      <p className="text-xs text-ns-secondary">
        {t("noAccount")}{" "}
        <Link href="/inscription" className="font-semibold text-ns-primary hover:underline">
          {t("joinWaitlist")}
        </Link>
      </p>
    </div>
  );
}
