import { AdminDashboardPanel } from "@/components/admin/admin-dashboard";
import { AdminShell } from "@/components/admin/admin-shell";

export default function AdminDashboardPage() {
  return (
    <AdminShell>
      <AdminDashboardPanel />
    </AdminShell>
  );
}
