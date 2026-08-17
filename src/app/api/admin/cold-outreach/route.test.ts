import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";

const {
  requirePlatformAdmin,
  isNextResponse,
  isFirebaseAdminConfigured,
  sendColdTemplateEmail,
  upsertProspect,
} = vi.hoisted(() => ({
  requirePlatformAdmin: vi.fn(),
  isNextResponse: vi.fn((value: unknown) => value instanceof NextResponse),
  isFirebaseAdminConfigured: vi.fn(),
  sendColdTemplateEmail: vi.fn(),
  upsertProspect: vi.fn(),
}));

vi.mock("@/lib/auth/require-platform-admin.server", () => ({
  requirePlatformAdmin,
  isNextResponse,
}));

vi.mock("@/lib/firebase/admin", () => ({
  COLLECTIONS: { waitlist: "la_mesa_waitlist" },
  isFirebaseAdminConfigured,
  getAdminFirestore: vi.fn(),
}));

vi.mock("@/lib/email/send-cold-template", () => ({
  sendColdTemplateEmail,
}));

vi.mock("@/lib/email/template-defaults", () => ({
  isCustomEmailTemplateKey: (key: string) => key.startsWith("custom_"),
}));

vi.mock("@/lib/prospects/store", () => ({
  listProspects: vi.fn(),
  markProspectsContacted: vi.fn(),
  upsertProspect,
}));

vi.mock("@/lib/prospects/lists-store", () => ({
  listProspectLists: vi.fn(),
}));

vi.mock("@/lib/prospects/campaign-eligibility", () => ({
  isEligibleForTemplateCampaign: vi.fn(),
}));

import { POST } from "./route";

function jsonRequest(body: unknown) {
  return new Request("http://localhost/api/admin/cold-outreach", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/admin/cold-outreach send_manual", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requirePlatformAdmin.mockResolvedValue({
      uid: "admin",
      email: "admin@example.com",
    });
    isFirebaseAdminConfigured.mockReturnValue(true);
    sendColdTemplateEmail.mockResolvedValue({ ok: true });
  });

  it("sends directly without creating or updating a prospect", async () => {
    const response = await POST(
      jsonRequest({
        action: "send_manual",
        templateKey: "custom_test",
        locale: "fr",
        email: " Test@Example.com ",
        fullName: "Test Person",
      }),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      ok: true,
      sent: 1,
      skipped: 0,
      email: "test@example.com",
    });
    expect(sendColdTemplateEmail).toHaveBeenCalledWith({
      templateKey: "custom_test",
      locale: "fr",
      to: "test@example.com",
      fullName: "Test Person",
    });
    expect(upsertProspect).not.toHaveBeenCalled();
  });

  it("rejects invalid email and non-custom templates", async () => {
    const invalidEmail = await POST(
      jsonRequest({
        action: "send_manual",
        templateKey: "custom_test",
        locale: "fr",
        email: "nope",
      }),
    );
    expect(invalidEmail.status).toBe(400);

    const systemTemplate = await POST(
      jsonRequest({
        action: "send_manual",
        templateKey: "calendar_invite",
        locale: "fr",
        email: "test@example.com",
      }),
    );
    expect(systemTemplate.status).toBe(400);
    expect(await systemTemplate.json()).toEqual({
      ok: false,
      error: "custom_template_required",
    });
  });
});
