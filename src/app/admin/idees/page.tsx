import { AdminDinnerSubjectsPanel } from "@/components/admin/admin-dinner-subjects";
import { AdminShell } from "@/components/admin/admin-shell";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Idées",
};

/** Étape 1 du parcours création : sujets /themes → Composer → Nouveau dîner. */
export default function AdminIdeesPage() {
  return (
    <AdminShell title="Idées">
      <AdminDinnerSubjectsPanel />
    </AdminShell>
  );
}
