export function slugify(input: string): string {
  return String(input ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 72);
}

export function eventPublicUrl(baseUrl: string, slug: string, locale = "es"): string {
  const b = baseUrl.replace(/\/+$/, "");
  return `${b}/${locale}/e/${slug}`;
}

export function buildEmailTemplate(
  title: string,
  when: string,
  where: string,
  url: string,
  lang: "fr" | "en" | "es",
): string {
  const hello = lang === "fr" ? "Bonjour," : lang === "en" ? "Hi," : "Hola,";
  const invite =
    lang === "fr"
      ? `Je vous invite à ${title}${when ? ` — ${when}` : ""}${where ? `, ${where}` : ""}.`
      : lang === "en"
        ? `I'd like to invite you to ${title}${when ? ` — ${when}` : ""}${where ? `, ${where}` : ""}.`
        : `Te invito a ${title}${when ? ` — ${when}` : ""}${where ? `, ${where}` : ""}.`;
  const link =
    lang === "fr"
      ? "Détails et confirmation :"
      : lang === "en"
        ? "Details and RSVP:"
        : "Detalles y confirmación:";

  return [hello, "", invite, "", link, url].join("\n");
}

export function buildWhatsappTemplate(
  title: string,
  when: string,
  url: string,
  lang: "fr" | "en" | "es",
): string {
  const intro =
    lang === "fr"
      ? `Invitation LA MESA — ${title}`
      : lang === "en"
        ? `LA MESA invitation — ${title}`
        : `Invitación LA MESA — ${title}`;
  return `${intro}${when ? `\n${when}` : ""}\n${url}`;
}

/** Personalized WhatsApp invite body (keeps {{fullName}} for substitution). */
export function buildWhatsappInviteMessage(input: {
  title: string;
  when: string;
  where?: string;
  url: string;
  lang: "fr" | "en" | "es";
}): string {
  const { title, when, where, url, lang } = input;
  if (lang === "en") {
    return [
      "Hi {{fullName}},",
      "",
      `You're invited to a private LA MESA dinner: ${title}`,
      when ? `When: ${when}` : "",
      where ? `Where: ${where}` : "",
      "",
      "Details & RSVP:",
      url,
    ]
      .filter(Boolean)
      .join("\n");
  }
  if (lang === "es") {
    return [
      "Estimado/a {{fullName}}:",
      "",
      `Te invitamos a la cena privada LA MESA: ${title}`,
      when ? `Fecha y hora: ${when}` : "",
      where ? `Lugar: ${where}` : "",
      "",
      "Consulta los detalles y confirma tu asistencia:",
      url,
    ]
      .filter(Boolean)
      .join("\n");
  }
  return [
    "Bonjour {{fullName}},",
    "",
    `Tu es invité(e) à un dîner privé LA MESA : ${title}`,
    when ? `Quand : ${when}` : "",
    where ? `Où : ${where}` : "",
    "",
    "Détails et confirmation :",
    url,
  ]
    .filter(Boolean)
    .join("\n");
}

/** Digits-only international number for wa.me links, or null if unusable. */
export function toWhatsAppDigits(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 10 || digits.length > 15) return null;
  return digits;
}

export function whatsappShareUrl(message: string, phoneDigits?: string | null): string {
  const text = encodeURIComponent(message);
  if (phoneDigits) return `https://wa.me/${phoneDigits}?text=${text}`;
  return `https://wa.me/?text=${text}`;
}

export function fmtDateTime(iso: string | undefined, lang: "fr" | "en" | "es"): string {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    return d.toLocaleString(lang === "en" ? "en-US" : lang === "es" ? "es-MX" : "fr-FR", {
      year: "numeric",
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}
