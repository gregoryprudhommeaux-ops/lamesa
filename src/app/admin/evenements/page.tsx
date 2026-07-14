import { AdminEventsPanel } from "@/components/admin/admin-events";
import { AdminShell } from "@/components/admin/admin-shell";

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

export default async function AdminEventsPage() {
  const messages = (await import("../../../../messages/fr.json")).default as Record<string, unknown>;
  const adminMessages = messages.admin as Record<string, unknown>;
  const labels = flattenAdminLabels(adminMessages);

  const publicBaseUrl =
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/+$/, "") ?? "http://127.0.0.1:3000";

  return (
    <AdminShell>
      <AdminEventsPanel labels={labels} locale="fr" publicBaseUrl={publicBaseUrl} />
    </AdminShell>
  );
}
