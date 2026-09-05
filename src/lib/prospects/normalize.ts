import type { Prospect, ProspectInput, ProspectStatus } from "@/lib/types/prospects";
import { PROSPECT_STATUSES } from "@/lib/types/prospects";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;

export function normalizeProspectEmail(raw: string): string {
  return raw.trim().toLowerCase().replace(/^mailto:/i, "");
}

export function isValidProspectEmail(raw: string): boolean {
  const e = normalizeProspectEmail(raw);
  return Boolean(e && EMAIL_RE.test(e));
}

export function fillEmpty(existing: string, incoming: string | undefined): string {
  const next = (incoming ?? "").trim();
  if (!next) return (existing ?? "").trim();
  if (!(existing ?? "").trim()) return next;
  return existing.trim();
}

export function normalizeProspectStatus(raw: unknown): ProspectStatus {
  const s = String(raw ?? "").trim();
  // Legacy nurture → À suivre (à relancer)
  if (s === "nurture") return "to_follow";
  if ((PROSPECT_STATUSES as readonly string[]).includes(s)) return s as ProspectStatus;
  return "to_contact";
}

function uniqStrings(values: string[]): string[] {
  return [...new Set(values.map((t) => t.trim()).filter(Boolean))];
}

export function prospectFromInput(
  input: ProspectInput,
  opts?: { id?: string; now?: string; existing?: Prospect },
): Prospect | { error: "email_required" } {
  const email = normalizeProspectEmail(input.email ?? "");
  if (!isValidProspectEmail(email)) return { error: "email_required" };

  const now = opts?.now ?? new Date().toISOString();
  const existing = opts?.existing;

  if (existing) {
    const tags = uniqStrings([...(existing.tags ?? []), ...(input.tags ?? [])]);
    const lists = uniqStrings([...(existing.lists ?? []), ...(input.lists ?? [])]);
    return {
      ...existing,
      email,
      fullName: fillEmpty(existing.fullName, input.fullName),
      company: fillEmpty(existing.company, input.company),
      position: fillEmpty(existing.position, input.position),
      sector: fillEmpty(existing.sector, input.sector),
      city: fillEmpty(existing.city, input.city),
      linkedin: fillEmpty(existing.linkedin, input.linkedin),
      phone: fillEmpty(existing.phone, input.phone),
      notes: fillEmpty(existing.notes, input.notes),
      tags,
      lists,
      status: input.status ? normalizeProspectStatus(input.status) : existing.status,
      seen: input.seen !== undefined ? Boolean(input.seen) : existing.seen,
      source: fillEmpty(existing.source, input.source) || existing.source || "manual",
      updatedAt: now,
    };
  }

  return {
    id: opts?.id ?? "",
    email,
    fullName: (input.fullName ?? "").trim(),
    company: (input.company ?? "").trim(),
    position: (input.position ?? "").trim(),
    sector: (input.sector ?? "").trim(),
    city: (input.city ?? "").trim(),
    linkedin: (input.linkedin ?? "").trim(),
    phone: (input.phone ?? "").trim(),
    notes: (input.notes ?? "").trim(),
    tags: uniqStrings(input.tags ?? []),
    lists: uniqStrings(input.lists ?? []),
    status: normalizeProspectStatus(input.status),
    seen: Boolean(input.seen),
    source: (input.source ?? "manual").trim() || "manual",
    createdAt: now,
    updatedAt: now,
    lastContactedAt: null,
    deletedAt: null,
  };
}

const STATUS_RANK: Record<ProspectStatus, number> = {
  to_contact: 0,
  no_response: 1,
  contacted: 2,
  to_follow: 3,
  no_not_available: 4,
  no_not_interested: 5,
  won: 6,
  do_not_contact: 7,
};

export function mergeProspects(a: Prospect, b: Prospect, survivorId: string): Prospect {
  const now = new Date().toISOString();
  const pick = (x: string, y: string) => (x.trim() ? x.trim() : y.trim());
  const status =
    STATUS_RANK[a.status] >= STATUS_RANK[b.status] ? a.status : b.status;
  const tags = uniqStrings([...(a.tags ?? []), ...(b.tags ?? [])]);
  const lists = uniqStrings([...(a.lists ?? []), ...(b.lists ?? [])]);
  const createdAt = [a.createdAt, b.createdAt].filter(Boolean).sort()[0] ?? now;
  const lastContactedAt =
    [a.lastContactedAt, b.lastContactedAt]
      .filter((x): x is string => Boolean(x && String(x).trim()))
      .sort()
      .at(-1) ?? null;

  return {
    id: survivorId,
    email: a.email || b.email,
    fullName: pick(a.fullName, b.fullName),
    company: pick(a.company, b.company),
    position: pick(a.position, b.position),
    sector: pick(a.sector, b.sector),
    city: pick(a.city, b.city),
    linkedin: pick(a.linkedin, b.linkedin),
    phone: pick(a.phone, b.phone),
    notes: [a.notes, b.notes].map((n) => n.trim()).filter(Boolean).join("\n\n"),
    tags,
    lists,
    status,
    seen: Boolean(a.seen || b.seen),
    source: pick(a.source, b.source) || "merge",
    createdAt,
    updatedAt: now,
    lastContactedAt,
    deletedAt: null,
  };
}
