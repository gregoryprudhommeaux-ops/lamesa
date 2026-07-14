import { AdminRegistrantsPanel } from "@/components/admin/admin-registrants";
import { AdminShell } from "@/components/admin/admin-shell";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Membres",
};

export default function AdminMembresPage() {
  return (
    <AdminShell title="Membres">
      <AdminRegistrantsPanel title="Membres" />
    </AdminShell>
  );
}
