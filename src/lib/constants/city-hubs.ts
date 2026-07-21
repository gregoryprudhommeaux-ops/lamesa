/**
 * Canonical city hubs for registration, matching, and dashboard.
 * ZMG suburbs (Zapopan, Tlaquepaque, …) resolve to Guadalajara.
 */
export const CITY_HUBS = [
  "Guadalajara",
  "Ciudad de México",
  "Monterrey",
  "Puebla",
  "Otro",
] as const;

export type CityHub = (typeof CITY_HUBS)[number];

export const DEFAULT_CITY_HUB: CityHub = "Guadalajara";

/** Strip accents / case for alias lookup. */
export function normalizeCityKey(value: string): string {
  return value
    .trim()
    .toLocaleLowerCase("es-MX")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/\s+/g, " ");
}

const HUB_BY_KEY = new Map<string, CityHub>(
  CITY_HUBS.map((hub) => [normalizeCityKey(hub), hub]),
);

/**
 * Known aliases → hub. Keys must already be normalizeCityKey()'d.
 * Add new suburbs/typos here as they appear.
 */
const CITY_HUB_ALIASES: Record<string, CityHub> = {
  // Guadalajara / ZMG
  gdl: "Guadalajara",
  guadalajara: "Guadalajara",
  guadalajada: "Guadalajara",
  zapopan: "Guadalajara",
  tlaquepaque: "Guadalajara",
  "san pedro tlaquepaque": "Guadalajara",
  tlajomulco: "Guadalajara",
  "tlajomulco de zuniga": "Guadalajara",
  tonala: "Guadalajara",
  "el salto": "Guadalajara",
  "area metropolitana de guadalajara": "Guadalajara",
  "zona metropolitana de guadalajara": "Guadalajara",
  zmg: "Guadalajara",

  // CDMX
  cdmx: "Ciudad de México",
  "mexico city": "Ciudad de México",
  "mexico df": "Ciudad de México",
  df: "Ciudad de México",

  // Monterrey
  mty: "Monterrey",
  "san pedro garza garcia": "Monterrey",
  "san pedro": "Monterrey",

  // Catch-all
  autre: "Otro",
  other: "Otro",
  otra: "Otro",
  others: "Otro",
};

for (const [alias, hub] of Object.entries(CITY_HUB_ALIASES)) {
  HUB_BY_KEY.set(normalizeCityKey(alias), hub);
}

/** Resolve free-text / legacy city to a hub, or null if empty/unknown. */
export function resolveCityHub(value: string | null | undefined): CityHub | null {
  if (value == null) return null;
  const key = normalizeCityKey(value);
  if (!key) return null;
  return HUB_BY_KEY.get(key) ?? null;
}

/** True when both strings map to the same hub (or exact normalized match as fallback). */
export function citiesInSameHub(
  a: string | null | undefined,
  b: string | null | undefined,
): boolean {
  const hubA = resolveCityHub(a);
  const hubB = resolveCityHub(b);
  if (hubA && hubB) return hubA === hubB;
  const keyA = normalizeCityKey(a ?? "");
  const keyB = normalizeCityKey(b ?? "");
  return Boolean(keyA) && keyA === keyB;
}

export function isCityHub(value: string): value is CityHub {
  return (CITY_HUBS as readonly string[]).includes(value);
}
