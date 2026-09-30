/** Strip email-client junk / accidental wrapping around survey tokens (client-safe). */
export function normalizeSurveyToken(raw: string): string {
  let token = raw.trim();
  // Some clients wrap links in angle brackets or quotes.
  token = token.replace(/^<|>$/g, "").replace(/^['"]|['"]$/g, "");
  // If still percent-encoded (double-encoded query), decode once.
  if (/%[0-9A-Fa-f]{2}/.test(token)) {
    try {
      token = decodeURIComponent(token);
    } catch {
      // keep as-is
    }
  }
  // Trailing punctuation from copied links.
  token = token.replace(/[),.;]+$/g, "");
  return token.trim();
}
