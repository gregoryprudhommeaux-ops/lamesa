/**
 * One-shot import: FrancoNetwork `users` → LA MESA `la_mesa_waitlist`.
 * New creates/revives trigger the ES `fn_announcement` email (skip if already sent).
 *
 * Usage (from la-mesa root, with .env.local loaded):
 *   npx tsx --env-file=.env.local scripts/import-franconetwork-waitlist.ts
 *   npx tsx --env-file=.env.local scripts/import-franconetwork-waitlist.ts --apply
 *
 * Required env (LA MESA write):
 *   FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY
 *   FIRESTORE_DATABASE_ID (optional named DB)
 *
 * Required env (FN read):
 *   FN_FIREBASE_PROJECT_ID, FN_FIREBASE_CLIENT_EMAIL, FN_FIREBASE_PRIVATE_KEY
 *   FN_FIRESTORE_DATABASE_ID (default: ai-studio-b6e23c83-eceb-4cf9-848f-8e11b8db6eb8)
 */

import { cert, getApps, initializeApp, type App } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import {
  isFranconetworkDirectoryVisible,
  mapFnProfileToWaitlist,
  upsertFranconetworkWaitlistMember,
  type FranconetworkProfileInput,
} from "../src/lib/member/franconetwork-import";

const DEFAULT_FN_DB = "ai-studio-b6e23c83-eceb-4cf9-848f-8e11b8db6eb8";

function requiredEnv(name: string): string {
  const v = process.env[name]?.trim();
  if (!v) throw new Error(`Missing env ${name}`);
  return v;
}

function initFnApp(): App {
  const existing = getApps().find((a) => a.name === "franconetwork");
  if (existing) return existing;
  return initializeApp(
    {
      credential: cert({
        projectId: requiredEnv("FN_FIREBASE_PROJECT_ID"),
        clientEmail: requiredEnv("FN_FIREBASE_CLIENT_EMAIL"),
        privateKey: requiredEnv("FN_FIREBASE_PRIVATE_KEY").replace(/\\n/g, "\n"),
      }),
    },
    "franconetwork",
  );
}

function toInput(data: Record<string, unknown>): FranconetworkProfileInput {
  const str = (key: string) =>
    typeof data[key] === "string" ? (data[key] as string) : null;
  return {
    fullName: str("fullName"),
    email: str("email"),
    whatsapp: str("whatsapp"),
    companyName: str("companyName"),
    activityCategory: str("activityCategory"),
    positionCategory: str("positionCategory"),
    city: str("city"),
    linkedin: str("linkedin"),
    networkGoal: str("networkGoal"),
    memberBio: str("memberBio"),
    helpNewcomers: str("helpNewcomers"),
    bio: str("bio"),
    communicationLanguage: str("communicationLanguage"),
    isValidated: typeof data.isValidated === "boolean" ? data.isValidated : null,
  };
}

async function main() {
  const apply = process.argv.includes("--apply");
  const mode = apply ? "APPLY" : "DRY-RUN";

  console.log(`[franconetwork-import] mode=${mode}`);

  const fnApp = initFnApp();
  const fnDbId = process.env.FN_FIRESTORE_DATABASE_ID?.trim() || DEFAULT_FN_DB;
  const fnDb = getFirestore(fnApp, fnDbId);
  const snap = await fnDb.collection("users").get();

  const counts = {
    scanned: 0,
    wouldCreate: 0,
    created: 0,
    revived: 0,
    skippedActive: 0,
    skippedStub: 0,
    skippedNotValidated: 0,
    incomplete: 0,
    errors: 0,
  };

  for (const doc of snap.docs) {
    counts.scanned += 1;
    const input = toInput(doc.data() as Record<string, unknown>);

    if (!isFranconetworkDirectoryVisible(input)) {
      counts.skippedNotValidated += 1;
      console.log(
        `  skip not_validated  ${doc.id}  email=${input.email ?? "—"} name=${input.fullName ?? "—"}`,
      );
      continue;
    }

    const mapped = mapFnProfileToWaitlist(input);

    if (!mapped) {
      counts.skippedStub += 1;
      console.log(`  skip stub  ${doc.id}  email=${input.email ?? "—"} name=${input.fullName ?? "—"}`);
      continue;
    }

    if (!mapped.profileComplete) counts.incomplete += 1;

    if (!apply) {
      counts.wouldCreate += 1;
      console.log(
        `  dry  ${mapped.email}  complete=${mapped.profileComplete}  ${mapped.fullName}`,
      );
      continue;
    }

    const result = await upsertFranconetworkWaitlistMember(input);
    if (result.status === "created") {
      counts.created += 1;
      console.log(`  created  ${mapped.email}  id=${result.id}`);
    } else if (result.status === "revived") {
      counts.revived += 1;
      console.log(`  revived  ${mapped.email}  id=${result.id}`);
    } else if (result.status === "skipped") {
      if (result.reason === "already_active") counts.skippedActive += 1;
      else if (result.reason === "not_validated") counts.skippedNotValidated += 1;
      else counts.skippedStub += 1;
      console.log(`  skip ${result.reason}  ${mapped.email}`);
    } else {
      counts.errors += 1;
      console.error(`  error  ${mapped.email}  ${result.error}`);
    }
  }

  console.log("[franconetwork-import] done", counts);
  if (!apply) {
    console.log("Re-run with --apply to write into la_mesa_waitlist.");
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
