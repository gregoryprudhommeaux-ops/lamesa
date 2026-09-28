import { NextResponse } from "next/server";
import {
  isDinnerSubjectLocale,
  localizeDinnerSubjectList,
} from "@/lib/dinner-subjects/localize";
import { subjectTimingBucket } from "@/lib/dinner-subjects/period";
import { buildDefaultDinnerSubjectSeeds } from "@/lib/dinner-subjects/defaults";
import {
  backfillSubjectLocale,
  listPublishedDinnerSubjectsGrouped,
} from "@/lib/dinner-subjects/store";
import { isFirebaseAdminConfigured } from "@/lib/firebase/admin";
import type { DinnerSubject, DinnerSubjectLocale } from "@/lib/types/events";

function resolveLocale(request: Request): DinnerSubjectLocale {
  const q = new URL(request.url).searchParams.get("locale")?.trim().toLowerCase() ?? "";
  if (isDinnerSubjectLocale(q)) return q;
  return "fr";
}

/** Public catalog for /themes page (published only — localized via ?locale=). */
export async function GET(request: Request) {
  const locale = resolveLocale(request);
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
      return NextResponse.json({
        ok: true,
        locale,
        past: localizeDinnerSubjectList(past, locale),
        upcoming: localizeDinnerSubjectList(upcoming, locale),
        dev: true,
      });
    }

    const grouped = await listPublishedDinnerSubjectsGrouped();
    const filledPast = await backfillSubjectLocale(grouped.past, locale);
    const filledUpcoming = await backfillSubjectLocale(grouped.upcoming, locale);
    return NextResponse.json({
      ok: true,
      locale,
      past: localizeDinnerSubjectList(filledPast, locale),
      upcoming: localizeDinnerSubjectList(filledUpcoming, locale),
    });
  } catch (error) {
    console.error("[dinner-subjects GET]", error);
    return NextResponse.json({ ok: false, error: "fetch_failed" }, { status: 502 });
  }
}
