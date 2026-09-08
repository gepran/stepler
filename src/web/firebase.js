import { initializeApp } from "firebase/app";
import {
  getAuth,
  browserLocalPersistence,
  setPersistence,
} from "firebase/auth";
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
} from "firebase/firestore";

/**
 * These values are not secrets. Every Firebase web app ships them in its
 * bundle; what actually protects the data is the Firestore rules plus the
 * authorized-domain list, not hiding this object.
 */
const firebaseConfig = {
  apiKey: "AIzaSyAb3llMMjuJRWxaeVovQpguS0GtJqv1iow",
  authDomain: "stepler-490308.firebaseapp.com",
  projectId: "stepler-490308",
  storageBucket: "stepler-490308.firebasestorage.app",
  messagingSenderId: "638697418683",
  appId: "1:638697418683:web:e0c295057e55d997f65e9e",
};

export const app = initializeApp(firebaseConfig);

/**
 * An IndexedDB cache, so a closed laptop lid is not data loss: writes made
 * offline queue up locally and reach Firestore on the next connection. The
 * multi-tab manager keeps two open tabs from fighting over that cache.
 */
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({
    tabManager: persistentMultipleTabManager(),
  }),
});

export const auth = getAuth(app);

// Survive a page reload. Without this the session lives in memory only and
// every refresh drops the user back on the sign-in screen.
setPersistence(auth, browserLocalPersistence).catch((err) =>
  console.warn("Could not persist the session:", err.message),
);
