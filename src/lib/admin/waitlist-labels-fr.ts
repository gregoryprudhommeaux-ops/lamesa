/** French labels for waitlist sector/position codes (admin UI is always FR). */
export const SECTOR_LABELS_FR: Record<string, string> = {
  tech: "Tech & digital",
  finance: "Finance & investissement",
  real_estate: "Immobilier",
  consulting: "Conseil",
  health: "Santé",
  hospitality: "Hôtellerie & restauration",
  legal: "Juridique",
  marketing: "Marketing & communication",
  manufacturing: "Industrie",
  other: "Autre",
};

export const POSITION_LABELS_FR: Record<string, string> = {
  founder: "Fondateur",
  ceo: "CEO / DG",
  director: "Directeur",
  manager: "Manager",
  investor: "Investisseur",
  consultant: "Consultant",
  other: "Autre",
};

/** Hub city display labels for admin (always FR). Stored values stay canonical. */
export const CITY_HUB_LABELS_FR: Record<string, string> = {
  Guadalajara: "Guadalajara (ZMG)",
  "Ciudad de México": "Mexico",
  Monterrey: "Monterrey",
  Puebla: "Puebla",
  Otro: "Autre",
};

export function labelSectorFr(value: string | null | undefined): string {
  const v = value?.trim() ?? "";
  if (!v) return "—";
  return SECTOR_LABELS_FR[v] ?? v;
}

export function labelPositionFr(value: string | null | undefined): string {
  const v = value?.trim() ?? "";
  if (!v) return "—";
  return POSITION_LABELS_FR[v] ?? v;
}

export function labelCityHubFr(value: string | null | undefined): string {
  const v = value?.trim() ?? "";
  if (!v) return "—";
  if (v === "__missing__") return "Non renseigné";
  return CITY_HUB_LABELS_FR[v] ?? v;
}
