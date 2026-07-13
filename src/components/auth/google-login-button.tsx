"use client";

import { useAuth } from "@/components/auth/auth-provider";
import { getClientAuth } from "@/lib/firebase/client";
import { signInWithGoogle } from "@/lib/firebase/google-sign-in";
import { BTN_PRIMARY, ERROR_TEXT } from "@/lib/ui/nextstep";
import { useState } from "react";

type GoogleLoginButtonProps = {
  label: string;
  redirectingLabel?: string;
  onSuccess?: () => void;
};

export function GoogleLoginButton({
  label,
  redirectingLabel = "Redirection Google…",
  onSuccess,
}: GoogleLoginButtonProps) {
  const { configured } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onClick() {
    setError(null);
    if (!configured) {
      setError("Firebase Auth n'est pas configuré.");
      return;
    }
    const auth = getClientAuth();
    if (!auth) {
      setError("Auth unavailable");
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
      if (code === "auth/unauthorized-domain") {
        setError(
          "Domaine non autorisé. Ajoute 127.0.0.1 (ou utilise localhost) dans Firebase Auth → Settings → Authorized domains.",
        );
      } else {
        setError(
          code
            ? `Connexion Google impossible (${code}). Réessaie.`
            : "Connexion Google impossible. Réessaie.",
        );
      }
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
      {!configured && (
        <p className="text-center text-xs text-ns-secondary">
          Configure les variables NEXT_PUBLIC_FIREBASE_* et active Google dans Firebase Console.
        </p>
      )}
    </div>
  );
}
