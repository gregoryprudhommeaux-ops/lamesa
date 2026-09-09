import { applyProspectStatusToStdLists } from "@/lib/events/interest-prospect-lists";
import type { Prospect, ProspectStatus } from "@/lib/types/prospects";

import { isStdRelanceTemplateKey } from "@/lib/events/std-outreach-templates";

const TERMINAL_STATUSES = new Set<ProspectStatus>(["won", "do_not_contact"]);

const STD_PENDING_STATUSES = new Set<ProspectStatus>(["to_follow", "no_response"]);

/** Status after a successful template / invite send (unless terminal). */
export function statusAfterOutreachSend(
  current: ProspectStatus | string | undefined,
  preferred: ProspectStatus = "contacted",
): ProspectStatus | null {
  const normalized = String(current ?? "to_contact") as ProspectStatus;
  if (TERMINAL_STATUSES.has(normalized)) return null;
  return preferred;
}

/**
 * STD relance: stay in the pending pool (À suivre / sans réponse), not generic « contacté ».
 */
export function statusAfterStdRelanceSend(
  current: ProspectStatus | string | undefined,
): ProspectStatus | null {
  const normalized = String(current ?? "to_contact") as ProspectStatus;
  if (TERMINAL_STATUSES.has(normalized)) return null;
  if (STD_PENDING_STATUSES.has(normalized)) return normalized;
  return "no_response";
}

export function preferredStatusForOutreachTemplate(
  templateKey: string | undefined,
  current: ProspectStatus | string | undefined,
): ProspectStatus | undefined {
  const key = templateKey?.trim();
  if (!key || !isStdRelanceTemplateKey(key)) return undefined;
  const next = statusAfterStdRelanceSend(current);
  return next ?? undefined;
}

/** Align playlist membership with a new CRM status and optional list removals. */
export function applyOutreachListChanges(
  existingLists: string[] | undefined,
  status: ProspectStatus,
  removeFromLists: string[] = [],
): string[] {
  const removeKeys = new Set(
    removeFromLists.map((name) => name.trim().toLowerCase()).filter(Boolean),
  );
  let next = applyProspectStatusToStdLists(existingLists, status);
  if (removeKeys.size > 0) {
    next = next.filter((name) => !removeKeys.has(name.trim().toLowerCase()));
  }
  return next;
}

export function buildOutreachPatch(input: {
  prospect: Pick<Prospect, "status" | "lists" | "sentTemplateKeys">;
  templateKey?: string;
  preferredStatus?: ProspectStatus;
  removeFromLists?: string[];
  now?: string;
}): Record<string, unknown> | null {
  const now = input.now ?? new Date().toISOString();
  const nextStatus = statusAfterOutreachSend(
    input.prospect.status,
    input.preferredStatus ?? "contacted",
  );
  if (!nextStatus) return null;

  const sentTemplateKeys = Array.isArray(input.prospect.sentTemplateKeys)
    ? input.prospect.sentTemplateKeys.map(String).filter(Boolean)
    : [];
  const templateKey = input.templateKey?.trim();

  return {
    status: nextStatus,
    lastContactedAt: now,
    updatedAt: now,
    lists: applyOutreachListChanges(
      input.prospect.lists,
      nextStatus,
      input.removeFromLists,
    ),
    ...(templateKey
      ? { sentTemplateKeys: [...new Set([...sentTemplateKeys, templateKey])] }
      : {}),
  };
}
