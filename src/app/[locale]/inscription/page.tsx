import { LaMesaShell } from "@/components/la-mesa-shell";
import { ProfileRegistrationForm } from "@/components/profile-registration-form";

export default function InscriptionPage() {
  return (
    <LaMesaShell card cardClassName="max-w-xl">
      <ProfileRegistrationForm />
    </LaMesaShell>
  );
}
