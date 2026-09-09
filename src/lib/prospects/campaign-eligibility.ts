import { isEligibleForStdPipelineCampaign } from "@/lib/events/std-contact-pipeline";
import type { ProspectStatus } from "@/lib/types/prospects";

/**
 * Template campaign eligibility (Prospects → Email / cold outreach).
 * Rules live in `std-contact-pipeline` (OUI/NON exclusifs, sans réponse relançable, ticket = OUI only).
 */
export function isEligibleForTemplateCampaign(
  prospect: {
    sentTemplateKeys?: string[];
    status?: ProspectStatus;
    lists?: string[];
  },
  templateKey: string,
): boolean {
  return isEligibleForStdPipelineCampaign(prospect, templateKey);
}
