export function isEligibleForTemplateCampaign(
  prospect: { sentTemplateKeys?: string[] },
  templateKey: string,
): boolean {
  const key = templateKey.trim();
  if (!key) return true;
  return !(prospect.sentTemplateKeys ?? []).includes(key);
}
