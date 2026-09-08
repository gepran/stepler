import { useEffect, useState } from "react";
import {
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  getRedirectResult,
  signInWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
} from "firebase/auth";
import { auth } from "./firebase";
import {
  useT,
  LANGUAGES,
  setLanguage,
  useLanguage,
} from "../renderer/src/lib/i18n";
import SteplerLogo from "../renderer/src/components/SteplerLogo";

/**
 * Firebase reports failures as machine codes. Showing "auth/invalid-credential"
 * to someone who mistyped a password is not an error message, so each code a
 * person can actually cause maps to a sentence that says what to do about it.
 */
const ERROR_KEYS = {
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
};

/**
 * A popup is the nicer flow — it keeps the page and anything typed on it — but
 * Safari, most mobile browsers and anyone running a blocker will refuse to
 * open one. These are the codes that mean "not the popup's fault, try the
 * whole-page redirect instead" rather than "this person cannot sign in".
 */
const POPUP_UNAVAILABLE = new Set([
  "auth/popup-blocked",
  "auth/operation-not-supported-in-this-environment",
  "auth/web-storage-unsupported",
]);

export default function AuthScreen() {
  const t = useT();
  const language = useLanguage();
  const [mode, setMode] = useState("signIn");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const isSignUp = mode === "signUp";

  function report(err) {
    const key = ERROR_KEYS[err?.code] || "generic";
    setError(t(`auth.errors.${key}`));
    // The mapped sentence is for the person; the code is for whoever debugs it.
    console.warn("Sign-in failed:", err?.code, err?.message);
  }

  async function withBusy(run) {
    setBusy(true);
    setError(null);
    try {
      await run();
    } catch (err) {
      report(err);
    } finally {
      setBusy(false);
    }
  }

  const submit = (e) => {
    e.preventDefault();
    if (busy) return;
    withBusy(() =>
      isSignUp
        ? createUserWithEmailAndPassword(auth, email.trim(), password)
        : signInWithEmailAndPassword(auth, email.trim(), password),
    );
  };

  /**
   * The redirect leg finishes on a fresh page load, so a failure there is
   * reported here rather than being lost with the page that started it.
   */
  useEffect(() => {
    getRedirectResult(auth).catch(report);
    // `report` closes over `t`, which is stable for a given language, and this
    // should run once per mount regardless.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const google = () =>
    withBusy(async () => {
      try {
        await signInWithPopup(auth, new GoogleAuthProvider());
      } catch (err) {
        if (!POPUP_UNAVAILABLE.has(err?.code)) throw err;
        // Navigates away; nothing after this line runs on success.
        await signInWithRedirect(auth, new GoogleAuthProvider());
      }
    });

  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-50 px-5 py-10 dark:bg-neutral-950">
      <div className="w-full max-w-[380px]">
        <div className="mb-8 flex flex-col items-center text-center">
          <SteplerLogo size={54} />
          <h1 className="mt-4 text-2xl font-black tracking-tight text-neutral-900 dark:text-neutral-50">
            Stepler
          </h1>
          <p className="mt-1.5 text-[13.5px] leading-relaxed text-neutral-500 dark:text-neutral-400">
            {t("auth.tagline")}
          </p>
        </div>

        <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
          <button
            type="button"
            onClick={google}
            disabled={busy}
            className="flex w-full cursor-pointer items-center justify-center gap-2.5 rounded-xl border border-neutral-200 bg-white px-4 py-2.5 text-sm font-semibold text-neutral-700 shadow-sm transition-all hover:border-neutral-300 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-60 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-200 dark:hover:border-neutral-600"
          >
            <svg width="17" height="17" viewBox="0 0 48 48" aria-hidden="true">
              <path
                fill="#4285F4"
                d="M45.1 24.5c0-1.6-.1-3.1-.4-4.5H24v8.5h11.8c-.5 2.7-2 5-4.4 6.6v5.5h7.1c4.1-3.8 6.6-9.4 6.6-16.1z"
              />
              <path
                fill="#34A853"
                d="M24 46c5.9 0 10.9-2 14.5-5.4l-7.1-5.5c-2 1.3-4.5 2.1-7.4 2.1-5.7 0-10.5-3.8-12.2-9H4.5v5.7C8.1 41.1 15.5 46 24 46z"
              />
              <path
                fill="#FBBC05"
                d="M11.8 28.2c-.4-1.3-.7-2.7-.7-4.2s.3-2.9.7-4.2v-5.7H4.5C2.9 17.2 2 20.5 2 24s.9 6.8 2.5 9.9l7.3-5.7z"
              />
              <path
                fill="#EA4335"
                d="M24 10.8c3.2 0 6.1 1.1 8.4 3.3l6.3-6.3C34.9 4.2 29.9 2 24 2 15.5 2 8.1 6.9 4.5 14.1l7.3 5.7c1.7-5.2 6.5-9 12.2-9z"
              />
            </svg>
            {t("auth.google")}
          </button>

          <div className="my-5 flex items-center gap-3">
            <span className="h-px flex-1 bg-neutral-200 dark:bg-neutral-800" />
            <span className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-600">
              {t("auth.or")}
            </span>
            <span className="h-px flex-1 bg-neutral-200 dark:bg-neutral-800" />
          </div>

          <form onSubmit={submit} className="flex flex-col gap-3">
            <label className="flex flex-col gap-1.5">
              <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
                {t("auth.email")}
              </span>
              <input
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="rounded-xl border border-neutral-200 bg-neutral-50 px-3.5 py-2.5 text-sm text-neutral-900 outline-none transition-colors focus:border-orange-400 focus:bg-white dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100 dark:focus:border-orange-500/60 dark:focus:bg-neutral-800"
              />
            </label>

            <label className="flex flex-col gap-1.5">
              <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
                {t("auth.password")}
              </span>
              <input
                type="password"
                required
                minLength={6}
                autoComplete={isSignUp ? "new-password" : "current-password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="rounded-xl border border-neutral-200 bg-neutral-50 px-3.5 py-2.5 text-sm text-neutral-900 outline-none transition-colors focus:border-orange-400 focus:bg-white dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100 dark:focus:border-orange-500/60 dark:focus:bg-neutral-800"
              />
            </label>

            {error && (
              <p
                role="alert"
                className="rounded-xl bg-red-50 px-3.5 py-2.5 text-[13px] leading-snug text-red-700 dark:bg-red-950/40 dark:text-red-300"
              >
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={busy}
              className="mt-1 cursor-pointer rounded-xl bg-neutral-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-neutral-800 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-60 dark:bg-orange-500 dark:hover:bg-orange-400"
            >
              {busy
                ? t("auth.working")
                : isSignUp
                  ? t("auth.signUp")
                  : t("auth.signIn")}
            </button>
          </form>

          <button
            type="button"
            onClick={() => {
              setMode(isSignUp ? "signIn" : "signUp");
              setError(null);
            }}
            className="mt-4 w-full cursor-pointer text-center text-[13px] text-neutral-500 transition-colors hover:text-orange-500 dark:text-neutral-400"
          >
            {isSignUp ? t("auth.toSignIn") : t("auth.toSignUp")}
          </button>
        </div>

        <div className="mt-6 flex items-center justify-center gap-1">
          {LANGUAGES.map((l) => (
            <button
              key={l.code}
              type="button"
              onClick={() => setLanguage(l.code)}
              className={`cursor-pointer rounded-lg px-2.5 py-1 text-[12px] font-medium transition-colors ${
                language === l.code
                  ? "bg-neutral-200 text-neutral-900 dark:bg-neutral-800 dark:text-neutral-100"
                  : "text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300"
              }`}
            >
              {l.native}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
