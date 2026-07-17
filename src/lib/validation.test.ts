import { describe, expect, it } from "vitest";
import { registrationSchema } from "./validation";

const baseInput = {
  fullName: "Ana García",
  linkedinUrl: "https://linkedin.com/in/ana",
  email: "ana@example.com",
  company: "Mesa Labs",
  sector: "tech",
  position: "founder",
  extraActivities: ["Mentoría"],
  city: "Guadalajara",
  phone: "+521234567890",
  invitationMotivation: "Conocer perfiles complementarios",
  canBring: "Experiencia en producto B2B",
  isSeeking: "Socios de distribución en México",
  locale: "es" as const,
};

describe("registrationSchema canBring/isSeeking boundaries", () => {
  it("accepts a fully valid registration", () => {
    const result = registrationSchema.safeParse(baseInput);
    expect(result.success).toBe(true);
  });

  for (const field of ["canBring", "isSeeking"] as const) {
    describe(field, () => {
      it("trims surrounding whitespace", () => {
        const result = registrationSchema.safeParse({
          ...baseInput,
          [field]: "  padded value  ",
        });
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data[field]).toBe("padded value");
        }
      });

      it("rejects values below the 2-char minimum after trimming", () => {
        const result = registrationSchema.safeParse({
          ...baseInput,
          [field]: " a ",
        });
        expect(result.success).toBe(false);
      });

      it("accepts exactly the 2-char minimum", () => {
        const result = registrationSchema.safeParse({
          ...baseInput,
          [field]: "ab",
        });
        expect(result.success).toBe(true);
      });

      it("accepts exactly the 280-char maximum", () => {
        const result = registrationSchema.safeParse({
          ...baseInput,
          [field]: "x".repeat(280),
        });
        expect(result.success).toBe(true);
      });

      it("rejects values above the 280-char maximum", () => {
        const result = registrationSchema.safeParse({
          ...baseInput,
          [field]: "x".repeat(281),
        });
        expect(result.success).toBe(false);
      });

      it("rejects a missing value", () => {
        const { [field]: _omitted, ...rest } = baseInput;
        const result = registrationSchema.safeParse(rest);
        expect(result.success).toBe(false);
      });
    });
  }
});
