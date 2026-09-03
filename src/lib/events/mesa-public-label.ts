/** Public calendar label for members who were not invited to this dinner. */

export function formatMesaPublicLabel(mesaNumber: number): string {
  const n = Math.max(1, Math.floor(mesaNumber));
  return `LA MESA ${String(n).padStart(3, "0")}`;
}

/**
 * Resolve display number: explicit `mesaNumber` on the event, else chronological
 * rank among published dinners (by startsAt, then id).
 */
export function resolveMesaNumber(
  event: { id: string; startsAt?: string; mesaNumber?: number | null },
  publishedPool: Array<{ id: string; startsAt?: string; mesaNumber?: number | null }>,
): number {
  if (typeof event.mesaNumber === "number" && Number.isFinite(event.mesaNumber) && event.mesaNumber > 0) {
    return Math.floor(event.mesaNumber);
  }

  const ordered = [...publishedPool].sort((a, b) => {
    const ta = Date.parse(String(a.startsAt ?? "")) || 0;
    const tb = Date.parse(String(b.startsAt ?? "")) || 0;
    if (ta !== tb) return ta - tb;
    return a.id.localeCompare(b.id);
  });

  const idx = ordered.findIndex((e) => e.id === event.id);
  return idx >= 0 ? idx + 1 : 1;
}
