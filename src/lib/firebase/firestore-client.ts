"use client";

import { getFirestore, type Firestore } from "firebase/firestore";
import { getFirebaseApp } from "@/lib/firebase/client";

let db: Firestore | undefined;

/** Lazy Firestore — import only from routes that write/read client-side (not landing/auth). */
export function getClientFirestore(): Firestore {
  if (db) return db;
  const firebaseApp = getFirebaseApp();
  const databaseId = process.env.NEXT_PUBLIC_FIRESTORE_DATABASE_ID?.trim();
  db = databaseId ? getFirestore(firebaseApp, databaseId) : getFirestore(firebaseApp);
  return db;
}
