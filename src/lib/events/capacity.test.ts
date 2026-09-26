import { describe, expect, it } from "vitest";
import { isOrganizerParticipation } from "./capacity";

describe("isOrganizerParticipation", () => {
  it("matches isOrganizer flag and platform-admin email", () => {
    expect(
      isOrganizerParticipation({
        email: "guest@x.com",
        isOrganizer: true,
      }),
    ).toBe(true);
    expect(
      isOrganizerParticipation({
        email: "gregory.prudhommeaux@gmail.com",
        isOrganizer: false,
      }),
    ).toBe(true);
  });

  it("matches Gregory by full name when flag/email are missing (legacy Payé row)", () => {
    expect(
      isOrganizerParticipation({
        email: "other@example.com",
        fullName: "Grégory Prudhommeaux",
      }),
    ).toBe(true);
    expect(
      isOrganizerParticipation({
        email: "other@example.com",
        fullName: "Greg Prudhommeaux",
      }),
    ).toBe(true);
  });

  it("matches the LA MESA mailbox and an apostrophe in the name", () => {
    expect(
      isOrganizerParticipation({
        email: "greg@nextstep-services.com",
        fullName: "Greg",
      }),
    ).toBe(true);
    expect(
      isOrganizerParticipation({
        email: "other@example.com",
        fullName: "Gregory Prud'hommeaux",
      }),
    ).toBe(true);
  });

  it("does not treat other guests as organizer", () => {
    expect(
      isOrganizerParticipation({
        email: "sophie@x.com",
        fullName: "Sophie Decobecq",
      }),
    ).toBe(false);
  });
});
