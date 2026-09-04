/** Venue + address for email {{where}} / ICS location, without repeating the same line twice. */
export function formatEventWhereLine(
  venueName?: string | null,
  address?: string | null,
): string {
  const venue = venueName?.trim() || "";
  const addr = address?.trim() || "";
  if (!venue) return addr;
  if (!addr) return venue;
  if (venue.toLowerCase() === addr.toLowerCase()) return venue;
  const v = venue.toLowerCase();
  const a = addr.toLowerCase();
  if (v.includes(a) || a.includes(v)) {
    return venue.length >= addr.length ? venue : addr;
  }
  return `${venue} — ${addr}`;
}
