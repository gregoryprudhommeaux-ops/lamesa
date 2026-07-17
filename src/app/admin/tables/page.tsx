import { AdminShell } from "@/components/admin/admin-shell";
import { AdminTableBuilder } from "@/components/admin/admin-table-builder";
import type { Metadata } from "next";
import { Suspense } from "react";

export const metadata: Metadata = {
  title: "Tables",
};

export default function AdminTablesPage() {
  return (
    <AdminShell title="Tables">
      <Suspense fallback={<p className="text-sm text-ns-secondary">Chargement…</p>}>
        <AdminTableBuilder />
      </Suspense>
    </AdminShell>
  );
}
