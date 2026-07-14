import { AdminRegistrantsPanel } from "@/components/admin/admin-registrants";
import { AdminShell } from "@/components/admin/admin-shell";

export default function AdminMembresPage() {
  return (
    <AdminShell>
      <AdminRegistrantsPanel title="Membres" />
    </AdminShell>
  );
}
