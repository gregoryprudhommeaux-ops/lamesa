import { describe, expect, it } from "vitest";
import {
  applyOutreachListChanges,
  buildOutreachPatch,
  preferredStatusForOutreachTemplate,
  statusAfterOutreachSend,
  statusAfterStdRelanceSend,
} from "@/lib/prospects/outreach-sync";

describe("outreach-sync", () => {
  it("marks non-terminal prospects as contacted", () => {
    expect(statusAfterOutreachSend("to_contact")).toBe("contacted");
    expect(statusAfterOutreachSend("no_response", "no_response")).toBe("no_response");
    expect(statusAfterOutreachSend("won")).toBeNull();
  });

  it("keeps STD relance prospects in the pending pool", () => {
    expect(statusAfterStdRelanceSend("to_follow")).toBe("to_follow");
    expect(statusAfterStdRelanceSend("no_response")).toBe("no_response");
    expect(statusAfterStdRelanceSend("contacted")).toBe("no_response");
    expect(
      preferredStatusForOutreachTemplate(
        "custom_relance_a_suivre_std_24_sept",
        "to_follow",
      ),
    ).toBe("to_follow");
    expect(
      preferredStatusForOutreachTemplate("custom_newsletter", "to_follow"),
    ).toBeUndefined();
  });

  it("clears STD OUI/NON lists and removes source playlist on send", () => {
    const slug = "dirigeants-fr-2026-09-24";
    const lists = [
      `STD ${slug} — SHORTLIST FR`,
      `STD ${slug} — OUI`,
      "Campagne A",
    ];
    const next = applyOutreachListChanges(lists, "contacted", ["Campagne A"]);
    expect(next).toContain(`STD ${slug} — SHORTLIST FR`);
    expect(next).not.toContain(`STD ${slug} — OUI`);
    expect(next).not.toContain("Campagne A");
  });

  it("builds a Firestore patch with template key tracking", () => {
    const patch = buildOutreachPatch({
      prospect: {
        status: "to_contact",
        lists: ["Campagne A"],
        sentTemplateKeys: [],
      },
      templateKey: "custom_test",
      removeFromLists: ["Campagne A"],
      now: "2026-09-09T00:00:00.000Z",
    });
    expect(patch).toMatchObject({
      status: "contacted",
      lastContactedAt: "2026-09-09T00:00:00.000Z",
      sentTemplateKeys: ["custom_test"],
    });
    expect(patch?.lists).not.toContain("Campagne A");
  });
});
