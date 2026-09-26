import { AdminPersonnesWorkspace } from "@/components/admin/admin-personnes-workspace";
import { AdminShell } from "@/components/admin/admin-shell";
import type { Metadata } from "next";
import { Suspense } from "react";

export const metadata: Metadata = {
  title: "Personnes",
};

export default function AdminPersonnesPage() {
  return (
    <AdminShell title="Personnes">
      <Suspense fallback={<p className="text-sm text-ns-secondary">Chargement…</p>}>
        <AdminPersonnesWorkspace />
      </Suspense>
    </AdminShell>
  );
}
