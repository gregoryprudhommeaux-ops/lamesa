import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";

const {
  requirePlatformAdmin,
  isNextResponse,
  isFirebaseAdminConfigured,
  getAdminFirestore,
  composeTableIdeas,
  TableIdeasError,
} = vi.hoisted(() => {
  class TableIdeasError extends Error {
    code: string;
    constructor(code: string, message?: string) {
      super(message ?? code);
      this.name = "TableIdeasError";
      this.code = code;
    }
  }
  return {
    requirePlatformAdmin: vi.fn(),
    isNextResponse: vi.fn((value: unknown) => value instanceof NextResponse),
    isFirebaseAdminConfigured: vi.fn(),
    getAdminFirestore: vi.fn(),
    composeTableIdeas: vi.fn(),
    TableIdeasError,
  };
});

vi.mock("@/lib/auth/require-platform-admin.server", () => ({
  requirePlatformAdmin,
  isNextResponse,
}));

vi.mock("@/lib/firebase/admin", () => ({
  COLLECTIONS: {
    waitlist: "la_mesa_waitlist",
    events: "events",
    participations: "event_participations",
  },
  isFirebaseAdminConfigured,
  getAdminFirestore,
}));

vi.mock("@/lib/admin/table-matching", () => ({
  composeTableIdeas,
  TableIdeasError,
}));

import { POST } from "./route";

function jsonRequest(body: unknown) {
  return new Request("http://localhost/api/admin/table-ideas", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/admin/table-ideas", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requirePlatformAdmin.mockResolvedValue({ uid: "admin", email: "admin@example.com" });
    isFirebaseAdminConfigured.mockReturnValue(true);
    isNextResponse.mockImplementation((value: unknown) => value instanceof NextResponse);
  });

  it("short-circuits when requirePlatformAdmin returns a NextResponse", async () => {
    const unauthorized = NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
    requirePlatformAdmin.mockResolvedValue(unauthorized);

    const response = await POST(jsonRequest({ city: "Mexico City", mode: "spontaneous" }));
    expect(response.status).toBe(401);
    expect(composeTableIdeas).not.toHaveBeenCalled();
    expect(getAdminFirestore).not.toHaveBeenCalled();
  });

  it("returns 400 validation for invalid request bodies", async () => {
    const response = await POST(
      jsonRequest({ city: "Mexico City", mode: "admin_theme" }),
    );
    const json = await response.json();
    expect(response.status).toBe(400);
    expect(json).toEqual({ ok: false, error: "validation" });
    expect(composeTableIdeas).not.toHaveBeenCalled();
  });

  it("maps pool_too_small to 422", async () => {
    getAdminFirestore.mockReturnValue({
      collection: () => ({
        limit: () => ({
          get: async () => ({ docs: [] }),
        }),
      }),
    });
    composeTableIdeas.mockRejectedValue(new TableIdeasError("pool_too_small"));

    const response = await POST(jsonRequest({ city: "Mexico City", mode: "spontaneous" }));
    expect(response.status).toBe(422);
    expect(await response.json()).toEqual({ ok: false, error: "pool_too_small" });
  });

  it("maps ai_not_configured to 503", async () => {
    getAdminFirestore.mockReturnValue({
      collection: () => ({
        limit: () => ({ get: async () => ({ docs: [] }) }),
      }),
    });
    composeTableIdeas.mockRejectedValue(new TableIdeasError("ai_not_configured"));

    const response = await POST(jsonRequest({ city: "Mexico City", mode: "spontaneous" }));
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ ok: false, error: "ai_not_configured" });
  });

  it("maps ai_invalid to 502", async () => {
    getAdminFirestore.mockReturnValue({
      collection: () => ({
        limit: () => ({ get: async () => ({ docs: [] }) }),
      }),
    });
    composeTableIdeas.mockRejectedValue(new TableIdeasError("ai_invalid"));

    const response = await POST(jsonRequest({ city: "Mexico City", mode: "spontaneous" }));
    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({ ok: false, error: "ai_invalid" });
  });

  it("maps fetch_failed to 502", async () => {
    getAdminFirestore.mockReturnValue({
      collection: () => ({
        limit: () => ({ get: async () => ({ docs: [] }) }),
      }),
    });
    composeTableIdeas.mockRejectedValue(new TableIdeasError("fetch_failed", "provider_http_429"));

    const response = await POST(jsonRequest({ city: "Mexico City", mode: "spontaneous" }));
    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({ ok: false, error: "fetch_failed" });
  });

  it("maps unexpected errors to generic 502 fetch_failed", async () => {
    getAdminFirestore.mockReturnValue({
      collection: () => ({
        limit: () => ({ get: async () => ({ docs: [] }) }),
      }),
    });
    composeTableIdeas.mockRejectedValue(new Error("boom"));

    const response = await POST(jsonRequest({ city: "Mexico City", mode: "spontaneous" }));
    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({ ok: false, error: "fetch_failed" });
  });

  it("returns 503 not_configured when Firebase Admin is missing", async () => {
    isFirebaseAdminConfigured.mockReturnValue(false);
    const response = await POST(jsonRequest({ city: "Mexico City", mode: "spontaneous" }));
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ ok: false, error: "not_configured" });
    expect(composeTableIdeas).not.toHaveBeenCalled();
  });
});
