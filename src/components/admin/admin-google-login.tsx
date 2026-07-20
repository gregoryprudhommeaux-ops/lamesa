"use client";

import { GoogleLoginButton } from "@/components/auth/google-login-button";
import { useAuth } from "@/components/auth/auth-provider";
import { isPlatformAdminIdentity } from "@/lib/auth/platform-admin";
import { routing } from "@/i18n/routing";
import { ERROR_TEXT } from "@/lib/ui/nextstep";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";

type AdminGoogleLoginProps = {
  title: string;
  googleLabel: string;
  redirectingLabel: string;
};

export function AdminGoogleLogin({
  title,
  googleLabel,
  redirectingLabel,
}: AdminGoogleLoginProps) {
  const { user, loading, isAdmin } = useAuth();
  const router = useRouter();
  const params = useSearchParams();
  const forbidden = params.get("error") === "forbidden";

  useEffect(() => {
    if (loading || !user) return;
    if (isAdmin) {
      router.replace("/admin/dashboard");
      return;
    }
    router.replace(`/${routing.defaultLocale}/compte`);
  }, [user, loading, isAdmin, router]);

  return (
    <div className="mx-auto flex max-w-sm flex-col items-center space-y-4 text-center">
      <h1 className="text-xl font-bold text-ns-hero">{title}</h1>
      {forbidden && (
        <p className={ERROR_TEXT}>
          Ce compte Google n&apos;a pas accès à l&apos;administration.
        </p>
      )}
      {!loading && user && !isPlatformAdminIdentity({ email: user.email }) && (
        <p className={ERROR_TEXT}>
          Connecté en tant que {user.email} — redirection vers l&apos;espace membre…
        </p>
      )}
      <div className="w-full">
        <GoogleLoginButton label={googleLabel} redirectingLabel={redirectingLabel} />
      </div>
    </div>
  );
}
