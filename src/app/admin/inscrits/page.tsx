import { AdminRegistrantsPanel } from "@/components/admin/admin-registrants";
import { AdminShell } from "@/components/admin/admin-shell";
import type { Metadata } from "next";
import { Suspense } from "react";

export const metadata: Metadata = {
  title: "Membres",
};

export default function AdminMembresPage() {
  return (
    <AdminShell title="Membres">
      <Suspense fallback={<p className="text-sm text-ns-secondary">Chargement…</p>}>
        <AdminRegistrantsPanel title="Membres" />
      </Suspense>
    </AdminShell>
  );
}
