import { plainTextFromRichMarkers } from "@/lib/email/ics";
import type { AdminEvent } from "@/lib/types/events";

export function interestCalendarTitle(event: AdminEvent): string {
  const custom = event.calendarTitle?.trim();
  if (custom) return custom;
  return `LA MESA | ${event.title.trim()}`;
}

export function interestCalendarDescription(event: AdminEvent): string {
  const intro = event.introText?.trim();
  if (intro) return plainTextFromRichMarkers(intro).slice(0, 1500);
  return plainTextFromRichMarkers(event.title).slice(0, 1500);
}
