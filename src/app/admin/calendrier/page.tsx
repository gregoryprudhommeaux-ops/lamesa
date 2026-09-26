import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Calendrier",
};

/** Legacy route → Dîners (vue calendrier). */
export default function AdminCalendrierRedirectPage() {
  redirect("/admin/evenements?view=calendrier");
}
