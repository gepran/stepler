#!/usr/bin/env node

/**
 * Take the email address out of every public profile, once.
 *
 * `allow read` on /profiles covers `list`, so anything stored there can be
 * paged out of the collection wholesale by any signed-in account. The client
 * stopped writing the address and clears it on the owner's next sign-in — but
 * only they may write their own profile, so every account that has not signed
 * in since is still carrying one. This is the pass that does the rest.
 *
 * It moves rather than deletes: the address is written to /emails first, keyed
 * by the address itself, which is the collection the search now reads. `get` is
 * allowed there and `list` is denied, so an address you were given can still be
 * looked up while the collection cannot be walked. Nobody loses the ability to
 * be found by email in the meantime.
 *
 * Runs as you, through application-default credentials, and needs no service
 * account file:
 *
 *     gcloud auth application-default login
 *     node scripts/backfill-profile-emails.mjs            # dry run, writes nothing
 *     node scripts/backfill-profile-emails.mjs --apply    # for real
 *
 * Safe to run twice: a profile with no address is skipped, and an /emails entry
 * that already points at the right account is left alone.
 */

import { google } from "googleapis";

const PROJECT = process.env.STEPLER_PROJECT || "stepler-490308";
const APPLY = process.argv.includes("--apply");
const ROOT = `projects/${PROJECT}/databases/(default)/documents`;

// Testing only. Set to a Firestore emulator's host:port to run this against a
// throwaway database instead of the real one; the emulator checks no
// credentials, so the auth client is stood down when it is set.
const EMULATOR = process.env.STEPLER_FIRESTORE_HOST || "";

/** The document id an address is filed under — the same rule the client uses. */
function emailKey(address) {
  const clean = String(address || "")
    .trim()
    .toLowerCase();
  if (!clean || clean.length > 400) return "";
  if (clean.includes("/") || clean.startsWith("__")) return "";
  if (clean === "." || clean === "..") return "";
  return clean;
}

/**
 * Addresses are the thing this script exists to stop leaking, so it does not
 * print them either. Enough is kept to recognise a row you are looking for.
 */
function mask(address) {
  const at = String(address).lastIndexOf("@");
  if (at < 1) return "***";
  return `${address[0]}***${address.slice(at)}`;
}
const str = (f) =>
  f && typeof f.stringValue === "string" ? f.stringValue : "";

async function main() {
  let auth;
  if (EMULATOR) {
    // The emulator applies the security rules to REST calls too, and reads the
    // bearer token "owner" as full administrative access.
    auth = new google.auth.OAuth2();
    auth.setCredentials({ access_token: "owner" });
  } else {
    auth = new google.auth.GoogleAuth({
      scopes: ["https://www.googleapis.com/auth/datastore"],
    });
  }
  const db = google.firestore({
    version: "v1",
    auth,
    ...(EMULATOR ? { rootUrl: `http://${EMULATOR}/` } : {}),
  });
  const docs = db.projects.databases.documents;

  console.log(
    `project ${PROJECT}${EMULATOR ? ` (emulator at ${EMULATOR})` : ""}`,
  );
  console.log(
    APPLY ? "MODE: applying changes\n" : "MODE: dry run, nothing is written\n",
  );

  let pageToken;
  let scanned = 0,
    carrying = 0,
    moved = 0,
    cleared = 0,
    skipped = 0,
    failed = 0;

  do {
    const { data } = await docs.list({
      parent: ROOT,
      collectionId: "profiles",
      pageSize: 300,
      pageToken,
    });
    for (const d of data.documents || []) {
      scanned += 1;
      const uid = d.name.split("/").pop();
      const email = str(d.fields?.email);
      if (!email) continue;
      carrying += 1;

      const key = emailKey(email);
      if (!key) {
        console.log(
          `  SKIP  ${uid}  address cannot be a document id: ${mask(email)}`,
        );
        skipped += 1;
        continue;
      }

      try {
        // Only write the lookup entry if it is not already somebody's.
        let owner = null;
        try {
          const { data: existing } = await docs.get({
            name: `${ROOT}/emails/${key}`,
          });
          owner = str(existing.fields?.uid);
        } catch (err) {
          if (err?.code !== 404 && err?.response?.status !== 404) throw err;
        }

        if (owner && owner !== uid) {
          console.log(
            `  SKIP  ${uid}  ${mask(key)} already points at ${owner}`,
          );
          skipped += 1;
          continue;
        }

        if (!owner) {
          if (APPLY)
            await docs.patch({
              name: `${ROOT}/emails/${key}`,
              requestBody: {
                fields: {
                  uid: { stringValue: uid },
                  updatedAt: { timestampValue: new Date().toISOString() },
                },
              },
            });
          moved += 1;
        }

        // Then, and only then, take it off the public card.
        if (APPLY)
          await docs.patch({
            name: `${ROOT}/profiles/${uid}`,
            "updateMask.fieldPaths": ["email"],
            requestBody: {},
          });
        cleared += 1;
        console.log(`  ${APPLY ? "done" : "would"}  ${uid}  ${mask(key)}`);
      } catch (err) {
        failed += 1;
        console.error(`  FAIL  ${uid}  ${err?.message || err}`);
      }
    }
    pageToken = data.nextPageToken;
  } while (pageToken);

  console.log(`\nprofiles scanned .............. ${scanned}`);
  console.log(`carrying an address ........... ${carrying}`);
  console.log(
    `lookup entries ${APPLY ? "written" : "to write"} ......... ${moved}`,
  );
  console.log(
    `addresses ${APPLY ? "cleared" : "to clear"} .............. ${cleared}`,
  );
  if (skipped) console.log(`skipped ....................... ${skipped}`);
  if (failed) console.log(`failed ........................ ${failed}`);
  if (!APPLY && carrying)
    console.log(`\nNothing was written. Re-run with --apply to do it.`);
  process.exit(failed ? 1 : 0);
}

main().catch((err) => {
  console.error(err?.message || err);
  console.error(
    "\nIf this is an auth error, run:  gcloud auth application-default login",
  );
  process.exit(1);
});
