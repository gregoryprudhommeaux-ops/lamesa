import { LaMesaShell } from "@/components/la-mesa-shell";
import { ProfileRegistrationForm } from "@/components/profile-registration-form";
import { Suspense } from "react";

export default function InscriptionPage() {
  return (
    <LaMesaShell card cardClassName="max-w-xl">
      <Suspense fallback={null}>
        <ProfileRegistrationForm />
      </Suspense>
    </LaMesaShell>
  );
}
