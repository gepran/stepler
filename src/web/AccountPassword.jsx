import { useState } from "react";
import PropTypes from "prop-types";
import {
  EmailAuthProvider,
  linkWithCredential,
  reauthenticateWithCredential,
  updatePassword,
} from "firebase/auth";
import { useT } from "../renderer/src/lib/i18n";
import { authErrorKey } from "./auth-errors";

/**
 * Give this account a password, or change the one it has.
 *
 * Firebase keeps one account per email address, so somebody who signed in with
 * Google and then tried to sign up with a password was told the address was
 * already taken — true, and no help at all, because there was nothing they
 * could do with that sentence. This is the way through: put a password on the
 * account that already exists, after which either button signs them in, on the
 * web and in the desktop app alike.
 *
 * The two halves need different calls and fail differently.
 *
 * ADDING one is `linkWithCredential`, and it needs no recent sign-in — so a
 * Google account whose session has been sitting in this browser for weeks can
 * be given a password without signing in again.
 *
 * CHANGING one is `updatePassword`, and it does: the server reads `auth_time`
 * out of the token and refreshing the token does not move it. Sessions here
 * are `browserLocalPersistence`, i.e. weeks old, so that check fails
 * essentially always — the current password is required up front and used to
 * re-authenticate, rather than waiting for a failure to explain.
 *
 * Re-authenticating through Google instead was tried and removed. A popup is
 * blocked in Safari and most mobile browsers, and the redirect that would
 * replace it is a dead end here: the whole page is thrown away, taking the
 * typed password with it, and nothing consumes `getRedirectResult` on the way
 * back — AuthScreen, the only caller, mounts only when nobody is signed in,
 * which is exactly not the case after a re-authentication. Asking for the
 * password the account already has is the honest version.
 *
 * The address is never a field. `linkWithCredential` with a different one
 * quietly makes THAT the account's sign-in address, stranding the person on a
 * login they never chose — so it is always `user.email`, shown and not typed.
 */
export default function AccountPassword({ user }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [current, setCurrent] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [done, setDone] = useState(false);

  // Linking does not change the uid, so `onAuthStateChanged` never fires and
  // nothing re-renders this on its own. The local flag is what moves the
  // button from "Set a password" to "Change password" after a link.
  const [linked, setLinked] = useState(false);
  const hasPassword =
    linked ||
    (user.providerData || []).some((p) => p.providerId === "password");

  const reset = () => {
    setOpen(false);
    setPassword("");
    setCurrent("");
    setError(null);
  };

  async function save() {
    if (busy) return;
    // The address is the account's own and is never typed, so an account
    // without one cannot be given a password — say that, rather than letting
    // the server answer "that email address doesn't look right" about an
    // address nobody entered.
    if (!user.email) {
      setError(t("auth.errors.generic"));
      return;
    }
    setBusy(true);
    setError(null);
    setDone(false);
    try {
      if (hasPassword) {
        await reauthenticateWithCredential(
          user,
          EmailAuthProvider.credential(user.email, current),
        );
        await updatePassword(user, password);
      } else {
        await linkWithCredential(
          user,
          EmailAuthProvider.credential(user.email, password),
        );
        setLinked(true);
      }
      setDone(true);
      reset();
    } catch (err) {
      console.warn("Could not set a password:", err?.code, err?.message);
      setError(t(`auth.errors.${authErrorKey(err?.code)}`));
    } finally {
      setBusy(false);
    }
  }

  const field =
    "w-full rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2 text-[13px] outline-none focus:border-neutral-400 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100";

  if (!open)
    return (
      <>
        <button
          type="button"
          onClick={() => {
            setOpen(true);
            setDone(false);
            setError(null);
          }}
          className="mt-2 w-full cursor-pointer rounded-xl border border-neutral-200 px-3.5 py-2.5 text-[12.5px] font-semibold text-neutral-600 transition-colors hover:bg-neutral-100 dark:border-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-800"
        >
          {hasPassword ? t("auth.changePassword") : t("auth.setPassword")}
        </button>
        {done && (
          <p className="mt-2 text-center text-[12px] text-emerald-600 dark:text-emerald-400">
            {t("auth.passwordSaved")}
          </p>
        )}
      </>
    );

  return (
    <div className="mt-2 space-y-2 rounded-xl border border-neutral-200 p-3.5 dark:border-neutral-800">
      <p className="text-[12px] leading-relaxed text-neutral-500 dark:text-neutral-400">
        {hasPassword
          ? t("auth.changePasswordBlurb")
          : t("auth.setPasswordBlurb", { email: user.email || "" })}
      </p>
      {hasPassword && (
        <input
          type="password"
          autoComplete="current-password"
          value={current}
          onChange={(e) => setCurrent(e.target.value)}
          placeholder={t("auth.currentPassword")}
          className={field}
        />
      )}
      <input
        type="password"
        autoComplete="new-password"
        minLength={6}
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder={t("auth.newPassword")}
        className={field}
      />
      <div className="flex gap-2">
        <button
          type="button"
          disabled={busy || password.length < 6 || (hasPassword && !current)}
          onClick={save}
          className="flex-1 cursor-pointer rounded-xl bg-neutral-900 px-3 py-2 text-[12.5px] font-semibold text-white disabled:opacity-40 dark:bg-neutral-100 dark:text-neutral-900"
        >
          {busy ? t("auth.working") : t("common.save")}
        </button>
        <button
          type="button"
          onClick={reset}
          className="cursor-pointer rounded-xl px-3 py-2 text-[12.5px] font-semibold text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800"
        >
          {t("common.cancel")}
        </button>
      </div>
      {error && (
        <p className="text-[12px] leading-snug text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
    </div>
  );
}

AccountPassword.propTypes = {
  user: PropTypes.shape({
    email: PropTypes.string,
    providerData: PropTypes.array,
  }).isRequired,
};
