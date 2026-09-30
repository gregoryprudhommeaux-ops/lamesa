/**
 * Named Prospects playlist bound to a table theme idea.
 * Kept ≤60 chars (prospects API list name limit).
 */
export function tableThemeProspectListName(input: {
  theme?: string;
  title?: string;
  city?: string;
}): string {
  const theme = (input.theme?.trim() || input.title?.trim() || "Thème").replace(/\s+/g, " ");
  const city = (input.city?.trim() || "Mesa").replace(/\s+/g, " ");
  const prefix = `Table · ${city} · `;
  const budget = Math.max(12, 60 - prefix.length);
  const clipped =
    theme.length <= budget ? theme : `${theme.slice(0, Math.max(8, budget - 1)).trimEnd()}…`;
  return `${prefix}${clipped}`.slice(0, 60);
}
