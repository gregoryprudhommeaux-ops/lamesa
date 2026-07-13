import { LaMesaShell } from "@/components/la-mesa-shell";
import { ProfileRegistrationForm } from "@/components/profile-registration-form";

export default async function InscriptionPage({
  searchParams,
}: {
  searchParams: Promise<{ ref?: string }>;
}) {
  const sp = await searchParams;
  const initialReferralCode = sp.ref?.trim() ?? "";

  return (
    <LaMesaShell card cardClassName="max-w-xl">
      <ProfileRegistrationForm initialReferralCode={initialReferralCode} />
    </LaMesaShell>
  );
}
