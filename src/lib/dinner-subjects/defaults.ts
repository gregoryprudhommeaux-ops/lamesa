import { DEFAULT_CITY_HUB } from "@/lib/constants/city-hubs";
import type { DinnerSubject } from "@/lib/types/events";

export type DinnerSubjectSeed = Omit<DinnerSubject, "id" | "createdAt" | "updatedAt">;

/**
 * Bootstrap catalog when Firestore is empty.
 * Periods are relative anchors — admin can edit after seed.
 */
export function buildDefaultDinnerSubjectSeeds(now = new Date()): DinnerSubjectSeed[] {
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth() + 1; // 1-12
  const pad = (n: number) => String(n).padStart(2, "0");
  const monthAt = (offset: number): string => {
    const d = new Date(Date.UTC(y, m - 1 + offset, 1));
    return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}`;
  };

  const city = DEFAULT_CITY_HUB;
  return [
    {
      title: "Private equity & family offices",
      summary: "Capital patient, succession, deals LatAm.",
      periodMonth: monthAt(-2),
      city,
      status: "published",
      keywords: ["private equity", "family office", "PE", "FO", "investissement"],
      sortOrder: 10,
    },
    {
      title: "Scale SaaS B2B / PLG",
      summary: "Go-to-market, product-led growth, opérateurs.",
      periodMonth: monthAt(-1),
      city,
      status: "published",
      keywords: ["saas", "b2b", "plg", "product-led", "scale"],
      sortOrder: 20,
    },
    {
      title: "Fondateurs & cercles de pairs",
      summary: "Pairs dirigeants, solitude du founder, décisions.",
      periodMonth: monthAt(0),
      city,
      status: "published",
      keywords: ["founder", "fondateur", "peers", "dirigeant"],
      sortOrder: 30,
    },
    {
      title: "Impact climate & énergie",
      summary: "Transition, marchés énergie, ops durables.",
      periodMonth: monthAt(1),
      city,
      status: "published",
      keywords: ["climate", "énergie", "impact", "énergie"],
      sortOrder: 40,
    },
    {
      title: "Succession familiale & entreprise",
      summary: "Transmission, gouvernance familiale, next gen.",
      periodMonth: monthAt(2),
      city,
      status: "published",
      keywords: ["succession", "famille", "gouvernance", "family business"],
      sortOrder: 50,
    },
  ];
}
