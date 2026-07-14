import { AdminEmailTemplatesPanel } from "@/components/admin/admin-email-templates";
import { AdminShell } from "@/components/admin/admin-shell";

export default function AdminTemplatesPage() {
  return (
    <AdminShell
      title="LA MESA — Admin"
      navEvents="Dîners"
      navCalendar="Calendrier"
      navRegistrants="Inscrits"
      navTemplates="Templates"
      logoutLabel="Déconnexion"
    >
      <AdminEmailTemplatesPanel />
    </AdminShell>
  );
}
