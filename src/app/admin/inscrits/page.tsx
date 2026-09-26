import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Membres",
};

function firstString(v: string | string[] | undefined): string | undefined {
  if (Array.isArray(v)) return v[0];
  return v;
}

/** Legacy route → Personnes hub (onglet Membres). */
export default async function AdminMembresRedirectPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const params = new URLSearchParams();
  params.set("tab", "membres");
  for (const key of ["id", "profile", "source", "queue"] as const) {
    const val = firstString(sp[key]);
    if (val) params.set(key, val);
  }
  redirect(`/admin/personnes?${params.toString()}`);
}
