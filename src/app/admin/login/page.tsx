import { LaMesaShell } from "@/components/la-mesa-shell";
import { AdminGoogleLogin } from "@/components/admin/admin-google-login";
import type { Metadata } from "next";
import { Suspense } from "react";

export const metadata: Metadata = {
  title: "Connexion",
};

export default async function AdminLoginPage() {
  // Admin is FR-only (see admin/layout). Avoid getTranslations() — without a
  // [locale] segment it falls back to defaultLocale "es" and mixes languages.
  const messages = (await import("../../../../messages/fr.json")).default as Record<
    string,
    unknown
  >;
  const admin = (messages.admin ?? {}) as Record<string, unknown>;

  return (
    <LaMesaShell card cardClassName="max-w-md" showLanguageSwitcher={false}>
      <Suspense fallback={<p className="text-sm text-ns-secondary">…</p>}>
        <AdminGoogleLogin
          title={(admin.loginTitle as string) ?? "Organisateur LA MESA"}
          googleLabel={(admin.googleLogin as string) ?? "Continuer avec Google"}
          redirectingLabel={(admin.googleRedirecting as string) ?? "Redirection Google…"}
        />
      </Suspense>
    </LaMesaShell>
  );
}
