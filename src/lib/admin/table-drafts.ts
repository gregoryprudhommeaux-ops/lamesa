import { z } from "zod";
import type {
  TableDraft,
  TableDraftMemberSnapshot,
  TableDraftStatus,
} from "@/lib/types/events";

export type TableDraftCreate = Pick<
  TableDraft,
  | "title"
  | "city"
  | "themeAngle"
  | "rationale"
  | "commonalities"
  | "complementarities"
  | "warnings"
  | "primary"
  | "alternates"
>;

export type TableDraftPatch = Partial<
  TableDraftCreate & Pick<TableDraft, "status" | "linkedEventId">
>;

const memberSnapshotSchema: z.ZodType<TableDraftMemberSnapshot> = z
  .object({
    id: z.string().trim().min(1).max(200),
    fullName: z.string().trim().max(200),
    email: z.string().trim().email().max(320),
    company: z.string().trim().max(200),
    sector: z.string().trim().max(200),
    position: z.string().trim().max(200),
    city: z.string().trim().max(100),
  })
  .strict();

const editableFieldsSchema = z
  .object({
    title: z.string().trim().min(3).max(120),
    city: z.string().trim().min(1).max(100),
    themeAngle: z.string().trim().min(3).max(300),
    rationale: z.string().trim().min(10).max(1500),
    commonalities: z.array(z.string().trim().min(2).max(240)).max(8),
    complementarities: z.array(z.string().trim().min(2).max(240)).max(8),
    warnings: z.array(z.string().trim().min(2).max(240)).max(8),
    primary: z.array(memberSnapshotSchema).length(15),
    alternates: z.array(memberSnapshotSchema).max(5),
  })
  .strict();

function hasUniqueMembers(
  value: { primary?: TableDraftMemberSnapshot[]; alternates?: TableDraftMemberSnapshot[] },
): boolean {
  const ids = [
    ...(value.primary ?? []).map((member) => member.id),
    ...(value.alternates ?? []).map((member) => member.id),
  ];
  return new Set(ids).size === ids.length;
}

export const tableDraftCreateSchema: z.ZodType<TableDraftCreate> =
  editableFieldsSchema.refine(hasUniqueMembers, {
    message: "Member ids must be unique across primary and alternates.",
  });

export const tableDraftPatchSchema: z.ZodType<TableDraftPatch> = editableFieldsSchema
  .partial()
  .extend({
    status: z.enum(["draft", "used", "archived"]).optional(),
    linkedEventId: z.string().trim().min(1).max(200).optional(),
  })
  .strict()
  .refine(hasUniqueMembers, {
    message: "Member ids must be unique across primary and alternates.",
  });

export type MergedValidationResult =
  | { ok: true; merged: TableDraft }
  | { ok: false };

export function validateMergedTableDraft(
  current: TableDraft,
  patch: TableDraftPatch,
  rawCurrent: unknown = current,
): MergedValidationResult {
  const merged: TableDraft = {
    ...current,
    ...patch,
    primary: patch.primary ?? current.primary,
    alternates: patch.alternates ?? current.alternates,
    commonalities: patch.commonalities ?? current.commonalities,
    complementarities: patch.complementarities ?? current.complementarities,
    warnings: patch.warnings ?? current.warnings,
    linkedEventId:
      patch.linkedEventId !== undefined ? patch.linkedEventId : current.linkedEventId,
    status: patch.status ?? current.status,
    createdAt: current.createdAt,
    createdByUid: current.createdByUid,
    createdByEmail: current.createdByEmail,
  };

  const isArchiveTransition = patch.status === "archived" && current.status !== "archived";
  if (isArchiveTransition) {
    return { ok: true, merged };
  }

  if (merged.status === "used" && !merged.linkedEventId) {
    return { ok: false };
  }

  const raw = recordOf(rawCurrent);
  const seats = tableDraftCreateSchema.safeParse({
    title: patch.title ?? raw.title,
    city: patch.city ?? raw.city,
    themeAngle: patch.themeAngle ?? raw.themeAngle,
    rationale: patch.rationale ?? raw.rationale,
    commonalities: patch.commonalities ?? raw.commonalities,
    complementarities: patch.complementarities ?? raw.complementarities,
    warnings: patch.warnings ?? raw.warnings,
    primary: patch.primary ?? raw.primary,
    alternates: patch.alternates ?? raw.alternates,
  });

  if (!seats.success) {
    return { ok: false };
  }

  return {
    ok: true,
    merged: {
      ...merged,
      ...seats.data,
    },
  };
}

function recordOf(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object"
    ? (value as Record<string, unknown>)
    : {};
}

function stringValue(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function stringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

function safeIsoString(date: Date): string | undefined {
  if (Number.isNaN(date.getTime())) return undefined;
  try {
    return date.toISOString();
  } catch {
    return undefined;
  }
}

export function timestampValue(value: unknown): string | undefined {
  if (typeof value === "string") return safeIsoString(new Date(value));
  if (value instanceof Date) return safeIsoString(value);

  const record = recordOf(value);
  if (typeof record.toDate !== "function") return undefined;
  try {
    const date = record.toDate();
    return date instanceof Date ? safeIsoString(date) : undefined;
  } catch {
    return undefined;
  }
}

function memberSnapshots(
  value: unknown,
  limit: number,
  excludedIds: Set<string> = new Set(),
): TableDraftMemberSnapshot[] {
  if (!Array.isArray(value)) return [];

  const result: TableDraftMemberSnapshot[] = [];
  const seen = new Set(excludedIds);
  for (const item of value) {
    const record = recordOf(item);
    const id = stringValue(record.id).trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    result.push({
      id,
      fullName: stringValue(record.fullName),
      email: stringValue(record.email),
      company: stringValue(record.company),
      sector: stringValue(record.sector),
      position: stringValue(record.position),
      city: stringValue(record.city),
    });
    if (result.length === limit) break;
  }
  return result;
}

function normalizedStatus(value: unknown, linkedEventId: string | undefined): TableDraftStatus {
  if (value === "archived") return "archived";
  if (value === "used" && linkedEventId) return "used";
  return "draft";
}

export function normalizeTableDraft(id: string, data: unknown): TableDraft {
  const record = recordOf(data);
  const linkedEventId = stringValue(record.linkedEventId).trim() || undefined;
  const primary = memberSnapshots(record.primary, 15);

  return {
    id,
    title: stringValue(record.title),
    city: stringValue(record.city),
    themeAngle: stringValue(record.themeAngle),
    rationale: stringValue(record.rationale),
    commonalities: stringArray(record.commonalities),
    complementarities: stringArray(record.complementarities),
    warnings: stringArray(record.warnings),
    primary,
    alternates: memberSnapshots(
      record.alternates,
      5,
      new Set(primary.map((member) => member.id)),
    ),
    status: normalizedStatus(record.status, linkedEventId),
    linkedEventId,
    createdAt: timestampValue(record.createdAt),
    updatedAt: timestampValue(record.updatedAt),
    createdByUid: stringValue(record.createdByUid),
    createdByEmail: stringValue(record.createdByEmail),
  };
}

export function listNormalizedTableDrafts(
  docs: Array<{ id: string; data: () => unknown }>,
  statusFilter: TableDraftStatus | null,
): TableDraft[] {
  return docs
    .map((document) => normalizeTableDraft(document.id, document.data()))
    .filter((draft) =>
      statusFilter === null ? draft.status !== "archived" : draft.status === statusFilter,
    )
    .sort((left, right) => {
      const leftStamp = left.updatedAt ?? "";
      const rightStamp = right.updatedAt ?? "";
      if (leftStamp !== rightStamp) return rightStamp.localeCompare(leftStamp);
      return left.id.localeCompare(right.id);
    })
    .slice(0, 50);
}

export type TableDraftSummary = {
  id: string;
  title: string;
  city: string;
  primaryCount: number;
  alternateCount: number;
  updatedAt: string;
};

export function listRecentTableDraftSummaries(
  docs: Array<{ id: string; data: () => unknown }>,
  limit = 3,
): TableDraftSummary[] {
  return listNormalizedTableDrafts(docs, null)
    .slice(0, limit)
    .map((draft) => ({
      id: draft.id,
      title: draft.title,
      city: draft.city,
      primaryCount: draft.primary.length,
      alternateCount: draft.alternates.length,
      updatedAt: draft.updatedAt ?? draft.createdAt ?? "",
    }));
}
