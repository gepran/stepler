import { useRef, useState, useEffect, useCallback } from "react";
import PropTypes from "prop-types";

const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0"));
const MINUTES = Array.from({ length: 60 }, (_, i) =>
  String(i).padStart(2, "0"),
);

const Wheel = ({ options, value, onChange }) => {
  const scrollRef = useRef(null);
  const itemHeight = 36; // Height of each item in px
  const [isInternalChange, setIsInternalChange] = useState(false);

  // Synchronize scroll position with current value
  useEffect(() => {
    const index = options.indexOf(value);
    if (index !== -1 && scrollRef.current && !isInternalChange) {
      scrollRef.current.scrollTop = index * itemHeight;
    }
  }, [value, options, isInternalChange]);

  const handleScroll = useCallback((e) => {
    const top = e.target.scrollTop;
    const index = Math.round(top / itemHeight);
    const newValue = options[index];
    
    if (newValue !== undefined && newValue !== value) {
      setIsInternalChange(true);
      onChange(newValue);
      // Reset internal change flag after a short delay
      setTimeout(() => setIsInternalChange(false), 50);
    }
  }, [onChange, options, value]);

  return (
    <div className="relative h-[108px] w-14 overflow-hidden rounded-xl bg-neutral-100/50 dark:bg-neutral-800/40">
      <div 
        ref={scrollRef}
        onScroll={handleScroll}
        className="h-full overflow-y-auto snap-y snap-mandatory no-scrollbar py-[36px]"
      >
        {options.map((opt) => (
          <div 
            key={opt}
            className={`flex h-[36px] items-center justify-center text-[15px] font-bold snap-start transition-all duration-200 ${
              opt === value 
                ? "text-blue-500 scale-110" 
                : "text-neutral-400 opacity-40 hover:opacity-100"
            }`}
          >
            {opt}
          </div>
        ))}
      </div>
      {/* Selection Highlight */}
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <div className="h-[36px] w-[85%] rounded-lg border-y border-blue-500/10 bg-blue-500/5 shadow-[0_0_15px_rgba(59,130,246,0.05)]" />
      </div>
      {/* Overlay Gradients */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-8 bg-gradient-to-b from-neutral-100/80 dark:from-neutral-800/80 to-transparent" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t from-neutral-100/80 dark:from-neutral-800/80 to-transparent" />
    </div>
  );
};

Wheel.propTypes = {
  options: PropTypes.arrayOf(PropTypes.string).isRequired,
  value: PropTypes.string.isRequired,
  onChange: PropTypes.func.isRequired,
};

export default function AppleTimePicker({ value, onChange }) {
  // Ensure value is in HH:MM format
  const timeStr = value || "00:00";
  const [hh, mm] = timeStr.split(":");

  return (
    <div className="group flex items-center gap-3 rounded-2xl border border-neutral-200 bg-white/50 p-2 shadow-sm transition-all hover:border-neutral-300 dark:border-neutral-700/50 dark:bg-neutral-900/50">
      <div className="flex flex-col items-center gap-1">
        <span className="text-[9px] font-black uppercase tracking-widest text-neutral-400 opacity-60">HH</span>
        <Wheel 
          options={HOURS}
          value={hh}
          onChange={(v) => onChange(`${v}:${mm}`)}
        />
      </div>
      <div className="mb-0.5 mt-4 text-xl font-black text-blue-500/30 animate-pulse">:</div>
      <div className="flex flex-col items-center gap-1">
        <span className="text-[9px] font-black uppercase tracking-widest text-neutral-400 opacity-60">MM</span>
        <Wheel 
          options={MINUTES}
          value={mm}
          onChange={(v) => onChange(`${hh}:${v}`)}
        />
      </div>
    </div>
  );
}

AppleTimePicker.propTypes = {
  value: PropTypes.string,
  onChange: PropTypes.func.isRequired,
};
