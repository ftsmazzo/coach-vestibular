/** Anel de percentual (acertos) para destaque visual */
export function PctDonut({
  pct,
  size = "lg",
  label,
}: {
  pct: number;
  size?: "md" | "lg";
  label?: string;
}) {
  const dim = size === "lg" ? "h-32 w-32" : "h-24 w-24";
  const text = size === "lg" ? "text-3xl" : "text-2xl";
  const dash = Math.min(100, Math.max(0, pct));

  return (
    <div className="flex flex-col items-center gap-1">
      <div className={`relative ${dim}`}>
        <svg viewBox="0 0 36 36" className="h-full w-full -rotate-90">
          <circle
            cx="18"
            cy="18"
            r="15.9"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            className="text-white/30"
          />
          <circle
            cx="18"
            cy="18"
            r="15.9"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeDasharray={`${dash} ${100 - dash}`}
            strokeLinecap="round"
            className="text-white"
          />
        </svg>
        <span
          className={`absolute inset-0 flex items-center justify-center font-bold text-white ${text}`}
        >
          {pct}%
        </span>
      </div>
      {label && <span className="text-xs font-medium text-teal-100">{label}</span>}
    </div>
  );
}
