function pad(n: number): string {
  return String(n).padStart(2, "0");
}

/** Format Date as UTC ICS timestamp: 20260713T190000Z */
export function toIcsUtc(iso: string): string {
  const d = new Date(iso);
  return (
    `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}` +
    `T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`
  );
}

function foldLine(line: string): string {
  if (line.length <= 70) return line;
  const parts: string[] = [];
  let rest = line;
  while (rest.length > 70) {
    parts.push(rest.slice(0, 70));
    rest = ` ${rest.slice(70)}`;
  }
  parts.push(rest);
  return parts.join("\r\n");
}

function esc(text: string): string {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");
}

/** Native calendar alarms relative to DTSTART (Google / Apple / Outlook). */
function valarmLines(trigger: string, description: string): string[] {
  return [
    "BEGIN:VALARM",
    `TRIGGER:${trigger}`,
    "ACTION:DISPLAY",
    `DESCRIPTION:${esc(description)}`,
    "END:VALARM",
  ];
}

export function buildCalendarInviteIcs(input: {
  uid: string;
  title: string;
  description: string;
  location: string;
  startsAt: string;
  endsAt?: string;
  organizerEmail: string;
  organizerName?: string;
  attendeeEmail: string;
  attendeeName?: string;
  url?: string;
}): string {
  const dtStart = toIcsUtc(input.startsAt);
  const endIso =
    input.endsAt ??
    new Date(new Date(input.startsAt).getTime() + 3 * 60 * 60 * 1000).toISOString();
  const dtEnd = toIcsUtc(endIso);
  const dtStamp = toIcsUtc(new Date().toISOString());
  const org = `CN=${esc(input.organizerName ?? "LA MESA")}:mailto:${input.organizerEmail}`;
  const att = `CN=${esc(input.attendeeName ?? input.attendeeEmail)};RSVP=TRUE;PARTSTAT=NEEDS-ACTION;ROLE=REQ-PARTICIPANT:mailto:${input.attendeeEmail}`;

  const lines = [
    "BEGIN:VCALENDAR",
    "PRODID:-//LA MESA//EN",
    "VERSION:2.0",
    "CALSCALE:GREGORIAN",
    "METHOD:REQUEST",
    "BEGIN:VEVENT",
    `UID:${input.uid}`,
    `DTSTAMP:${dtStamp}`,
    `DTSTART:${dtStart}`,
    `DTEND:${dtEnd}`,
    `SUMMARY:${esc(input.title)}`,
    `DESCRIPTION:${esc(input.description)}`,
    `LOCATION:${esc(input.location)}`,
    `ORGANIZER;${org}`,
    `ATTENDEE;${att}`,
    input.url ? `URL:${input.url}` : null,
    "STATUS:CONFIRMED",
    "SEQUENCE:0",
    // Native reminders — no email cron needed for these
    ...valarmLines("-P7D", "LA MESA — dans 7 jours"),
    ...valarmLines("-PT36H", "LA MESA — dans 36 heures"),
    ...valarmLines("-PT90M", "LA MESA — dans 1h30"),
    "END:VEVENT",
    "END:VCALENDAR",
  ].filter((l): l is string => Boolean(l));

  return `${lines.map(foldLine).join("\r\n")}\r\n`;
}

/**
 * Soft hold for Save the Date / interest YES — METHOD:PUBLISH, no RSVP attendee.
 * Recipients open the .ics (or Google Calendar link) to block the date.
 */
export function buildAddToCalendarIcs(input: {
  uid: string;
  title: string;
  description: string;
  location: string;
  startsAt: string;
  endsAt?: string;
  organizerEmail: string;
  organizerName?: string;
  url?: string;
}): string {
  const dtStart = toIcsUtc(input.startsAt);
  const endIso =
    input.endsAt ??
    new Date(new Date(input.startsAt).getTime() + 3 * 60 * 60 * 1000).toISOString();
  const dtEnd = toIcsUtc(endIso);
  const dtStamp = toIcsUtc(new Date().toISOString());
  const org = `CN=${esc(input.organizerName ?? "LA MESA")}:mailto:${input.organizerEmail}`;

  const lines = [
    "BEGIN:VCALENDAR",
    "PRODID:-//LA MESA//EN",
    "VERSION:2.0",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${input.uid}`,
    `DTSTAMP:${dtStamp}`,
    `DTSTART:${dtStart}`,
    `DTEND:${dtEnd}`,
    `SUMMARY:${esc(input.title)}`,
    `DESCRIPTION:${esc(input.description)}`,
    `LOCATION:${esc(input.location)}`,
    `ORGANIZER;${org}`,
    input.url ? `URL:${input.url}` : null,
    "STATUS:TENTATIVE",
    "SEQUENCE:0",
    ...valarmLines("-P7D", "LA MESA — dans 7 jours"),
    ...valarmLines("-PT36H", "LA MESA — dans 36 heures"),
    ...valarmLines("-PT90M", "LA MESA — dans 1h30"),
    "END:VEVENT",
    "END:VCALENDAR",
  ].filter((l): l is string => Boolean(l));

  return `${lines.map(foldLine).join("\r\n")}\r\n`;
}

/** One-click Google Calendar template URL (dates in UTC). */
export function buildGoogleCalendarUrl(input: {
  title: string;
  description: string;
  location: string;
  startsAt: string;
  endsAt?: string;
}): string {
  const endIso =
    input.endsAt ??
    new Date(new Date(input.startsAt).getTime() + 3 * 60 * 60 * 1000).toISOString();
  const dates = `${toIcsUtc(input.startsAt)}/${toIcsUtc(endIso)}`;
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: input.title,
    dates,
    details: input.description.slice(0, 1800),
    location: input.location,
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

/** Strip authoring markers before putting copy in ICS / Google Calendar. */
export function plainTextFromRichMarkers(text: string): string {
  return text
    .replace(/<\/?bold>/gi, "")
    .replace(/\*\*/g, "")
    .replace(/\r\n/g, "\n")
    .trim();
}
