/**
 * Firebase reports failures as machine codes. Showing "auth/invalid-credential"
 * to somebody who mistyped a password is not an error message, so each code a
 * person can actually cause maps to a sentence that says what to do about it.
 *
 * This lives in its own file because two screens need the same map now — the
 * sign-in screen and the password form in Settings — and a copy of it in each
 * is how one of them ends up a code behind.
 */
export const ERROR_KEYS = {
  "auth/invalid-email": "invalidEmail",
  "auth/invalid-credential": "wrongPassword",
  "auth/wrong-password": "wrongPassword",
  "auth/user-not-found": "wrongPassword",
  "auth/email-already-in-use": "emailInUse",
  "auth/weak-password": "weakPassword",
  "auth/too-many-requests": "tooMany",
  "auth/popup-closed-by-user": "popupClosed",
  "auth/cancelled-popup-request": "popupClosed",
  "auth/network-request-failed": "network",
  // Linking a password onto an account, and changing one.
  "auth/requires-recent-login": "requiresRecentLogin",
  "auth/provider-already-linked": "providerAlreadyLinked",
  "auth/credential-already-in-use": "credentialInUse",
  "auth/user-token-expired": "requiresRecentLogin",
  "auth/invalid-user-token": "requiresRecentLogin",
  // Raised when somebody signs in with Google on an address that already has a
  // password, or the other way round, on a project configured to keep them
  // apart. Stepler's is not, but the code is cheap to answer properly.
  "auth/account-exists-with-different-credential": "differentCredential",
  // Ours, not Firebase's.
  "sync/current-password-needed": "currentPasswordNeeded",
};

/** The sentence for a code, falling back to the one that fits anything. */
export function authErrorKey(code) {
  return ERROR_KEYS[code] || "generic";
}
