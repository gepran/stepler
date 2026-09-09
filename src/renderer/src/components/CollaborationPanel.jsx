import { useCallback, useEffect, useRef, useState } from "react";
import PropTypes from "prop-types";
import { AtSign, Check, Search, UserPlus, UserX, X } from "lucide-react";
import { useT } from "../lib/i18n";

/**
 * Connect with someone, and see who you are already connected to.
 *
 * Presentational on purpose: the two apps reach Firestore very differently —
 * the web app talks to it directly, the desktop window goes through IPC to the
 * main process — so everything that touches the network is passed in. What is
 * shared is the part a person sees, which is the part that has to match.
 *
 * The shape of the thing: you find a person by handle or email, you invite
 * them, and nothing happens until they accept. Once both sides have said yes,
 * each can put the other's @handle in a task.
 */
export default function CollaborationPanel({
  profile,
  connections,
  onSearch,
  onInvite,
  onAccept,
  onRemove,
  onToast,
  compact = false,
}) {
  const t = useT();
  const [term, setTerm] = useState("");
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [busyUid, setBusyUid] = useState(null);
  const [searched, setSearched] = useState(false);

  const accepted = connections.filter((c) => c.status === "accepted");
  const incoming = connections.filter((c) => c.status === "incoming");
  const pending = connections.filter((c) => c.status === "pending");

  // The search runs on a timer rather than a button, and the counter is what
  // stops a slow early query from painting over a later, better one.
  const runId = useRef(0);
  useEffect(() => {
    const raw = term.trim();
    if (raw.length < 2) {
      setResults([]);
      setSearched(false);
      return undefined;
    }
    const mine = ++runId.current;
    setSearching(true);
    const timer = setTimeout(async () => {
      try {
        const found = await onSearch(raw);
        if (mine !== runId.current) return;
        setResults(found || []);
        setSearched(true);
      } catch (err) {
        if (mine !== runId.current) return;
        console.warn("Search failed:", err.code || err.message);
        setResults([]);
        setSearched(true);
      } finally {
        if (mine === runId.current) setSearching(false);
      }
    }, 350);
    return () => clearTimeout(timer);
  }, [term, onSearch]);

  const act = useCallback(
    async (uid, run, toastKey) => {
      setBusyUid(uid);
      try {
        await run();
        if (toastKey) onToast?.(t(toastKey));
      } catch (err) {
        console.warn("Collaboration action failed:", err.code || err.message);
        onToast?.(t("collab.failed"), "error");
      } finally {
        setBusyUid(null);
      }
    },
    [onToast, t],
  );

  const known = new Map(connections.map((c) => [c.uid, c.status]));

  const box = compact
    ? "rounded-xl border border-neutral-200 dark:border-neutral-800"
    : "rounded-2xl border border-neutral-200 dark:border-neutral-800";

  return (
    <div className="space-y-6">
      {/* Who you are to everybody else. The handle is not editable: it is the
          name other people have already typed into their own tasks. */}
      <div
        className={`flex items-center gap-3 px-4 py-3.5 ${box} bg-neutral-50/60 dark:bg-neutral-800/30`}
      >
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-orange-500/10 text-orange-500">
          <AtSign size={18} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold text-neutral-800 dark:text-neutral-100">
            {profile?.username ? `@${profile.username}` : t("collab.noHandle")}
          </p>
          <p className="truncate text-[11.5px] text-neutral-500 dark:text-neutral-400">
            {t("collab.yourHandle")}
          </p>
        </div>
      </div>

      {/* Find somebody */}
      <section>
        <h4 className="mb-2 text-[11px] font-bold uppercase tracking-widest text-neutral-400 dark:text-neutral-500">
          {t("collab.find")}
        </h4>
        <div className="flex items-center gap-2 rounded-xl border border-neutral-200 bg-white px-3 py-2 dark:border-neutral-700 dark:bg-neutral-900">
          <Search size={15} className="shrink-0 text-neutral-400" />
          <input
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            placeholder={t("collab.searchPlaceholder")}
            className="w-full bg-transparent text-sm text-neutral-900 outline-none placeholder:text-neutral-400 dark:text-neutral-100"
          />
          {term && (
            <button
              type="button"
              onClick={() => setTerm("")}
              aria-label={t("common.clear")}
              className="shrink-0 cursor-pointer rounded p-1 text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200"
            >
              <X size={13} />
            </button>
          )}
        </div>

        {searching && (
          <p className="mt-2 text-[12px] text-neutral-400">
            {t("auth.working")}
          </p>
        )}

        {!searching && searched && results.length === 0 && (
          <p className="mt-2 text-[12px] text-neutral-400">
            {t("collab.noResults", { term: term.trim() })}
          </p>
        )}

        {results.length > 0 && (
          <div className={`mt-2 overflow-hidden ${box}`}>
            {results.map((person) => {
              const status = known.get(person.uid);
              return (
                <Row
                  key={person.uid}
                  person={person}
                  busy={busyUid === person.uid}
                  right={
                    status === "accepted" ? (
                      <Tag tone="done">{t("collab.connected")}</Tag>
                    ) : status === "pending" ? (
                      <Tag>{t("collab.invited")}</Tag>
                    ) : status === "incoming" ? (
                      <Action
                        onClick={() =>
                          act(
                            person.uid,
                            () => onAccept(person),
                            "collab.toastAccepted",
                          )
                        }
                        icon={Check}
                        label={t("collab.accept")}
                        primary
                      />
                    ) : (
                      <Action
                        onClick={() =>
                          act(
                            person.uid,
                            () => onInvite(person),
                            "collab.toastInvited",
                          )
                        }
                        icon={UserPlus}
                        label={t("collab.invite")}
                        primary
                      />
                    )
                  }
                />
              );
            })}
          </div>
        )}
      </section>

      {incoming.length > 0 && (
        <section>
          <h4 className="mb-2 text-[11px] font-bold uppercase tracking-widest text-orange-500">
            {t("collab.incoming")}
          </h4>
          <div className={`overflow-hidden ${box}`}>
            {incoming.map((person) => (
              <Row
                key={person.uid}
                person={person}
                busy={busyUid === person.uid}
                right={
                  <div className="flex items-center gap-1">
                    <Action
                      onClick={() =>
                        act(
                          person.uid,
                          () => onAccept(person),
                          "collab.toastAccepted",
                        )
                      }
                      icon={Check}
                      label={t("collab.accept")}
                      primary
                    />
                    <Action
                      onClick={() =>
                        act(person.uid, () => onRemove(person.uid))
                      }
                      icon={X}
                      label={t("collab.decline")}
                    />
                  </div>
                }
              />
            ))}
          </div>
        </section>
      )}

      <section>
        <h4 className="mb-2 text-[11px] font-bold uppercase tracking-widest text-neutral-400 dark:text-neutral-500">
          {t("collab.connections")}
        </h4>
        {accepted.length === 0 && pending.length === 0 ? (
          <p
            className={`px-4 py-6 text-center text-[13px] text-neutral-400 dark:text-neutral-500 ${box} border-dashed`}
          >
            {t("collab.noneYet")}
          </p>
        ) : (
          <div className={`overflow-hidden ${box}`}>
            {[...accepted, ...pending].map((person) => (
              <Row
                key={person.uid}
                person={person}
                busy={busyUid === person.uid}
                right={
                  <div className="flex items-center gap-1">
                    {person.status === "pending" && (
                      <Tag>{t("collab.waiting")}</Tag>
                    )}
                    <Action
                      onClick={() =>
                        act(
                          person.uid,
                          () => onRemove(person.uid),
                          "collab.toastRemoved",
                        )
                      }
                      icon={UserX}
                      label={t("collab.disconnect")}
                      danger
                    />
                  </div>
                }
              />
            ))}
          </div>
        )}
        <p className="mt-2 text-[11.5px] leading-relaxed text-neutral-400 dark:text-neutral-500">
          {t("collab.hint")}
        </p>
      </section>
    </div>
  );
}

function Row({ person, right, busy }) {
  return (
    <div
      className={`flex items-center gap-3 border-b border-neutral-100 px-3.5 py-2.5 last:border-b-0 dark:border-neutral-800/70 ${
        busy ? "opacity-50" : ""
      }`}
    >
      <span className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-neutral-200 text-[11px] font-bold uppercase text-neutral-600 dark:bg-neutral-700 dark:text-neutral-300">
        {person.photoURL ? (
          <img
            src={person.photoURL}
            alt=""
            referrerPolicy="no-referrer"
            className="h-full w-full object-cover"
          />
        ) : (
          (person.username || person.email || "?")[0]
        )}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] font-semibold text-neutral-800 dark:text-neutral-100">
          @{person.username}
        </p>
        <p className="truncate text-[11.5px] text-neutral-400 dark:text-neutral-500">
          {person.displayName || person.email}
        </p>
      </div>
      <div className="shrink-0">{right}</div>
    </div>
  );
}

Row.propTypes = {
  person: PropTypes.object.isRequired,
  right: PropTypes.node,
  busy: PropTypes.bool,
};

function Action({ onClick, icon: Icon, label, primary, danger }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      className={`flex cursor-pointer items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[12px] font-semibold transition-colors ${
        primary
          ? "bg-neutral-900 text-white hover:bg-neutral-700 dark:bg-orange-500 dark:hover:bg-orange-400"
          : danger
            ? "text-neutral-400 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-950/40"
            : "text-neutral-500 hover:bg-neutral-100 hover:text-neutral-800 dark:hover:bg-neutral-800"
      }`}
    >
      <Icon size={13} />
      {primary && <span>{label}</span>}
    </button>
  );
}

Action.propTypes = {
  onClick: PropTypes.func.isRequired,
  icon: PropTypes.elementType.isRequired,
  label: PropTypes.string.isRequired,
  primary: PropTypes.bool,
  danger: PropTypes.bool,
};

function Tag({ children, tone }) {
  return (
    <span
      className={`rounded-full px-2 py-1 text-[10.5px] font-bold uppercase tracking-wide ${
        tone === "done"
          ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
          : "bg-neutral-200/70 text-neutral-500 dark:bg-neutral-700/60 dark:text-neutral-300"
      }`}
    >
      {children}
    </span>
  );
}

Tag.propTypes = { children: PropTypes.node, tone: PropTypes.string };

CollaborationPanel.propTypes = {
  profile: PropTypes.shape({ username: PropTypes.string }),
  connections: PropTypes.array.isRequired,
  onSearch: PropTypes.func.isRequired,
  onInvite: PropTypes.func.isRequired,
  onAccept: PropTypes.func.isRequired,
  onRemove: PropTypes.func.isRequired,
  onToast: PropTypes.func,
  compact: PropTypes.bool,
};
