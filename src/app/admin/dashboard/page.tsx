import { AdminDashboardPanel } from "@/components/admin/admin-dashboard";
import { AdminShell } from "@/components/admin/admin-shell";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Dashboard",
};

export default function AdminDashboardPage() {
  return (
    <AdminShell title="Dashboard">
      <AdminDashboardPanel />
    </AdminShell>
  );
}
