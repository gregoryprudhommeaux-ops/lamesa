import { AdminProspectsPanel } from "@/components/admin/admin-prospects";
import { AdminShell } from "@/components/admin/admin-shell";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Prospects",
};

export default function AdminProspectsPage() {
  return (
    <AdminShell title="Prospects" density="workspace">
      <AdminProspectsPanel />
    </AdminShell>
  );
}
