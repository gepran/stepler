/** A timeout releases the caller; a rejected write keeps its actual cause. */
export function waitForSync(promise, milliseconds) {
  let timer;
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      timer = setTimeout(() => {
        const error = new Error(
          "Sync is waiting for a connection; local changes are saved.",
        );
        error.code = "sync/timeout";
        reject(error);
      }, milliseconds);
    }),
  ]).finally(() => clearTimeout(timer));
}

export function syncFailure(error) {
  const code = error?.code || "unknown";
  const offline = ["sync/timeout", "unavailable", "deadline-exceeded"].includes(
    code,
  );
  return {
    state: offline ? "offline" : "error",
    error: error?.message || "Sync failed",
    errorCode: code,
  };
}
