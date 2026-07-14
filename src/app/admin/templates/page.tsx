import { AdminEmailTemplatesPanel } from "@/components/admin/admin-email-templates";
import { AdminShell } from "@/components/admin/admin-shell";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Templates",
};

export default function AdminTemplatesPage() {
  return (
    <AdminShell title="Templates">
      <AdminEmailTemplatesPanel />
    </AdminShell>
  );
}
