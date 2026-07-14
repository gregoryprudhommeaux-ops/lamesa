import type { AdminEvent } from "@/lib/types/events";
import { eventPublicUrl, fmtDateTime } from "@/lib/events/utils";

type Lang = "fr" | "en" | "es";

const DRESS_LABELS: Record<Lang, Record<string, string>> = {
  fr: {
    casual: "Décontracté",
    smart_casual: "Smart casual",
    business: "Business",
    formal: "Formel",
    traditional: "Traditionnel",
    none_specified: "Non précisé",
  },
  en: {
    casual: "Casual",
    smart_casual: "Smart casual",
    business: "Business",
    formal: "Formal",
    traditional: "Traditional",
    none_specified: "Not specified",
  },
  es: {
    casual: "Informal",
    smart_casual: "Smart casual",
    business: "Formal de negocios",
    formal: "Formal",
    traditional: "Tradicional",
    none_specified: "No especificado",
  },
};

const PARKING_LABELS: Record<Lang, Record<string, string>> = {
  fr: {
    secure_nearby: "Parking sécurisé à proximité",
    valet: "Voiturier",
    on_site: "Sur place",
    unknown: "À confirmer",
  },
  en: {
    secure_nearby: "Secure parking nearby",
    valet: "Valet",
    on_site: "On site",
    unknown: "TBC",
  },
  es: {
    secure_nearby: "Estacionamiento seguro cerca del lugar",
    valet: "Servicio de valet",
    on_site: "En el lugar",
    unknown: "Por confirmar",
  },
};

export type EventInviteTemplate = {
  subject: string;
  body: string;
};

export function buildDefaultEventInviteTemplate(input: {
  event: AdminEvent;
  publicBaseUrl: string;
  lang?: Lang;
}): EventInviteTemplate {
  const lang = input.lang ?? input.event.eventLanguage ?? "fr";
  const event = input.event;
  const when = fmtDateTime(event.startsAt, lang);
  const ends = event.endsAt ? fmtDateTime(event.endsAt, lang) : "";
  const url = eventPublicUrl(input.publicBaseUrl, event.slug, lang);
  const where = [event.venueName, event.address].filter(Boolean).join(" — ");
  const dress =
    event.dressCode && event.dressCode !== "none_specified"
      ? (DRESS_LABELS[lang][event.dressCode] ?? event.dressCode)
      : "";
  const parking =
    event.parking && event.parking !== "unknown"
      ? (PARKING_LABELS[lang][event.parking] ?? event.parking)
      : "";

  const subject =
    lang === "en"
      ? `LA MESA invitation — ${event.title}`
      : lang === "es"
        ? `Invitación LA MESA — ${event.title}`
        : `Invitation LA MESA — ${event.title}`;

  const block =
    lang === "en"
      ? [
          "Hello {{fullName}},",
          "",
          `You are invited to a private LA MESA dinner: ${event.title}.`,
          "",
          when ? `When: ${when}${ends ? ` → ${ends}` : ""}` : null,
          where ? `Where: ${where}` : null,
          dress ? `Dress code: ${dress}` : null,
          parking ? `Parking: ${parking}` : null,
          event.organizerName ? `Host: ${event.organizerName}` : null,
          event.introText?.trim() ? "" : null,
          event.introText?.trim() || null,
          "",
          "All details and RSVP:",
          url,
          event.mapsUrl ? `Maps: ${event.mapsUrl}` : null,
          "",
          "Looking forward to seeing you,",
          "LA MESA",
        ]
      : lang === "es"
        ? [
            "Estimado/a {{fullName}}:",
            "",
            `Te invitamos a la cena privada LA MESA: ${event.title}.`,
            "",
            when ? `Fecha y hora: ${when}${ends ? ` → ${ends}` : ""}` : null,
            where ? `Lugar: ${where}` : null,
            dress ? `Código de vestimenta: ${dress}` : null,
            parking ? `Estacionamiento: ${parking}` : null,
            event.organizerName ? `Anfitrión: ${event.organizerName}` : null,
            event.introText?.trim() ? "" : null,
            event.introText?.trim() || null,
            "",
            "Consulta los detalles y confirma tu asistencia:",
            url,
            event.mapsUrl ? `Mapa: ${event.mapsUrl}` : null,
            "",
            "Quedamos a tus órdenes,",
            "LA MESA",
          ]
        : [
            "Bonjour {{fullName}},",
            "",
            `Tu es invité(e) à un dîner privé LA MESA : ${event.title}.`,
            "",
            when ? `Quand : ${when}${ends ? ` → ${ends}` : ""}` : null,
            where ? `Où : ${where}` : null,
            dress ? `Code vestimentaire : ${dress}` : null,
            parking ? `Parking : ${parking}` : null,
            event.organizerName ? `Hôte : ${event.organizerName}` : null,
            event.introText?.trim() ? "" : null,
            event.introText?.trim() || null,
            "",
            "Tous les détails et confirmation :",
            url,
            event.mapsUrl ? `Plan / Maps : ${event.mapsUrl}` : null,
            "",
            "Au plaisir de te retrouver,",
            "LA MESA",
          ];

  const body = block.filter((l): l is string => l !== null).join("\n");

  return { subject, body };
}

export function applyInviteTemplateVars(
  text: string,
  vars: { fullName: string; email: string; eventUrl: string },
): string {
  return text
    .replaceAll("{{fullName}}", vars.fullName || "ami(e)")
    .replaceAll("{{email}}", vars.email)
    .replaceAll("{{eventUrl}}", vars.eventUrl);
}
