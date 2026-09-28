import { NextResponse } from "next/server";
import { listPublishedDinnerSubjectsGrouped } from "@/lib/dinner-subjects/store";
import { isFirebaseAdminConfigured } from "@/lib/firebase/admin";
import { buildDefaultDinnerSubjectSeeds } from "@/lib/dinner-subjects/defaults";
import { subjectTimingBucket } from "@/lib/dinner-subjects/period";
import type { DinnerSubject } from "@/lib/types/events";

/** Public catalog for /themes page (published only — all cities). */
export async function GET() {
  try {
    if (!isFirebaseAdminConfigured()) {
      const now = new Date();
      const seeds = buildDefaultDinnerSubjectSeeds(now);
      const past: DinnerSubject[] = [];
      const upcoming: DinnerSubject[] = [];
      seeds.forEach((seed, index) => {
        const row: DinnerSubject = {
          id: `seed-${index}`,
          ...seed,
          createdAt: now.toISOString(),
          updatedAt: now.toISOString(),
        };
        if (subjectTimingBucket(row.periodMonth, now) === "past") past.push(row);
        else upcoming.push(row);
      });
      return NextResponse.json({ ok: true, past, upcoming, dev: true });
    }

    const { past, upcoming } = await listPublishedDinnerSubjectsGrouped();
    return NextResponse.json({ ok: true, past, upcoming });
  } catch (error) {
    console.error("[dinner-subjects GET]", error);
    return NextResponse.json({ ok: false, error: "fetch_failed" }, { status: 502 });
  }
}
