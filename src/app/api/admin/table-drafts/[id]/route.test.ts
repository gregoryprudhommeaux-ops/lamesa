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

import { DELETE, PATCH } from "./route";

const context = { params: Promise.resolve({ id: "draft-1" }) };

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

function storedDraft(overrides: Record<string, unknown> = {}) {
  return {
    title: "Builders and operators",
    city: "Guadalajara",
    format: "dinner",
    themeAngle: "Scaling durable companies",
    rationale: "A balanced group of builders with complementary operating experience.",
    commonalities: ["B2B"],
    complementarities: ["Product and sales"],
    warnings: [],
    primary: Array.from({ length: 15 }, (_, index) => member(`p-${index}`)),
    alternates: Array.from({ length: 5 }, (_, index) => member(`a-${index}`)),
    status: "draft",
    createdAt: "2026-07-01T00:00:00.000Z",
    updatedAt: "2026-07-01T00:00:00.000Z",
    createdByUid: "creator-1",
    createdByEmail: "creator@example.com",
    ...overrides,
  };
}

function mockDoc(options: {
  exists?: boolean;
  transactionExists?: boolean;
  data?: Record<string, unknown>;
  set?: ReturnType<typeof vi.fn>;
  update?: ReturnType<typeof vi.fn>;
  remove?: ReturnType<typeof vi.fn>;
}) {
  const set = options.set ?? vi.fn().mockResolvedValue(undefined);
  const update = options.update ?? vi.fn();
  const remove = options.remove ?? vi.fn();
  const get = vi.fn().mockResolvedValue({
    exists: options.exists ?? true,
    data: () => options.data ?? storedDraft(),
  });
  const transactionGet = vi.fn().mockResolvedValue({
    exists: options.transactionExists ?? options.exists ?? true,
    data: () => options.data ?? storedDraft(),
  });
  const runTransaction = vi.fn(async (callback) =>
    callback({ get: transactionGet, update }),
  );
  const reference = { get, set, delete: remove };
  getAdminFirestore.mockReturnValue({
    collection: vi.fn(() => ({ doc: vi.fn(() => reference) })),
    runTransaction,
  });
  return { get, set, update, remove, runTransaction, transactionGet, reference };
}

describe("/api/admin/table-drafts/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requirePlatformAdmin.mockResolvedValue({ uid: "admin-1", email: "admin@example.com" });
    isNextResponse.mockImplementation((value: unknown) => value instanceof NextResponse);
    isFirebaseAdminConfigured.mockReturnValue(true);
  });

  it("returns 503 not_configured when Firebase Admin is missing", async () => {
    isFirebaseAdminConfigured.mockReturnValue(false);

    const response = await PATCH(
      new Request("http://localhost/api/admin/table-drafts/draft-1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "Updated table title" }),
      }),
      context,
    );

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ ok: false, error: "not_configured" });
    expect(getAdminFirestore).not.toHaveBeenCalled();
  });

  it("returns 404 when PATCH target is missing and never creates a stub", async () => {
    const { set } = mockDoc({ exists: false });

    const response = await PATCH(
      new Request("http://localhost/api/admin/table-drafts/draft-1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "Updated table title" }),
      }),
      context,
    );

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ ok: false, error: "not_found" });
    expect(set).not.toHaveBeenCalled();
  });

  it("returns 404 when DELETE target is missing and never creates a stub", async () => {
    const { set, remove } = mockDoc({ exists: false });

    const response = await DELETE(
      new Request("http://localhost/api/admin/table-drafts/draft-1", {
        method: "DELETE",
      }),
      context,
    );

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ ok: false, error: "not_found" });
    expect(set).not.toHaveBeenCalled();
    expect(remove).not.toHaveBeenCalled();
  });

  it("timestamps allowed patch fields without replacing creator ownership", async () => {
    const { update, reference } = mockDoc({});

    const response = await PATCH(
      new Request("http://localhost/api/admin/table-drafts/draft-1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "Updated table title" }),
      }),
      context,
    );

    expect(response.status).toBe(200);
    expect(update).toHaveBeenCalledWith(
      reference,
      expect.objectContaining({
        title: "Updated table title",
        primary: expect.any(Array),
        alternates: expect.any(Array),
        updatedAt: expect.any(String),
      }),
    );
    expect(update.mock.calls[0][1]).not.toHaveProperty("createdByUid");
    expect(update.mock.calls[0][1]).not.toHaveProperty("createdByEmail");
    expect(update.mock.calls[0][1]).not.toHaveProperty("createdAt");
  });

  it("persists a top-level city update", async () => {
    const { update, reference } = mockDoc({});

    const response = await PATCH(
      new Request("http://localhost/api/admin/table-drafts/draft-1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ city: "Monterrey" }),
      }),
      context,
    );

    expect(response.status).toBe(200);
    expect(update).toHaveBeenCalledWith(
      reference,
      expect.objectContaining({
        city: "Monterrey",
        updatedAt: expect.any(String),
      }),
    );
  });

  it("marks used when stored linkedEventId exists", async () => {
    const { update, reference } = mockDoc({
      data: storedDraft({ linkedEventId: "event-1" }),
    });

    const response = await PATCH(
      new Request("http://localhost/api/admin/table-drafts/draft-1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "used" }),
      }),
      context,
    );

    expect(response.status).toBe(200);
    expect(update).toHaveBeenCalledWith(
      reference,
      expect.objectContaining({
        status: "used",
        primary: expect.any(Array),
        alternates: expect.any(Array),
        updatedAt: expect.any(String),
      }),
    );
  });

  it("rejects used without a linked event on the merged draft", async () => {
    const { set } = mockDoc({});

    const response = await PATCH(
      new Request("http://localhost/api/admin/table-drafts/draft-1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "used" }),
      }),
      context,
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ ok: false, error: "validation" });
    expect(set).not.toHaveBeenCalled();
  });

  it("rejects a seat edit that overlaps the draft's other group", async () => {
    const { set } = mockDoc({});

    const response = await PATCH(
      new Request("http://localhost/api/admin/table-drafts/draft-1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ alternates: [member("p-0")] }),
      }),
      context,
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ ok: false, error: "validation" });
    expect(set).not.toHaveBeenCalled();
  });

  it("rejects title edits when stored seats are malformed or incomplete", async () => {
    const { set } = mockDoc({
      data: storedDraft({
        primary: [member("only-one")],
        alternates: [],
      }),
    });

    const response = await PATCH(
      new Request("http://localhost/api/admin/table-drafts/draft-1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "Updated table title" }),
      }),
      context,
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ ok: false, error: "validation" });
    expect(set).not.toHaveBeenCalled();
  });

  it("rejects title edits when raw stored primary seats exceed 15", async () => {
    const { set } = mockDoc({
      data: storedDraft({
        primary: Array.from({ length: 16 }, (_, index) => member(`p-${index}`)),
      }),
    });

    const response = await PATCH(
      new Request("http://localhost/api/admin/table-drafts/draft-1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "Updated table title" }),
      }),
      context,
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ ok: false, error: "validation" });
    expect(set).not.toHaveBeenCalled();
  });

  it("persists both validated seat groups when repairing invalid stored seats", async () => {
    const validPrimary = Array.from({ length: 15 }, (_, index) => member(`fixed-${index}`));
    const alternates = [member("alternate-1")];
    const { update, reference } = mockDoc({
      data: storedDraft({
        primary: Array.from({ length: 16 }, (_, index) => member(`p-${index}`)),
        alternates,
      }),
    });

    const response = await PATCH(
      new Request("http://localhost/api/admin/table-drafts/draft-1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ primary: validPrimary }),
      }),
      context,
    );

    expect(response.status).toBe(200);
    expect(update).toHaveBeenCalledWith(
      reference,
      expect.objectContaining({
        primary: validPrimary,
        alternates,
        humanValidatedAt: null,
        updatedAt: expect.any(String),
      }),
    );
  });

  it("validates edits to an already archived draft", async () => {
    const { set } = mockDoc({
      data: storedDraft({
        status: "archived",
        primary: [member("only-one")],
        alternates: [],
      }),
    });

    const response = await PATCH(
      new Request("http://localhost/api/admin/table-drafts/draft-1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "Updated table title" }),
      }),
      context,
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ ok: false, error: "validation" });
    expect(set).not.toHaveBeenCalled();
  });

  it("returns 404 when PATCH target is deleted before the transactional update", async () => {
    const { set, update, runTransaction } = mockDoc({
      exists: true,
      transactionExists: false,
    });

    const response = await PATCH(
      new Request("http://localhost/api/admin/table-drafts/draft-1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "Updated table title" }),
      }),
      context,
    );

    expect(response.status).toBe(404);
    expect(runTransaction).toHaveBeenCalledOnce();
    expect(update).not.toHaveBeenCalled();
    expect(set).not.toHaveBeenCalled();
  });

  it("returns 404 when DELETE target is deleted before the transactional update", async () => {
    const { set, update, runTransaction } = mockDoc({
      exists: true,
      transactionExists: false,
    });

    const response = await DELETE(
      new Request("http://localhost/api/admin/table-drafts/draft-1", {
        method: "DELETE",
      }),
      context,
    );

    expect(response.status).toBe(404);
    expect(runTransaction).toHaveBeenCalledOnce();
    expect(update).not.toHaveBeenCalled();
    expect(set).not.toHaveBeenCalled();
  });

  it("rejects unknown fields", async () => {
    const { set } = mockDoc({});

    const response = await PATCH(
      new Request("http://localhost/api/admin/table-drafts/draft-1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "Updated table title", unexpected: true }),
      }),
      context,
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ ok: false, error: "validation" });
    expect(set).not.toHaveBeenCalled();
  });

  it("archives with a timestamp and never hard-deletes", async () => {
    const { update, reference, remove } = mockDoc({});

    const response = await DELETE(
      new Request("http://localhost/api/admin/table-drafts/draft-1", {
        method: "DELETE",
      }),
      context,
    );

    expect(response.status).toBe(200);
    expect(update).toHaveBeenCalledWith(
      reference,
      { status: "archived", updatedAt: expect.any(String) },
    );
    expect(remove).not.toHaveBeenCalled();
  });
});
