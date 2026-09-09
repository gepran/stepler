import { useEffect, useRef, useState } from "react";
import PropTypes from "prop-types";
import { attachmentSrc, imageBox } from "../lib/attachments";

/** How many times a missing file is asked for again, and how long between. */
const RETRIES = 4;
const RETRY_MS = 4000;

/**
 * A stored picture, drawn from the app's own `stepler-file:` scheme.
 *
 * The plain `<img>` this replaces was fine while every attachment was made on
 * the machine showing it. Now that bytes travel, a second computer learns a
 * task's attachment id from the cloud a few seconds before the file behind it
 * finishes downloading — so the first paint is a 404, and nothing would ever
 * ask again. This fades that gap out and quietly retries a few times, which is
 * long enough for the download to land.
 */
export default function AttachmentImage({ att, className, onClick, alt }) {
  // Keyed by the file it belongs to and compared during render, so a different
  // picture starts over without an effect writing state on its way in.
  const [tried, setTried] = useState({ id: null, attempt: 0, missing: false });
  const timer = useRef(null);

  useEffect(() => () => clearTimeout(timer.current), []);

  const src = attachmentSrc(att);
  const mine = tried.id === att?.id;
  const attempt = mine ? tried.attempt : 0;
  const missing = mine ? tried.missing : false;

  if (!src) return null;

  return (
    <img
      // The counter is part of the URL because the browser will not re-request
      // a src it already has, however many times React re-renders it.
      src={attempt ? `${src}?try=${attempt}` : src}
      alt={alt ?? att.name}
      loading="lazy"
      decoding="async"
      {...imageBox(att)}
      onLoad={() => setTried({ id: att.id, attempt, missing: false })}
      onError={() => {
        setTried({ id: att.id, attempt, missing: true });
        if (attempt >= RETRIES) return;
        clearTimeout(timer.current);
        timer.current = setTimeout(
          () => setTried({ id: att.id, attempt: attempt + 1, missing: true }),
          RETRY_MS,
        );
      }}
      onClick={onClick}
      style={missing ? { opacity: 0.25 } : undefined}
      className={className}
    />
  );
}

AttachmentImage.propTypes = {
  att: PropTypes.object.isRequired,
  className: PropTypes.string,
  onClick: PropTypes.func,
  alt: PropTypes.string,
};
