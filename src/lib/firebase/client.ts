"use client";

import { initializeApp, getApps, getApp, type FirebaseApp } from "firebase/app";
import {
  Auth,
  browserLocalPersistence,
  browserPopupRedirectResolver,
  getAuth,
  initializeAuth,
} from "firebase/auth";
import { startGoogleRedirectResult } from "./google-redirect";

let app: FirebaseApp | undefined;
let auth: Auth | undefined;

function getFirebaseConfig() {
  return {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  };
}

export function isFirebaseClientConfigured(): boolean {
  const cfg = getFirebaseConfig();
  return Object.values(cfg).every((v) => String(v ?? "").trim());
}

/** Shared app instance — used by auth and by firestore-client (separate chunk). */
export function getFirebaseApp(): FirebaseApp {
  if (!isFirebaseClientConfigured()) {
    throw new Error("Firebase client is not configured.");
  }
  if (!app) {
    app = getApps().length ? getApp() : initializeApp(getFirebaseConfig());
  }
  return app;
}

export function getClientAuth(): Auth | null {
  if (!isFirebaseClientConfigured()) return null;
  const firebaseApp = getFirebaseApp();
  if (!auth) {
    try {
      auth = initializeAuth(firebaseApp, {
        persistence: browserLocalPersistence,
        popupRedirectResolver: browserPopupRedirectResolver,
      });
    } catch (err) {
      // Only fall back when Auth was already initialized (HMR / duplicate import).
      const code = (err as { code?: string } | null)?.code;
      if (code === "auth/already-initialized") {
        auth = getAuth(firebaseApp);
      } else {
        throw err;
      }
    }
    if (typeof window !== "undefined") {
      void startGoogleRedirectResult(auth);
    }
  }
  return auth;
}
