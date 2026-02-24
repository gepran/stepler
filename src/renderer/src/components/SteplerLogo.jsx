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
          <stop offset="0%" stopColor="#41A1FF" />
          <stop offset="100%" stopColor="#9B6AFF" />
        </linearGradient>
        <linearGradient
          id="steplerRibbonBottom"
          x1="0%"
          y1="0%"
          x2="100%"
          y2="0%"
        >
          <stop offset="0%" stopColor="#FF9A00" />
          <stop offset="100%" stopColor="#FF3B30" />
        </linearGradient>
      </defs>

      {/* Top Capsule */}
      <path
        d="M 30 20 H 65 C 80 20 80 50 65 50 H 30 C 15 50 15 20 30 20 Z"
        fill="url(#steplerRibbonTop)"
      />

      {/* Bottom Capsule */}
      <path
        d="M 35 50 H 70 C 85 50 85 80 70 80 H 35 C 20 80 20 50 35 50 Z"
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
