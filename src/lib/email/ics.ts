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
