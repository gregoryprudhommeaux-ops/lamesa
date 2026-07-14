import { AdminCalendarPanel } from "@/components/admin/admin-calendar";
import { AdminShell } from "@/components/admin/admin-shell";

export default function AdminCalendrierPage() {
  return (
    <AdminShell>
      <AdminCalendarPanel title="Calendrier" />
    </AdminShell>
  );
}
