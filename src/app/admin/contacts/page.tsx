import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Mémoire contact",
};

function firstString(v: string | string[] | undefined): string | undefined {
  if (Array.isArray(v)) return v[0];
  return v;
}

/** Legacy route → Personnes hub (onglet Mémoire). */
export default async function AdminContactRedirectPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const params = new URLSearchParams();
  params.set("tab", "memoire");
  const email = firstString(sp.email);
  if (email) params.set("email", email);
  redirect(`/admin/personnes?${params.toString()}`);
}
