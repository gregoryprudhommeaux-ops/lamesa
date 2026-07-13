import type { Auth, UserCredential } from "firebase/auth";
import { getRedirectResult } from "firebase/auth";

const PENDING_KEY = "la-mesa:google-redirect-pending";

let redirectResultPromise: Promise<UserCredential | null> | null = null;

export function markGoogleRedirectPending(): void {
  if (typeof sessionStorage !== "undefined") {
    sessionStorage.setItem(PENDING_KEY, "1");
  }
}

export function clearGoogleRedirectPending(): void {
  if (typeof sessionStorage !== "undefined") {
    sessionStorage.removeItem(PENDING_KEY);
  }
}

export function isGoogleRedirectPending(): boolean {
  if (typeof sessionStorage === "undefined") return false;
  return sessionStorage.getItem(PENDING_KEY) === "1";
}

export function startGoogleRedirectResult(auth: Auth): Promise<UserCredential | null> {
  if (!redirectResultPromise) {
    redirectResultPromise = getRedirectResult(auth);
  }
  return redirectResultPromise;
}

export function completeGoogleRedirect(auth: Auth): Promise<UserCredential | null> {
  return startGoogleRedirectResult(auth);
}
