import type { MatchLabel } from "@/lib/matchTrials";

const COLORS: Record<MatchLabel, string> = {
  possible: "#10b981", // emerald — good match
  unclear: "#f59e0b", // amber — medium
  unlikely: "#ef4444", // red — weak (kept distinct from the rose brand)
};

export function ScoreRing({ score, label }: { score: number; label: MatchLabel }) {
  const radius = 26;
  const circumference = 2 * Math.PI * radius;
  const pct = Math.max(0, Math.min(100, score));
  const offset = circumference - (pct / 100) * circumference;
  const color = COLORS[label];

  return (
    <div className="relative h-16 w-16 shrink-0" role="img" aria-label={`Match score ${score} out of 100`}>
      <svg className="h-16 w-16 -rotate-90" viewBox="0 0 64 64" aria-hidden>
        <circle cx="32" cy="32" r={radius} fill="none" stroke="#e2e8f0" strokeWidth="6" />
        <circle
          cx="32"
          cy="32"
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="transition-[stroke-dashoffset] duration-700 ease-out"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-lg font-bold leading-none text-slate-900">{score}</span>
        <span className="text-[9px] font-semibold uppercase tracking-wide text-slate-400">/ 100</span>
      </div>
    </div>
  );
}
