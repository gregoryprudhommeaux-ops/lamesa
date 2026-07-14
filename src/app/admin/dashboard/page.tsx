import { AdminDashboardPanel } from "@/components/admin/admin-dashboard";
import { AdminShell } from "@/components/admin/admin-shell";

export default function AdminDashboardPage() {
  return (
    <AdminShell
      title="LA MESA — Admin"
      navEvents="Dîners"
      navCalendar="Calendrier"
      navRegistrants="Inscrits"
      navTemplates="Templates"
      navDashboard="Dashboard"
      logoutLabel="Déconnexion"
    >
      <AdminDashboardPanel />
    </AdminShell>
  );
}
