import PropTypes from "prop-types";

// The Stepler Ribbon "S" Logo
export default function SteplerLogo({ className = "", size = 24 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <defs>
        <linearGradient id="steplerRibbonTop" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#3b82f6" />
          <stop offset="100%" stopColor="#a855f7" />
        </linearGradient>
        <linearGradient
          id="steplerRibbonBottom"
          x1="0%"
          y1="0%"
          x2="100%"
          y2="0%"
        >
          <stop offset="0%" stopColor="#f59e0b" />
          <stop offset="100%" stopColor="#ef4444" />
        </linearGradient>
      </defs>

      {/* Top loop */}
      <path
        d="M 65 20 C 85 20, 85 50, 65 50 L 35 50 C 25 50, 15 40, 15 35 C 15 25, 25 20, 35 20 Z"
        fill="url(#steplerRibbonTop)"
      />

      {/* Bottom loop */}
      <path
        d="M 35 80 C 15 80, 15 50, 35 50 L 65 50 C 75 50, 85 60, 85 65 C 85 75, 75 80, 65 80 Z"
        fill="url(#steplerRibbonBottom)"
      />

      {/* Fold overlay */}
      <path d="M 35 50 L 65 50 L 50 65 Z" fill="#000000" opacity="0.15" />
    </svg>
  );
}

SteplerLogo.propTypes = {
  className: PropTypes.string,
  size: PropTypes.number,
};
