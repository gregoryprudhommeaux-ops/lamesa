import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Prospects",
};

function firstString(v: string | string[] | undefined): string | undefined {
  if (Array.isArray(v)) return v[0];
  return v;
}

/** Legacy route → Personnes hub (onglet Prospects). */
export default async function AdminProspectsRedirectPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const params = new URLSearchParams();
  params.set("tab", "prospects");
  const list = firstString(sp.list);
  if (list) params.set("list", list);
  redirect(`/admin/personnes?${params.toString()}`);
}
