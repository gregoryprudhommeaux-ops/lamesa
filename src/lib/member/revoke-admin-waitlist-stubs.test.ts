import { describe, expect, it } from "vitest";
import {
  PLACES_AVAILABLE_AUTO_INSCRIT_KEEP_NAMES,
  softDeleteAdminProvisionedWaitlistStubs,
} from "./revoke-admin-waitlist-stubs";

describe("PLACES_AVAILABLE_AUTO_INSCRIT_KEEP_NAMES", () => {
  it("covers Julian TORRES and Alice MUZELLEC", () => {
    expect(PLACES_AVAILABLE_AUTO_INSCRIT_KEEP_NAMES).toEqual([
      ["julian", "torres"],
      ["alice", "muzellec"],
    ]);
  });
});

describe("softDeleteAdminProvisionedWaitlistStubs", () => {
  it("no-ops when Firebase is not configured", async () => {
    const result = await softDeleteAdminProvisionedWaitlistStubs([
      {
        id: "1",
        fullName: "Auto Stub",
        email: "a@x.com",
        linkedinUrl: "",
        company: "",
        sector: "",
        position: "",
        extraActivities: [],
        city: "",
        phone: "",
        invitationMotivation: "",
        locale: "es",
        tags: ["la-mesa", "waitlist"],
        source: "la-mesa-places-available",
        profileComplete: false,
        createdAt: "",
        updatedAt: "",
      },
    ]);
    expect(result).toEqual({ revoked: 0, kept: 0 });
  });
});
