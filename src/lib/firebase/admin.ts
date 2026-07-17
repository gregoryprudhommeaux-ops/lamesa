import { cert, getApps, initializeApp, type App } from "firebase-admin/app";
import { getFirestore, type Firestore } from "firebase-admin/firestore";

let app: App | undefined;
let db: Firestore | undefined;

export function isFirebaseAdminConfigured(): boolean {
  return !!(
    process.env.FIREBASE_PROJECT_ID?.trim() &&
    process.env.FIREBASE_CLIENT_EMAIL?.trim() &&
    process.env.FIREBASE_PRIVATE_KEY?.trim()
  );
}

export function getAdminFirestore(): Firestore {
  if (db) return db;

  if (!isFirebaseAdminConfigured()) {
    throw new Error("Firebase Admin is not configured.");
  }

  if (!getApps().length) {
    app = initializeApp({
      credential: cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
      }),
    });
  }

  const databaseId =
    process.env.FIRESTORE_DATABASE_ID?.trim() ||
    process.env.FIREBASE_FIRESTORE_DATABASE_ID?.trim() ||
    undefined;

  db = databaseId ? getFirestore(app!, databaseId) : getFirestore(app!);
  return db;
}

export const COLLECTIONS = {
  waitlist: "la_mesa_waitlist",
  events: "events",
  participations: "event_participations",
  respondents: "event_respondents",
  emailTemplates: "email_templates",
  tableDrafts: "table_drafts",
} as const;
