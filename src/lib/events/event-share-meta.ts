import { COLLECTIONS, getAdminFirestore, isFirebaseAdminConfigured } from "@/lib/firebase/admin";
import type { AdminEvent } from "@/lib/types/events";

/** Minimal published event fields for OG / WhatsApp link previews. */
export type PublicEventShareMeta = {
  id: string;
  slug: string;
  title: string;
  startsAt: string;
  shareTitle?: string | null;
  shareDescription?: string | null;
  calendarTitle?: string | null;
  introText?: string | null;
  responseMode?: "rsvp" | "interest";
};

export async function getPublishedEventShareMeta(
  slug: string,
): Promise<PublicEventShareMeta | null> {
  if (!slug.trim() || !isFirebaseAdminConfigured()) return null;
  try {
    const snap = await getAdminFirestore()
      .collection(COLLECTIONS.events)
      .where("slug", "==", slug)
      .where("status", "==", "published")
      .limit(1)
      .get();
    if (snap.empty) return null;
    const doc = snap.docs[0]!;
    const data = doc.data() as Omit<AdminEvent, "id">;
    return {
      id: doc.id,
      slug: String(data.slug ?? slug),
      title: String(data.title ?? ""),
      startsAt: String(data.startsAt ?? ""),
      shareTitle: data.shareTitle ?? null,
      shareDescription: data.shareDescription ?? null,
      calendarTitle: data.calendarTitle ?? null,
      introText: data.introText ?? null,
      responseMode: data.responseMode === "interest" ? "interest" : "rsvp",
    };
  } catch (error) {
    console.error("[getPublishedEventShareMeta]", error);
    return null;
  }
}

function stripRichMarkers(text: string): string {
  return text
    .replace(/<bold>([\s\S]*?)<\/bold>/gi, "$1")
    .replace(/<\/?i>/gi, "")
    .replace(/<a\s+[^>]*>([\s\S]*?)<\/a>/gi, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

function shortDayMonth(iso: string, locale: "fr" | "en" | "es"): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  try {
    return new Intl.DateTimeFormat(locale === "en" ? "en-GB" : locale, {
      day: "numeric",
      month: "short",
      timeZone: "America/Mexico_City",
    }).format(d);
  } catch {
    return "";
  }
}

/**
 * WhatsApp / Open Graph title + description for a public event page.
 * Prefer admin shareTitle / shareDescription when set.
 */
export function buildEventShareMetadata(
  event: PublicEventShareMeta,
  locale: "fr" | "en" | "es",
  siteDescription: string,
): { title: string; description: string } {
  const dateBit = shortDayMonth(event.startsAt, locale);
  const fallbackTitle = dateBit
    ? `LA MESA | ${dateBit} | ${event.title}`
    : `LA MESA | ${event.title}`;

  const title = event.shareTitle?.trim() || event.calendarTitle?.trim() || fallbackTitle;

  if (event.shareDescription?.trim()) {
    return { title, description: event.shareDescription.trim() };
  }

  const introOneLiner = event.introText
    ? stripRichMarkers(event.introText.split(/\n\s*\n/)[0] ?? "").slice(0, 140)
    : "";

  const interestLead =
    locale === "en"
      ? "Save the Date — reply on this page."
      : locale === "es"
        ? "Save the Date — responde en esta página."
        : "Save the Date — réponds sur cette page.";

  const lead =
    event.responseMode === "interest"
      ? interestLead
      : introOneLiner ||
        (locale === "en"
          ? "Private dinner by invitation."
          : locale === "es"
            ? "Cena privada por invitación."
            : "Dîner privé sur invitation.");

  const description = `${lead} ${siteDescription}`.replace(/\s+/g, " ").trim();
  return { title, description };
}
