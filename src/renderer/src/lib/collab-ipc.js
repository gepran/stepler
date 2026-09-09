import { useCallback, useEffect, useMemo, useState } from "react";
import { ipc } from "./attachments";

/**
 * Collaboration, as the desktop window sees it.
 *
 * The window has no Firebase session — that lives in the main process, backed
 * by a file — so everything here is a request over IPC and a snapshot pushed
 * back. The main process is the only thing that ever talks to Firestore, which
 * is what keeps one signed-in session for the whole app rather than two that
 * can disagree.
 */
export function useCollab() {
  const [snapshot, setSnapshot] = useState({
    uid: null,
    profile: null,
    connections: [],
    mentions: [],
  });

  useEffect(() => {
    if (!ipc) return undefined;
    let alive = true;
    // Ask once for the state as it stands, because the pushes only carry
    // changes and the window may have opened long after sign-in.
    ipc.invoke("collab-snapshot").then((s) => alive && s && setSnapshot(s));

    const onPush = (_, s) => s && setSnapshot(s);
    ipc.on("collab-snapshot", onPush);
    return () => {
      alive = false;
      ipc.removeAllListeners("collab-snapshot");
    };
  }, []);

  // Read off the snapshot through a memo rather than with `|| []`: a fresh
  // empty array every render would be a new dependency every render, and the
  // two memos below would recompute forever.
  const connections = useMemo(
    () => snapshot.connections || [],
    [snapshot.connections],
  );
  const mentions = useMemo(() => snapshot.mentions || [], [snapshot.mentions]);

  const accepted = useMemo(
    () => connections.filter((c) => c.status === "accepted"),
    [connections],
  );
  const unread = useMemo(() => mentions.filter((m) => !m.read), [mentions]);

  const search = useCallback(
    (term) => ipc?.invoke("collab-search", term) ?? [],
    [],
  );
  const invite = useCallback(
    (person) => ipc?.invoke("collab-invite", plain(person)),
    [],
  );
  const accept = useCallback(
    (person) => ipc?.invoke("collab-accept", plain(person)),
    [],
  );
  const remove = useCallback((uid) => ipc?.invoke("collab-remove", uid), []);
  const markRead = useCallback(
    (id) => ipc?.invoke("collab-mark-read", id ?? null),
    [],
  );

  return {
    profile: snapshot.profile,
    connections,
    accepted,
    mentions,
    unread,
    search,
    invite,
    accept,
    remove,
    markRead,
  };
}

/**
 * Only what the other end needs, and only values the structured clone can
 * carry. A Firestore Timestamp on a connection row crosses IPC as a class
 * instance and throws; the fields below are all strings.
 */
function plain(person) {
  if (!person) return null;
  const { uid, username, email, displayName, photoURL } = person;
  return {
    uid,
    username: username || "",
    email: email || "",
    displayName: displayName || "",
    photoURL: photoURL || "",
  };
}
