"use client";

import { useAuth } from "@/components/auth/auth-provider";
import { getClientAuth } from "@/lib/firebase/client";
import { signInWithGoogle } from "@/lib/firebase/google-sign-in";
import { BTN_PRIMARY, ERROR_TEXT } from "@/lib/ui/nextstep";
import { useTranslations } from "next-intl";
import { useState } from "react";

type GoogleLoginButtonProps = {
  label: string;
  redirectingLabel?: string;
  onSuccess?: () => void;
};

function mapGoogleError(code: string | undefined, t: (key: string) => string): string {
  switch (code) {
    case "auth/popup-closed-by-user":
    case "auth/cancelled-popup-request":
      return t("emailAuth.errors.popupClosed");
    case "auth/account-exists-with-different-credential":
      return t("emailAuth.errors.accountExistsDifferent");
    case "auth/network-request-failed":
      return t("emailAuth.errors.network");
    case "auth/too-many-requests":
      return t("emailAuth.errors.tooManyRequests");
    case "auth/user-disabled":
      return t("emailAuth.errors.userDisabled");
    default:
      return t("emailAuth.errors.generic");
  }
}

export function GoogleLoginButton({
  label,
  redirectingLabel = "Redirection Google…",
  onSuccess,
}: GoogleLoginButtonProps) {
  const t = useTranslations("account");
  const { configured } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onClick() {
    setError(null);
    if (!configured) {
      setError(t("emailAuth.errors.notConfigured"));
      return;
    }
    const auth = getClientAuth();
    if (!auth) {
      setError(t("emailAuth.errors.notConfigured"));
      return;
    }
    setBusy(true);
    try {
      const result = await signInWithGoogle(auth);
      if (result === "redirect") {
        // Browser should navigate away; keep busy label briefly.
        return;
      }
      onSuccess?.();
      setBusy(false);
    } catch (err) {
      console.error(err);
      const code = (err as { code?: string })?.code;
      setError(mapGoogleError(code, t));
      setBusy(false);
    }
  }

  return (
    <div className="w-full space-y-2">
      <button
        type="button"
        className={`${BTN_PRIMARY} w-full`}
        disabled={busy || !configured}
        onClick={onClick}
      >
        {busy ? redirectingLabel : label}
      </button>
      {error && <p className={`${ERROR_TEXT} text-center`}>{error}</p>}
    </div>
  );
}
