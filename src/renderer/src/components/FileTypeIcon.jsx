import PropTypes from "prop-types";

/**
 * Beautiful file-type icon that displays a colored badge
 * based on the file extension (PDF, XLSX, DOCX, etc.)
 */
export default function FileTypeIcon({ fileName, size = 32 }) {
  const ext = (fileName || "").split(".").pop().toLowerCase();

  const config = FILE_CONFIGS[ext] || FILE_CONFIGS._default;

  const s = size;
  const r = s * 0.16; // corner radius
  const fold = s * 0.3; // corner fold size
  const labelH = s * 0.3; // label height
  const labelY = s * 0.52; // label Y position

  return (
    <svg
      width={s}
      height={s}
      viewBox={`0 0 ${s} ${s}`}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="shrink-0"
    >
      {/* Page body */}
      <path
        d={`M${r} 0 H${s - fold} L${s} ${fold} V${s - r} Q${s} ${s} ${s - r} ${s} H${r} Q0 ${s} 0 ${s - r} V${r} Q0 0 ${r} 0Z`}
        fill={config.pageFill}
        stroke={config.pageStroke}
        strokeWidth={0.5}
      />
      {/* Corner fold */}
      <path
        d={`M${s - fold} 0 V${fold - r} Q${s - fold} ${fold} ${s - fold + r} ${fold} H${s} L${s - fold} 0Z`}
        fill={config.foldFill}
        stroke={config.pageStroke}
        strokeWidth={0.5}
      />
      {/* Colored label band */}
      <rect
        x={0}
        y={labelY}
        width={s}
        height={labelH}
        rx={1}
        fill={config.labelBg}
      />
      {/* Extension text */}
      <text
        x={s / 2}
        y={labelY + labelH / 2}
        textAnchor="middle"
        dominantBaseline="central"
        fill="#fff"
        fontSize={s * 0.24}
        fontWeight="800"
        fontFamily="system-ui, -apple-system, sans-serif"
        letterSpacing={0.5}
      >
        {config.label}
      </text>
    </svg>
  );
}

const FILE_CONFIGS = {
  // Documents
  pdf: {
    label: "PDF",
    labelBg: "#E53935",
    pageFill: "#FFF5F5",
    pageStroke: "#E5B8B8",
    foldFill: "#FDDEDE",
  },
  doc: {
    label: "DOC",
    labelBg: "#1565C0",
    pageFill: "#F0F5FF",
    pageStroke: "#B0C4DE",
    foldFill: "#D6E4F0",
  },
  docx: {
    label: "DOCX",
    labelBg: "#1565C0",
    pageFill: "#F0F5FF",
    pageStroke: "#B0C4DE",
    foldFill: "#D6E4F0",
  },
  // Spreadsheets
  xls: {
    label: "XLS",
    labelBg: "#2E7D32",
    pageFill: "#F0FFF0",
    pageStroke: "#A8D5A8",
    foldFill: "#D4EDDA",
  },
  xlsx: {
    label: "XLSX",
    labelBg: "#2E7D32",
    pageFill: "#F0FFF0",
    pageStroke: "#A8D5A8",
    foldFill: "#D4EDDA",
  },
  csv: {
    label: "CSV",
    labelBg: "#388E3C",
    pageFill: "#F0FFF0",
    pageStroke: "#A8D5A8",
    foldFill: "#D4EDDA",
  },
  // Presentations
  ppt: {
    label: "PPT",
    labelBg: "#D84315",
    pageFill: "#FFF8F0",
    pageStroke: "#E5C8B0",
    foldFill: "#FAE0C8",
  },
  pptx: {
    label: "PPTX",
    labelBg: "#D84315",
    pageFill: "#FFF8F0",
    pageStroke: "#E5C8B0",
    foldFill: "#FAE0C8",
  },
  // Code / Text
  txt: {
    label: "TXT",
    labelBg: "#546E7A",
    pageFill: "#FAFAFA",
    pageStroke: "#CFD8DC",
    foldFill: "#E0E0E0",
  },
  json: {
    label: "JSON",
    labelBg: "#FFA000",
    pageFill: "#FFFDE7",
    pageStroke: "#E0D6A0",
    foldFill: "#FFF3C0",
  },
  html: {
    label: "HTML",
    labelBg: "#E65100",
    pageFill: "#FFF3E0",
    pageStroke: "#E0C8A0",
    foldFill: "#FFE0B2",
  },
  // Archives
  zip: {
    label: "ZIP",
    labelBg: "#6D4C41",
    pageFill: "#FAF5F0",
    pageStroke: "#D7CCC8",
    foldFill: "#EFEBE9",
  },
  rar: {
    label: "RAR",
    labelBg: "#6D4C41",
    pageFill: "#FAF5F0",
    pageStroke: "#D7CCC8",
    foldFill: "#EFEBE9",
  },
  // Media
  mp3: {
    label: "MP3",
    labelBg: "#7B1FA2",
    pageFill: "#F8F0FF",
    pageStroke: "#D1B3E0",
    foldFill: "#E8D5F5",
  },
  mp4: {
    label: "MP4",
    labelBg: "#C62828",
    pageFill: "#FFF5F5",
    pageStroke: "#E5B8B8",
    foldFill: "#FDDEDE",
  },
  // Fallback
  _default: {
    label: "FILE",
    labelBg: "#78909C",
    pageFill: "#FAFAFA",
    pageStroke: "#CFD8DC",
    foldFill: "#E0E0E0",
  },
};

FileTypeIcon.propTypes = {
  fileName: PropTypes.string.isRequired,
  size: PropTypes.number,
};
