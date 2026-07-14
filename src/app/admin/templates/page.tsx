import { AdminEmailTemplatesPanel } from "@/components/admin/admin-email-templates";
import { AdminShell } from "@/components/admin/admin-shell";

export default function AdminTemplatesPage() {
  return (
    <AdminShell>
      <AdminEmailTemplatesPanel />
    </AdminShell>
  );
}
