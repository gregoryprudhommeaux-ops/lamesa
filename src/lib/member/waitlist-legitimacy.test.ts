import { describe, expect, it } from "vitest";
import {
  isAdminProvisionedWaitlistStub,
  isLegitimateWaitlistMember,
} from "./waitlist-legitimacy";

describe("isAdminProvisionedWaitlistStub", () => {
  it("flags places_available and std-invite stubs", () => {
    expect(
      isAdminProvisionedWaitlistStub({
        source: "la-mesa-places-available",
        profileComplete: false,
      }),
    ).toBe(true);
    expect(
      isAdminProvisionedWaitlistStub({
        source: "la-mesa-std-invite",
        profileComplete: false,
      }),
    ).toBe(true);
  });

  it("stops flagging once profile is complete", () => {
    expect(
      isAdminProvisionedWaitlistStub({
        source: "la-mesa-places-available",
        profileComplete: true,
      }),
    ).toBe(false);
  });

  it("does not flag real signups", () => {
    expect(
      isAdminProvisionedWaitlistStub({
        source: "la-mesa-registration",
        profileComplete: true,
      }),
    ).toBe(false);
    expect(
      isAdminProvisionedWaitlistStub({
        source: "la-mesa-express",
        profileComplete: false,
      }),
    ).toBe(false);
  });
});

describe("isLegitimateWaitlistMember", () => {
  it("excludes soft-deleted and admin stubs", () => {
    expect(
      isLegitimateWaitlistMember({
        source: "la-mesa-registration",
        profileComplete: true,
      }),
    ).toBe(true);
    expect(
      isLegitimateWaitlistMember({
        source: "la-mesa-places-available",
        profileComplete: false,
      }),
    ).toBe(false);
    expect(
      isLegitimateWaitlistMember({
        source: "la-mesa-registration",
        profileComplete: true,
        deletedAt: "2026-09-22T00:00:00.000Z",
      }),
    ).toBe(false);
  });
});
