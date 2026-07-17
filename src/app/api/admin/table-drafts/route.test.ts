import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";

const {
  requirePlatformAdmin,
  isNextResponse,
  isFirebaseAdminConfigured,
  getAdminFirestore,
} = vi.hoisted(() => ({
  requirePlatformAdmin: vi.fn(),
  isNextResponse: vi.fn((value: unknown) => value instanceof NextResponse),
  isFirebaseAdminConfigured: vi.fn(),
  getAdminFirestore: vi.fn(),
}));

vi.mock("@/lib/auth/require-platform-admin.server", () => ({
  requirePlatformAdmin,
  isNextResponse,
}));

vi.mock("@/lib/firebase/admin", () => ({
  COLLECTIONS: { tableDrafts: "table_drafts" },
  isFirebaseAdminConfigured,
  getAdminFirestore,
}));

import { GET, POST } from "./route";

function member(id: string) {
  return {
    id,
    fullName: `Member ${id}`,
    email: `${id}@example.com`,
    company: "LA MESA",
    sector: "Technology",
    position: "Founder",
    city: "Mexico City",
  };
}

function createBody() {
  return {
    title: "Builders and operators",
    city: "Guadalajara",
    themeAngle: "Scaling durable companies",
    rationale: "A balanced group of builders with complementary operating experience.",
    commonalities: ["B2B"],
    complementarities: ["Product and sales"],
    warnings: [],
    primary: Array.from({ length: 15 }, (_, index) => member(`p-${index}`)),
    alternates: [],
  };
}

describe("/api/admin/table-drafts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requirePlatformAdmin.mockResolvedValue({ uid: "admin-1", email: "admin@example.com" });
    isNextResponse.mockImplementation((value: unknown) => value instanceof NextResponse);
    isFirebaseAdminConfigured.mockReturnValue(true);
  });

  it("requires platform admin before accessing Firestore", async () => {
    requirePlatformAdmin.mockResolvedValue(
      NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 }),
    );

    const response = await GET(new Request("http://localhost/api/admin/table-drafts"));

    expect(response.status).toBe(401);
    expect(getAdminFirestore).not.toHaveBeenCalled();
  });

  it("returns 503 not_configured when Firebase Admin is missing", async () => {
    isFirebaseAdminConfigured.mockReturnValue(false);

    const response = await GET(new Request("http://localhost/api/admin/table-drafts"));

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ ok: false, error: "not_configured" });
    expect(getAdminFirestore).not.toHaveBeenCalled();
  });

  it("filters, sorts, and limits in memory without Firestore order/status constraints", async () => {
    const collection = vi.fn();
    const get = vi.fn().mockResolvedValue({
      docs: [
        {
          id: "archived",
          data: () => ({
            ...createBody(),
            status: "archived",
            updatedAt: "2026-07-17T12:00:00.000Z",
          }),
        },
        {
          id: "older",
          data: () => ({
            ...createBody(),
            status: "draft",
            updatedAt: "2026-07-16T12:00:00.000Z",
          }),
        },
        {
          id: "b-same",
          data: () => ({
            ...createBody(),
            status: "draft",
            updatedAt: "2026-07-17T11:00:00.000Z",
          }),
        },
        {
          id: "a-same",
          data: () => ({
            ...createBody(),
            status: "draft",
            updatedAt: "2026-07-17T11:00:00.000Z",
          }),
        },
        {
          id: "legacy-missing",
          data: () => createBody(),
        },
        ...Array.from({ length: 50 }, (_, index) => ({
          id: `extra-${String(index).padStart(2, "0")}`,
          data: () => ({
            ...createBody(),
            status: "draft",
            updatedAt: new Date(Date.UTC(2026, 6, 15, 0, index)).toISOString(),
          }),
        })),
      ],
    });
    collection.mockReturnValue({ get });
    getAdminFirestore.mockReturnValue({ collection });

    const response = await GET(new Request("http://localhost/api/admin/table-drafts"));
    const json = await response.json();

    expect(collection).toHaveBeenCalledWith("table_drafts");
    expect(get).toHaveBeenCalledOnce();
    expect(json.ok).toBe(true);
    expect(json.drafts).toHaveLength(50);
    expect(json.drafts.map((draft: { id: string }) => draft.id)).toEqual([
      "a-same",
      "b-same",
      "older",
      ...Array.from({ length: 47 }, (_, index) => `extra-${String(49 - index).padStart(2, "0")}`),
    ]);
    expect(json.drafts.some((draft: { id: string }) => draft.id === "archived")).toBe(false);
    expect(json.drafts.some((draft: { id: string }) => draft.id === "legacy-missing")).toBe(
      false,
    );
  });

  it("normalizes legacy missing status and updatedAt in list results", async () => {
    const get = vi.fn().mockResolvedValue({
      docs: [
        {
          id: "legacy",
          data: () => createBody(),
        },
      ],
    });
    getAdminFirestore.mockReturnValue({
      collection: vi.fn(() => ({ get })),
    });

    const response = await GET(new Request("http://localhost/api/admin/table-drafts"));
    const json = await response.json();

    expect(json.drafts).toHaveLength(1);
    expect(json.drafts[0]).toEqual(
      expect.objectContaining({
        id: "legacy",
        status: "draft",
      }),
    );
    expect(json.drafts[0]).not.toHaveProperty("updatedAt");
    expect(json.drafts[0]).not.toHaveProperty("linkedEventId");
  });

  it("applies an explicit status filter in memory", async () => {
    const get = vi.fn().mockResolvedValue({
      docs: [
        {
          id: "archived",
          data: () => ({
            ...createBody(),
            status: "archived",
            updatedAt: "2026-07-17T12:00:00.000Z",
          }),
        },
        {
          id: "draft",
          data: () => ({
            ...createBody(),
            status: "draft",
            updatedAt: "2026-07-17T13:00:00.000Z",
          }),
        },
      ],
    });
    getAdminFirestore.mockReturnValue({
      collection: vi.fn(() => ({ get })),
    });

    const response = await GET(
      new Request("http://localhost/api/admin/table-drafts?status=archived"),
    );
    const json = await response.json();

    expect(json.drafts.map((draft: { id: string }) => draft.id)).toEqual(["archived"]);
  });

  it("creates a draft with server-owned status, timestamps, and creator", async () => {
    const add = vi.fn().mockResolvedValue({ id: "draft-1" });
    getAdminFirestore.mockReturnValue({
      collection: vi.fn(() => ({ add })),
    });

    const response = await POST(
      new Request("http://localhost/api/admin/table-drafts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(createBody()),
      }),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true, id: "draft-1" });
    expect(add).toHaveBeenCalledOnce();
    expect(add.mock.calls[0][0]).toEqual(
      expect.objectContaining({
        city: "Guadalajara",
        status: "draft",
        createdByUid: "admin-1",
        createdByEmail: "admin@example.com",
        createdAt: expect.any(String),
        updatedAt: expect.any(String),
      }),
    );
    expect(add.mock.calls[0][0].createdAt).toBe(add.mock.calls[0][0].updatedAt);
  });
});
