/** Max length stored on waitlist `opsNotes` (matches API zod). */
export const OPS_NOTES_MAX_LENGTH = 4000;

export type TableCurationAction = "removed_from_primary" | "removed_from_alternate";

/**
 * Format an admin table-builder curation line for opsNotes.
 * These lines feed future AI table scans.
 */
export function formatTableCurationNote(input: {
  comment: string;
  action: TableCurationAction;
  themeTitle?: string;
  at?: Date;
}): string {
  const comment = input.comment.trim().replace(/\s+/g, " ");
  const stamp = (input.at ?? new Date()).toISOString().slice(0, 10);
  const theme = input.themeTitle?.trim().replace(/\s+/g, " ");
  const actionLabel =
    input.action === "removed_from_primary"
      ? "retiré des titulaires"
      : "retiré des remplaçants";
  const themePart = theme ? ` · thème « ${theme} »` : "";
  return `[Table ${stamp} — ${actionLabel}${themePart}] ${comment}`;
}

/** Append a note line, trimming oldest content if over the max length. */
export function appendOpsNotes(
  existing: string | undefined,
  line: string,
  maxLength = OPS_NOTES_MAX_LENGTH,
): string {
  const nextLine = line.trim();
  if (!nextLine) return (existing ?? "").trim();

  const current = (existing ?? "").trim();
  const combined = current ? `${current}\n\n${nextLine}` : nextLine;
  if (combined.length <= maxLength) return combined;

  // Keep the newest content when truncating.
  const overflow = combined.length - maxLength;
  const truncated = combined.slice(overflow);
  const cut = truncated.indexOf("\n\n");
  if (cut >= 0 && cut < truncated.length - 2) {
    return truncated.slice(cut + 2);
  }
  return truncated.slice(0, maxLength);
}
