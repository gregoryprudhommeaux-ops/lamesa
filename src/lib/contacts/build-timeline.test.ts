import { describe, expect, it } from "vitest";
import {
  buildContactTimeline,
  deriveContactActivities,
} from "@/lib/contacts/build-timeline";
import type { ContactActivity } from "@/lib/types/contact-activities";
import type { Prospect } from "@/lib/types/prospects";

const prospect = {
  id: "p1",
  email: "ada@example.com",
  fullName: "Ada",
  company: "",
  position: "",
  sector: "",
  city: "",
  linkedin: "",
  phone: "",
  notes: "",
  tags: [],
  lists: [],
  status: "to_contact",
  seen: false,
  source: "manual",
  createdAt: "2026-01-10T10:00:00.000Z",
  updatedAt: "2026-01-10T10:00:00.000Z",
  lastContactedAt: "2026-02-01T12:00:00.000Z",
} as Prospect;

describe("deriveContactActivities", () => {
  it("derives prospect added + cold contact", () => {
    const rows = deriveContactActivities({
      email: "Ada@Example.com",
      waitlist: null,
      prospect,
      participations: [],
      events: [],
    });
    expect(rows.some((r) => r.type === "added_prospect")).toBe(true);
    expect(rows.some((r) => r.type === "email_sent")).toBe(true);
  });
});

describe("buildContactTimeline", () => {
  it("prefers written over derived same type+ref+day", () => {
    const derived: ContactActivity[] = [
      {
        id: "derived:x",
        email: "a@b.com",
        type: "email_sent",
        at: "2026-03-01T10:00:00.000Z",
        source: "admin",
        summary: "Derived",
        refs: { templateKey: "cold" },
        createdAt: "2026-03-01T10:00:00.000Z",
        derived: true,
      },
    ];
    const written: ContactActivity[] = [
      {
        id: "w1",
        email: "a@b.com",
        type: "email_sent",
        at: "2026-03-01T18:00:00.000Z",
        source: "admin",
        summary: "Written cold",
        refs: { templateKey: "cold" },
        createdAt: "2026-03-01T18:00:00.000Z",
      },
    ];
    const timeline = buildContactTimeline({ activities: written, derived });
    expect(timeline).toHaveLength(1);
    expect(timeline[0].summary).toBe("Written cold");
    expect(timeline[0].derived).toBe(false);
  });

  it("sorts by at descending", () => {
    const timeline = buildContactTimeline({
      activities: [
        {
          id: "1",
          email: "a@b.com",
          type: "seen_marked",
          at: "2026-01-01T00:00:00.000Z",
          source: "admin",
          summary: "old",
          createdAt: "2026-01-01T00:00:00.000Z",
        },
        {
          id: "2",
          email: "a@b.com",
          type: "seen_marked",
          at: "2026-06-01T00:00:00.000Z",
          source: "admin",
          summary: "new",
          createdAt: "2026-06-01T00:00:00.000Z",
          refs: { listName: "other" },
        },
      ],
      derived: [],
    });
    expect(timeline[0].summary).toBe("new");
  });
});
