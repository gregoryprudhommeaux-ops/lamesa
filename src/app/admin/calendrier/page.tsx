import { AdminCalendarPanel } from "@/components/admin/admin-calendar";
import { AdminShell } from "@/components/admin/admin-shell";

export default async function AdminCalendrierPage() {
  const messages = (await import("../../../../messages/fr.json")).default as Record<string, unknown>;
  const admin = (messages.admin ?? {}) as Record<string, unknown>;

  return (
    <AdminShell
      title="LA MESA — Admin"
      navEvents={(admin.eventsTitle as string) ?? "Dîners LA MESA"}
      navCalendar={(admin.calendarTitle as string) ?? "Calendrier"}
      navRegistrants={(admin.registrantsTitle as string) ?? "Inscrits"}
      logoutLabel={(admin.logout as string) ?? "Déconnexion"}
    >
      <AdminCalendarPanel title={(admin.calendarTitle as string) ?? "Calendrier"} />
    </AdminShell>
  );
}
