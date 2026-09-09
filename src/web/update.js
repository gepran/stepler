/**
 * "Is there a newer Stepler?", answered honestly in a browser tab.
 *
 * The desktop app has electron-updater to ask. A web app has nothing of the
 * sort, and the usual stand-in — a Reload button — cannot tell you whether it
 * did anything, which makes it a button you press hopefully rather than one
 * that answers a question.
 *
 * So the check is a real comparison: the page's own script is served under a
 * hashed name that changes with every build, so fetching the page again and
 * reading the name out of it says exactly whether what is deployed is what is
 * running.
 */

/** The hashed bundle this page is running, e.g. "/assets/app-C3M9SS7Y.js". */
function runningBuild() {
  const tag = document.querySelector('script[src*="/assets/app-"]');
  return tag?.getAttribute("src") || null;
}

/** The same, read out of a fresh copy of the page from the server. */
async function deployedBuild() {
  // `cache: "no-store"` goes past both the HTTP cache and the service worker's
  // copy — the whole point is to see what the server has, not what we kept.
  const res = await fetch(window.location.pathname, {
    cache: "no-store",
    headers: { "cache-control": "no-cache" },
  });
  if (!res.ok) throw new Error(`The server answered ${res.status}`);
  const html = await res.text();
  return html.match(/src="(\/assets\/app-[^"]+\.js)"/)?.[1] || null;
}

/**
 * Returns whether a different build is deployed.
 *
 * A build it cannot identify at either end resolves to "no update" rather than
 * a guess: telling somebody to reload for nothing is worse than staying quiet.
 */
export async function checkForUpdate() {
  const current = runningBuild();
  const latest = await deployedBuild();
  return {
    available: !!current && !!latest && current !== latest,
    current,
    latest,
  };
}

/**
 * Take the new build.
 *
 * The service worker is asked to re-fetch itself first, because it is the
 * thing that would otherwise keep handing out the old shell; only then does
 * the page reload into what the server actually has.
 */
export async function applyUpdate() {
  try {
    const reg = await navigator.serviceWorker?.getRegistration();
    if (reg) {
      await reg.update();
      // A worker that installed and is waiting will not take over until every
      // tab using the old one is gone. Ours calls skipWaiting on install, so
      // this is belt and braces for a build that did not.
      reg.waiting?.postMessage?.({ type: "SKIP_WAITING" });
    }
  } catch (err) {
    // Not a reason to refuse the reload — the worker is a cache, not the app.
    console.warn("Could not refresh the service worker:", err.message);
  }
  window.location.reload();
}
