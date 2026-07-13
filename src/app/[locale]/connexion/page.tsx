import { MemberLoginPanel } from "@/components/account/member-login-panel";
import { LaMesaShell } from "@/components/la-mesa-shell";
import { setRequestLocale } from "next-intl/server";

type Props = { params: Promise<{ locale: string }> };

export default async function ConnexionPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <LaMesaShell card cardClassName="max-w-md">
      <MemberLoginPanel />
    </LaMesaShell>
  );
}
