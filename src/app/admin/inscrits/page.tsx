import { AdminRegistrantsPanel } from "@/components/admin/admin-registrants";
import { AdminShell } from "@/components/admin/admin-shell";

export default async function AdminInscritsPage() {
  const messages = (await import("../../../../messages/fr.json")).default as Record<string, unknown>;
  const admin = (messages.admin ?? {}) as Record<string, unknown>;

  return (
    <AdminShell
      title="LA MESA — Admin"
      navEvents={(admin.eventsTitle as string) ?? "Événements"}
      navCalendar={(admin.calendarTitle as string) ?? "Calendrier"}
      navRegistrants={(admin.registrantsTitle as string) ?? "Inscrits"}
      logoutLabel={(admin.logout as string) ?? "Déconnexion"}
    >
      <AdminRegistrantsPanel title={(admin.registrantsTitle as string) ?? "Inscrits"} />
    </AdminShell>
  );
}
