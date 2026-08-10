import { AdminContactFiche } from "@/components/admin/admin-contact-fiche";
import { AdminShell } from "@/components/admin/admin-shell";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Mémoire contact",
};

export default async function AdminContactPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string }>;
}) {
  const sp = await searchParams;
  const email = String(sp.email ?? "").trim();

  return (
    <AdminShell title="Mémoire contact" density="workspace">
      {!email.includes("@") ? (
        <p className="text-sm text-ns-secondary">
          Ouvre une fiche depuis Prospects ou Membres (paramètre{" "}
          <code className="text-xs">?email=</code>).
        </p>
      ) : (
        <AdminContactFiche email={email} />
      )}
    </AdminShell>
  );
}
