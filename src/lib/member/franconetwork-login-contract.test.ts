import { describe, expect, it } from "vitest";
import { normalizeEmail } from "@/lib/auth/platform-admin";
import { mapFnProfileToWaitlist } from "@/lib/member/franconetwork-import";

/**
 * Smoke contract: FN import writes waitlist rows keyed by normalized email.
 * Member first visit on /connexion (email+password or Google) → GET /api/me
 * finds the row via findWaitlistByEmail and linkWaitlistUid — profile already filled.
 */
describe("FN → LA MESA first-login contract", () => {
  it("normalizes email the same way Auth/me lookup will", () => {
    const record = mapFnProfileToWaitlist({
      fullName: "Camille Dupont",
      email: "Camille.Dupont@FrancoNetwork.APP",
      companyName: "Dupont SAS",
      city: "Guadalajara",
      whatsapp: "+523312345678",
      networkGoal: "Tables thématiques à Guadalajara",
    });

    expect(record).not.toBeNull();
    expect(record!.email).toBe(normalizeEmail("Camille.Dupont@FrancoNetwork.APP"));
    expect(record!.source).toBe("franconetwork");
    expect(record!.company).toBe("Dupont SAS");
    expect(record!.city).toBe("Guadalajara");
    expect(record!.phone).toBe("+523312345678");
    expect(record!.invitationMotivation.length).toBeGreaterThanOrEqual(10);
    expect(record!.profileComplete).toBe(true);
  });
});
