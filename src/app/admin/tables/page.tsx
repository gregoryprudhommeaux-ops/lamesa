import { AdminDinnerSubjectsPanel } from "@/components/admin/admin-dinner-subjects";
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
      <div className="space-y-4">
        <AdminDinnerSubjectsPanel />
        <Suspense fallback={<p className="text-sm text-ns-secondary">Chargement…</p>}>
          <AdminTableBuilder />
        </Suspense>
      </div>
    </AdminShell>
  );
}
