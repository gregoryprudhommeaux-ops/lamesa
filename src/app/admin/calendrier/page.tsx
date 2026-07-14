import { AdminCalendarPanel } from "@/components/admin/admin-calendar";
import { AdminShell } from "@/components/admin/admin-shell";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Calendrier",
};

export default function AdminCalendrierPage() {
  return (
    <AdminShell title="Calendrier">
      <AdminCalendarPanel title="Calendrier" />
    </AdminShell>
  );
}
