export type PhoneCountry = {
  iso: string;
  dialCode: string;
  label: string;
};

/** Indicatifs courants — Guadalajara / réseau international LA MESA */
export const PHONE_COUNTRIES: PhoneCountry[] = [
  { iso: "MX", dialCode: "+52", label: "Mexique" },
  { iso: "US", dialCode: "+1", label: "États-Unis" },
  { iso: "CA", dialCode: "+1", label: "Canada" },
  { iso: "FR", dialCode: "+33", label: "France" },
  { iso: "ES", dialCode: "+34", label: "Espagne" },
  { iso: "GB", dialCode: "+44", label: "Royaume-Uni" },
  { iso: "DE", dialCode: "+49", label: "Allemagne" },
  { iso: "CH", dialCode: "+41", label: "Suisse" },
  { iso: "BE", dialCode: "+32", label: "Belgique" },
  { iso: "IT", dialCode: "+39", label: "Italie" },
  { iso: "PT", dialCode: "+351", label: "Portugal" },
  { iso: "NL", dialCode: "+31", label: "Pays-Bas" },
  { iso: "AR", dialCode: "+54", label: "Argentine" },
  { iso: "CO", dialCode: "+57", label: "Colombie" },
  { iso: "CL", dialCode: "+56", label: "Chili" },
  { iso: "PE", dialCode: "+51", label: "Pérou" },
  { iso: "BR", dialCode: "+55", label: "Brésil" },
  { iso: "AU", dialCode: "+61", label: "Australie" },
  { iso: "JP", dialCode: "+81", label: "Japon" },
  { iso: "CN", dialCode: "+86", label: "Chine" },
];

export function flagEmoji(iso: string): string {
  const code = iso.toUpperCase();
  if (code.length !== 2) return "";
  return String.fromCodePoint(
    ...[...code].map((char) => 127397 + char.charCodeAt(0)),
  );
}

export function defaultDialCodeForLocale(_locale: string): string {
  return "+52";
}

export function buildFullPhone(dialCode: string, national: string): string {
  const codeDigits = dialCode.replace(/\D/g, "");
  const nationalDigits = national.replace(/\D/g, "");
  if (!codeDigits || !nationalDigits) return "";
  return `+${codeDigits}${nationalDigits}`;
}

export function isValidFullPhone(phone: string): boolean {
  const digits = phone.replace(/\D/g, "");
  return digits.length >= 10 && digits.length <= 15;
}
