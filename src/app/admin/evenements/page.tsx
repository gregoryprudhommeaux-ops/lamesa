import { AdminCalendarPanel } from "@/components/admin/admin-calendar";
import { AdminDinersViewToggle } from "@/components/admin/admin-diners-view-toggle";
import { AdminEventsPanel } from "@/components/admin/admin-events";
import { AdminShell } from "@/components/admin/admin-shell";
import { getSiteUrl } from "@/lib/site-url";
import type { Metadata } from "next";
import { Suspense } from "react";

export const metadata: Metadata = {
  title: "Dîners",
};

function flattenAdminLabels(messages: Record<string, unknown>, prefix = ""): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(messages)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof value === "string") {
      out[path] = value;
    } else if (value && typeof value === "object") {
      Object.assign(out, flattenAdminLabels(value as Record<string, unknown>, path));
    }
  }
  return out;
}

export default async function AdminDinersPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>;
}) {
  const sp = await searchParams;
  const calendarView = sp.view === "calendrier";

  const messages = (await import("../../../../messages/fr.json")).default as Record<string, unknown>;
  const adminMessages = messages.admin as Record<string, unknown>;
  const labels = flattenAdminLabels(adminMessages);
  const publicBaseUrl = getSiteUrl();

  return (
    <AdminShell title="Dîners">
      <Suspense fallback={<p className="text-sm text-ns-secondary">Chargement…</p>}>
        <AdminDinersViewToggle />
        {calendarView ? (
          <AdminCalendarPanel title="Calendrier" />
        ) : (
          <AdminEventsPanel labels={labels} locale="fr" publicBaseUrl={publicBaseUrl} />
        )}
      </Suspense>
    </AdminShell>
  );
}
