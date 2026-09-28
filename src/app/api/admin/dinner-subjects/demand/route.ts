import { NextResponse } from "next/server";
import { loadAdminCoreCollections } from "@/lib/admin/load-core-collections";
import {
  isNextResponse,
  requirePlatformAdmin,
} from "@/lib/auth/require-platform-admin.server";
import {
  aggregateSubjectDemand,
  listPendingSubjectValidations,
} from "@/lib/dinner-subjects/demand";
import {
  ensureDefaultDinnerSubjects,
  listDinnerSubjects,
} from "@/lib/dinner-subjects/store";
import { isFirebaseAdminConfigured } from "@/lib/firebase/admin";
import { isSoftDeleted } from "@/lib/member/soft-delete";

/** Demand signals + pending coherence queue for dinner subjects. */
export async function GET(request: Request) {
  const admin = await requirePlatformAdmin(request);
  if (isNextResponse(admin)) return admin;

  if (!isFirebaseAdminConfigured()) {
    return NextResponse.json({
      ok: true,
      demand: [],
      pendingValidations: [],
      dev: true,
    });
  }

  try {
    await ensureDefaultDinnerSubjects();
    const [subjects, core] = await Promise.all([
      listDinnerSubjects({ includeDrafts: true, includeArchived: false }),
      loadAdminCoreCollections(),
    ]);
    const activeMembers = core.waitlist.filter((m) => !isSoftDeleted(m));
    const demand = aggregateSubjectDemand(subjects, activeMembers);
    const pendingValidations = listPendingSubjectValidations(activeMembers);
    return NextResponse.json({ ok: true, demand, pendingValidations });
  } catch (error) {
    console.error("[admin/dinner-subjects/demand GET]", error);
    return NextResponse.json({ ok: false, error: "fetch_failed" }, { status: 502 });
  }
}
