import type { WaitlistRegistration } from "@/lib/types/events";

/** FrancoNetwork provenance: source field and/or import tags. */
export function isFranconetworkMember(
  member: Pick<WaitlistRegistration, "source" | "tags">,
): boolean {
  const source = (member.source ?? "").trim().toLowerCase();
  if (source === "franconetwork") return true;
  const tags = Array.isArray(member.tags) ? member.tags : [];
  return tags.some((t) => String(t).trim().toLowerCase() === "franconetwork");
}
