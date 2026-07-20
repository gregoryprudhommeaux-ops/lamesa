"use client";

import { GoogleLoginButton } from "@/components/auth/google-login-button";
import { useAuth } from "@/components/auth/auth-provider";
import { Link } from "@/i18n/navigation";
import { getClientAuth } from "@/lib/firebase/client";
import { BTN_PRIMARY, ERROR_TEXT, INPUT_CLASS, LABEL_CLASS } from "@/lib/ui/nextstep";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
} from "firebase/auth";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";

type AuthMode = "signin" | "signup";

function mapAuthError(code: string | undefined, messages: {
  invalidEmail: string;
  invalidCredentials: string;
  emailInUse: string;
  weakPassword: string;
  notEnabled: string;
  generic: string;
}): string {
  switch (code) {
    case "auth/invalid-email":
      return messages.invalidEmail;
    case "auth/user-not-found":
    case "auth/wrong-password":
    case "auth/invalid-credential":
      return messages.invalidCredentials;
    case "auth/email-already-in-use":
      return messages.emailInUse;
    case "auth/weak-password":
      return messages.weakPassword;
    case "auth/operation-not-allowed":
      return messages.notEnabled;
    default:
      return messages.generic;
  }
}

export function MemberLoginPanel() {
  const t = useTranslations("account");
  const { user, loading, isAdmin, configured } = useAuth();
  const router = useRouter();
  const locale = useLocale();
  const [mode, setMode] = useState<AuthMode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (loading || !user) return;
    if (isAdmin) {
      router.replace("/admin/dashboard");
      return;
    }
    router.replace(`/${locale}/compte?tab=profil`);
  }, [user, loading, isAdmin, router, locale]);

  async function onEmailSubmit(e: FormEvent) {
    e.preventDefault();
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

    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedEmail || password.length < 6) {
      setError(t("emailAuth.errors.weakPassword"));
      return;
    }
    if (mode === "signup" && password !== confirmPassword) {
      setError(t("emailAuth.errors.passwordMismatch"));
      return;
    }

    setBusy(true);
    try {
      if (mode === "signup") {
        await createUserWithEmailAndPassword(auth, trimmedEmail, password);
      } else {
        await signInWithEmailAndPassword(auth, trimmedEmail, password);
      }
    } catch (err) {
      const code = (err as { code?: string })?.code;
      setError(
        mapAuthError(code, {
          invalidEmail: t("emailAuth.errors.invalidEmail"),
          invalidCredentials: t("emailAuth.errors.invalidCredentials"),
          emailInUse: t("emailAuth.errors.emailInUse"),
          weakPassword: t("emailAuth.errors.weakPassword"),
          notEnabled: t("emailAuth.errors.notEnabled"),
          generic: t("emailAuth.errors.generic"),
        }),
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-sm flex-col items-center space-y-5 text-center">
      <div className="space-y-2">
        <h2 className="text-xl font-bold text-ns-hero">{t("loginTitle")}</h2>
        <p className="text-sm text-ns-secondary">{t("loginHint")}</p>
      </div>

      <div className="w-full">
        <GoogleLoginButton label={t("googleLogin")} redirectingLabel={t("googleRedirecting")} />
      </div>

      <div className="flex w-full items-center gap-3 text-xs text-ns-secondary">
        <div className="h-px flex-1 bg-ns-alternate" />
        <span>{t("emailAuth.or")}</span>
        <div className="h-px flex-1 bg-ns-alternate" />
      </div>

      <form onSubmit={(e) => void onEmailSubmit(e)} className="w-full space-y-3 text-left">
        <div>
          <label htmlFor="login-email" className={LABEL_CLASS}>
            {t("emailAuth.email")}
          </label>
          <input
            id="login-email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={busy}
            className={INPUT_CLASS}
          />
        </div>
        <div>
          <label htmlFor="login-password" className={LABEL_CLASS}>
            {t("emailAuth.password")}
          </label>
          <input
            id="login-password"
            type="password"
            autoComplete={mode === "signup" ? "new-password" : "current-password"}
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={busy}
            className={INPUT_CLASS}
          />
        </div>
        {mode === "signup" && (
          <div>
            <label htmlFor="login-password-confirm" className={LABEL_CLASS}>
              {t("emailAuth.confirmPassword")}
            </label>
            <input
              id="login-password-confirm"
              type="password"
              autoComplete="new-password"
              required
              minLength={6}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              disabled={busy}
              className={INPUT_CLASS}
            />
          </div>
        )}
        {error && <p className={ERROR_TEXT}>{error}</p>}
        <button type="submit" className={`${BTN_PRIMARY} w-full`} disabled={busy || !configured}>
          {busy
            ? t("emailAuth.working")
            : mode === "signup"
              ? t("emailAuth.createAccount")
              : t("emailAuth.signIn")}
        </button>
      </form>

      <button
        type="button"
        className="text-xs font-semibold text-ns-primary hover:underline"
        onClick={() => {
          setMode((m) => (m === "signin" ? "signup" : "signin"));
          setError(null);
        }}
      >
        {mode === "signin" ? t("emailAuth.switchToSignup") : t("emailAuth.switchToSignin")}
      </button>

      <p className="text-xs text-ns-secondary">
        {t("noAccount")}{" "}
        <Link href="/light" className="font-semibold text-ns-primary hover:underline">
          {t("joinWaitlist")}
        </Link>
      </p>
    </div>
  );
}
