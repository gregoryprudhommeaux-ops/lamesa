import { AdminEmailTemplatesPanel } from "@/components/admin/admin-email-templates";
import { AdminShell } from "@/components/admin/admin-shell";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Coms",
};

export default function AdminComsPage() {
  return (
    <AdminShell title="Coms">
      <AdminEmailTemplatesPanel />
    </AdminShell>
  );
}
