import { getAuth } from "firebase-admin/auth";
import { getApps } from "firebase-admin/app";
import { getAdminFirestore, isFirebaseAdminConfigured } from "@/lib/firebase/admin";

function getAdminAuth() {
  if (!isFirebaseAdminConfigured()) {
    throw new Error("Firebase Admin is not configured.");
  }
  // Ensure app is initialized via Firestore helpers
  getAdminFirestore();
  return getAuth(getApps()[0]!);
}

export type VerifiedUser = {
  uid: string;
  email: string | null;
};

export async function verifyBearerUser(request: Request): Promise<VerifiedUser | null> {
  const header = request.headers.get("authorization") ?? "";
  const match = /^Bearer\s+(.+)$/i.exec(header);
  if (!match?.[1]) return null;

  try {
    const decoded = await getAdminAuth().verifyIdToken(match[1]);
    return {
      uid: decoded.uid,
      email: typeof decoded.email === "string" ? decoded.email : null,
    };
  } catch {
    return null;
  }
}
