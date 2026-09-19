import type { AdminEvent } from "@/lib/types/events";
import { formatMxn } from "@/lib/events/pricing";

type Lang = "fr" | "es" | "en";

function optionalNumber(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) return null;
  return value;
}

/** Labels for ACCESS inclusions (welcome drink / amuse-bouches). */
export function formatAccessIncludes(
  event: Pick<AdminEvent, "accessIncludesWelcomeDrink" | "accessIncludesAmuseBouche">,
  lang: Lang,
): string {
  const parts: string[] = [];
  if (event.accessIncludesWelcomeDrink) {
    parts.push(
      lang === "fr" ? "Welcome drink" : lang === "en" ? "Welcome drink" : "Welcome drink",
    );
  }
  if (event.accessIncludesAmuseBouche) {
    parts.push(
      lang === "fr" ? "Amuse-bouches" : lang === "en" ? "Amuse-bouches" : "Amuse-bouches",
    );
  }
  if (parts.length === 0) {
    return lang === "fr"
      ? "Sans welcome drink ni amuse-bouches"
      : lang === "en"
        ? "No welcome drink or amuse-bouches"
        : "Sin welcome drink ni amuse-bouches";
  }
  return parts.join(" · ");
}

/** Negotiated menu estimate as a short line (min–max or single). */
export function formatMenuPriceEstimate(
  event: Pick<AdminEvent, "menuPriceMinMxn" | "menuPriceMaxMxn">,
  lang: Lang,
): string | null {
  const min = optionalNumber(event.menuPriceMinMxn);
  const max = optionalNumber(event.menuPriceMaxMxn);
  if (min == null && max == null) return null;
  if (min != null && max != null && min !== max) {
    return `${formatMxn(min, lang)} – ${formatMxn(max, lang)}`;
  }
  const single = min ?? max!;
  return formatMxn(single, lang);
}

function drinksLine(
  includes: boolean | null | undefined,
  lang: Lang,
): string | null {
  if (includes === true) {
    return lang === "fr"
      ? "Boissons incluses dans l’estimation"
      : lang === "en"
        ? "Drinks included in the estimate"
        : "Bebidas incluidas en la estimación";
  }
  if (includes === false) {
    return lang === "fr"
      ? "Boissons non incluses (à la charge du participant)"
      : lang === "en"
        ? "Drinks not included (guest pays separately)"
        : "Bebidas no incluidas (a cargo del participante)";
  }
  return null;
}

/**
 * Compose {{menuIncluded}} for emails / public pages from structured menu fields.
 * Falls back to all-in price range, then a short “see event page” hint.
 */
export function formatNegotiatedMenuBlock(
  event: Pick<
    AdminEvent,
    | "menuIncluded"
    | "menuPriceMinMxn"
    | "menuPriceMaxMxn"
    | "menuIncludesDrinks"
    | "allInPriceMinMxn"
    | "allInPriceMaxMxn"
  >,
  lang: Lang,
): string {
  const lines: string[] = [];
  const desc = event.menuIncluded?.trim();
  if (desc) lines.push(desc);

  const estimate = formatMenuPriceEstimate(event, lang);
  if (estimate) {
    const label =
      lang === "fr"
        ? "Estimation menu / personne"
        : lang === "en"
          ? "Menu estimate / person"
          : "Estimación menú / persona";
    lines.push(`${label}: ${estimate}`);
  } else {
    const allIn = formatMenuPriceEstimate(
      {
        menuPriceMinMxn: event.allInPriceMinMxn,
        menuPriceMaxMxn: event.allInPriceMaxMxn,
      },
      lang,
    );
    if (allIn) {
      const label =
        lang === "fr"
          ? "Fourchette (accès + menu) / personne, hors IVA"
          : lang === "en"
            ? "Range (access + menu) / person, before tax"
            : "Rango (acceso + menú) / persona, sin IVA";
      lines.push(`${label}: ${allIn}`);
    }
  }

  const drinks = drinksLine(event.menuIncludesDrinks, lang);
  if (drinks) lines.push(drinks);

  if (lines.length > 0) return lines.join("\n");

  return lang === "fr"
    ? "Détails du menu à confirmer — voir aussi la page de l’événement"
    : lang === "en"
      ? "Menu details to confirm — see also the event page"
      : "Detalles del menú por confirmar — ver también la página del evento";
}

export function hasNegotiatedMenuInfo(
  event: Pick<
    AdminEvent,
    | "menuIncluded"
    | "menuPriceMinMxn"
    | "menuPriceMaxMxn"
    | "menuIncludesDrinks"
    | "allInPriceMinMxn"
    | "allInPriceMaxMxn"
  >,
): boolean {
  if (event.menuIncluded?.trim()) return true;
  if (optionalNumber(event.menuPriceMinMxn) != null) return true;
  if (optionalNumber(event.menuPriceMaxMxn) != null) return true;
  if (optionalNumber(event.allInPriceMinMxn) != null) return true;
  if (optionalNumber(event.allInPriceMaxMxn) != null) return true;
  if (event.menuIncludesDrinks === true || event.menuIncludesDrinks === false) return true;
  return false;
}
