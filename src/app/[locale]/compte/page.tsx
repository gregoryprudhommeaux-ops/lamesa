import { MemberAccountPage } from "@/components/account/member-account-page";
import { LaMesaShell } from "@/components/la-mesa-shell";
import { setRequestLocale } from "next-intl/server";

type Props = { params: Promise<{ locale: string }> };

export default async function ComptePage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <LaMesaShell card cardClassName="max-w-2xl">
      <MemberAccountPage />
    </LaMesaShell>
  );
}
