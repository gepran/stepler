/**
 * The web app's half of collaboration: the shared Firestore layer bound to this
 * client's `db`, plus the one hook the interface actually consumes.
 *
 * Everything that decides anything lives in ../renderer/src/lib/collab-store.js
 * so the desktop app runs the same handshake. What is here is wiring.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { db } from "./firebase";
import {
  acceptInvite as acceptInviteRaw,
  addMentionSubtask as addMentionSubtaskRaw,
  dismissMention as dismissMentionRaw,
  ensureProfile as ensureProfileRaw,
  markAllMentionsRead as markAllReadRaw,
  markMentionRead as markReadRaw,
  reconcileMentions as reconcileRaw,
  removeConnection as removeConnectionRaw,
  searchProfiles as searchProfilesRaw,
  sendInvite as sendInviteRaw,
  setMentionSubtaskCompleted as setMentionSubtaskCompletedRaw,
  updateMentionedTask as updateMentionedTaskRaw,
  subscribeConnections,
  subscribeMentions,
} from "../renderer/src/lib/collab-store";

export const ensureProfile = (user) => ensureProfileRaw(db, user);
export const searchProfiles = (term, opts) => searchProfilesRaw(db, term, opts);
export const sendInvite = (me, target) => sendInviteRaw(db, me, target);
export const acceptInvite = (me, other) => acceptInviteRaw(db, me, other);
export const removeConnection = (me, uid) => removeConnectionRaw(db, me, uid);
export const markMentionRead = (uid, id, read) =>
  markReadRaw(db, uid, id, read);
export const markAllMentionsRead = (uid, list) => markAllReadRaw(db, uid, list);
export const reconcileMentions = (args) => reconcileRaw(db, args);

/**
 * The three edits somebody you mentioned is allowed to make, each writing the
 * author's task and your own copy of it together. See updateMentionedTask.
 */
export const editMention = (meUid, mention, patch) =>
  updateMentionedTaskRaw(db, { meUid, mention, patch });
export const addSubtaskToMention = (meUid, mention, text) =>
  addMentionSubtaskRaw(db, { meUid, mention, text });
export const toggleMentionSubtask = (meUid, mention, subtaskId, completed) =>
  setMentionSubtaskCompletedRaw(db, { meUid, mention, subtaskId, completed });

/** Off my list, and only mine. */
export const dismissMention = (uid, mention) =>
  dismissMentionRaw(db, uid, String(mention.taskId || mention.id));

/**
 * Everything one signed-in account knows about other people, in one place: who
 * it is to them (the handle), who it is connected to, and what it has been
 * sent.
 *
 * The profile is claimed on the first render after sign-in rather than at
 * account creation, because an account can also be created by the desktop app
 * or have existed before any of this shipped — and either way the handle has
 * to exist before anybody can be mentioned.
 */
const NOBODY = [];

export function useCollab(user) {
  const uid = user?.uid || null;
  const [loaded, setLoaded] = useState({
    uid: null,
    profile: null,
    connections: NOBODY,
    mentions: NOBODY,
  });
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!user?.uid) return undefined;
    let alive = true;
    ensureProfile(user)
      .then(
        (card) =>
          alive &&
          setLoaded((cur) => ({ ...cur, uid: user.uid, profile: card })),
      )
      .catch((err) => {
        console.warn("Could not claim a handle:", err.code || err.message);
        if (alive) setError(err.message);
      });
    return () => {
      alive = false;
    };
  }, [user]);

  useEffect(() => {
    if (!uid) return undefined;
    return subscribeConnections(
      db,
      uid,
      (list) => setLoaded((cur) => ({ ...cur, uid, connections: list })),
      (err) => {
        console.warn("Connections failed:", err.code, err.message);
        setError(err.message);
      },
    );
  }, [uid]);

  useEffect(() => {
    if (!uid) return undefined;
    return subscribeMentions(
      db,
      uid,
      (list) => setLoaded((cur) => ({ ...cur, uid, mentions: list })),
      (err) => {
        console.warn("Mentions failed:", err.code, err.message);
        setError(err.message);
      },
    );
  }, [uid]);

  /**
   * Signing out is handled by ignoring what was loaded rather than by clearing
   * it from inside an effect: the account has already changed by the time an
   * effect could run, and one frame of the previous person's connections is
   * one frame too many.
   */
  const fresh = loaded.uid === uid;
  const profile = fresh ? loaded.profile : null;
  const connections = fresh ? loaded.connections : NOBODY;
  const mentions = fresh ? loaded.mentions : NOBODY;

  const accepted = useMemo(
    () => connections.filter((c) => c.status === "accepted"),
    [connections],
  );
  const incoming = useMemo(
    () => connections.filter((c) => c.status === "incoming"),
    [connections],
  );
  const pending = useMemo(
    () => connections.filter((c) => c.status === "pending"),
    [connections],
  );
  const unread = useMemo(() => mentions.filter((m) => !m.read), [mentions]);

  /**
   * The delivery pass, run whenever a task this account owns changes.
   *
   * `me` and the accepted list are read through a ref rather than closed over,
   * so the callback stays stable and the caller's effects do not re-fire every
   * time a snapshot arrives. The ref is filled in an effect rather than during
   * render: a render can be thrown away and re-run, and writing through it on
   * the way past would leave the callback pointing at a version of the state
   * that never reached the screen.
   */
  const latest = useRef({ profile, accepted, user });
  useEffect(() => {
    latest.current = { profile, accepted, user };
  }, [profile, accepted, user]);

  const deliver = useCallback(async (tasks) => {
    const { profile: card, accepted: list, user: account } = latest.current;
    if (!card || !account) return;
    if (!list.length) return; // nobody to mention; nothing can be addressed
    try {
      await reconcileMentions({
        me: { ...card, uid: account.uid },
        tasks,
        connections: list,
      });
    } catch (err) {
      console.warn("Could not deliver a mention:", err.code || err.message);
    }
  }, []);

  return {
    profile,
    connections,
    accepted,
    incoming,
    pending,
    mentions,
    unread,
    error,
    deliver,
  };
}
