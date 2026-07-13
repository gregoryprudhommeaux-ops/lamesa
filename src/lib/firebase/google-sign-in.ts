import {
  GoogleAuthProvider,
  type Auth,
  type UserCredential,
  signInWithPopup,
  signInWithRedirect,
} from "firebase/auth";
import { markGoogleRedirectPending } from "./google-redirect";

function buildGoogleProvider() {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: "select_account" });
  return provider;
}

function isPopupBlockedError(err: unknown): boolean {
  const code = (err as { code?: string })?.code;
  return code === "auth/popup-blocked" || code === "auth/popup-closed-by-user";
}

/**
 * Prefer popup (user-gesture click). Redirect only if the popup is blocked —
 * pure redirect on 127.0.0.1 often stalls when the host isn’t in Authorized domains.
 */
export async function signInWithGoogle(
  auth: Auth,
): Promise<UserCredential | "redirect"> {
  const provider = buildGoogleProvider();

  try {
    return await signInWithPopup(auth, provider);
  } catch (err) {
    if (isPopupBlockedError(err) && (err as { code?: string }).code === "auth/popup-blocked") {
      markGoogleRedirectPending();
      await signInWithRedirect(auth, provider);
      return "redirect";
    }
    throw err;
  }
}
