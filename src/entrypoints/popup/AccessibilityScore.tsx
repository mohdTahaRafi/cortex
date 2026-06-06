import { useCallback, useState } from "react";
import { RefreshCw, ScanText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { AccessibilityScore } from "@/utils/messages";

/* ----------------------- Helpers ---------------------- */
function scoreColor(score: number) {
  if (score >= 70) return "text-emerald-400";
  if (score >= 40) return "text-amber-400";
  return "text-red-400";
}

function scoreStroke(score: number) {
  if (score >= 70) return "stroke-emerald-400";
  if (score >= 40) return "stroke-amber-400";
  return "stroke-red-400";
}

function scoreLabel(score: number) {
  if (score >= 70) return "Good";
  if (score >= 40) return "Fair";
  return "Poor";
}

/* --------------------- Score Meter -------------------- */
function ScoreGauge({ score, size = 76 }: { score: number; size?: number }) {
  const r = (size - 10) / 2;
  const cx = size / 2;
  const cy = size / 2;
  const circumference = 2 * Math.PI * r;
  const arcLength = circumference * 0.75;
  const filled = (score / 100) * arcLength;

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg
        width={size}
        height={size}
        className="-rotate-225"
        aria-hidden="true"
      >
        {/* Track */}
        <circle
          cx={cx}
          cy={cy}
          r={r}
          fill="none"
          className="stroke-white/8"
          strokeWidth={6}
          strokeDasharray={`${arcLength} ${circumference}`}
          strokeLinecap="round"
        />
        {/* Filled arc */}
        <circle
          cx={cx}
          cy={cy}
          r={r}
          fill="none"
          strokeWidth={6}
          strokeDasharray={`${filled} ${circumference}`}
          strokeDashoffset={0}
          strokeLinecap="round"
          className={cn(
            "transition-[stroke-dasharray] duration-700 ease-in-out",
            scoreStroke(score),
          )}
        />
      </svg>

      {/* Centre label */}
      <div className="absolute inset-0 flex flex-col items-center justify-center pb-1">
        <span
          className={cn("text-xl leading-none font-bold", scoreColor(score))}
        >
          {score}
        </span>
        <span className="mt-0.5 text-[9px] text-white/40">
          {scoreLabel(score)}
        </span>
      </div>
    </div>
  );
}

/* -------------------- Sub score bar ------------------- */
function SubScoreBar({
  label,
  score,
  icon,
}: {
  label: string;
  score: number;
  icon: string;
}) {
  return (
    <div className="mb-1.5 last:mb-0">
      <div className="mb-1 flex items-center justify-between">
        <span className="text-[10px] text-white/55">
          {icon} {label}
        </span>
        <span className={cn("text-[10px] font-semibold", scoreColor(score))}>
          {score}
        </span>
      </div>
      <div className="h-1 overflow-hidden rounded-sm bg-white/8">
        <div
          className={cn(
            "h-full rounded-sm transition-[width] duration-700 ease-in-out",
            score >= 70
              ? "bg-emerald-400"
              : score >= 40
                ? "bg-amber-400"
                : "bg-red-400",
          )}
          style={{ width: `${score}%` }}
        />
      </div>
    </div>
  );
}

// findings list
function FindingsList({ findings }: { findings: string[] }) {
  if (!findings.length) return null;
  return (
    <ul className="mt-2 space-y-0.5 rounded-md bg-black/20 px-2 py-1.5">
      {findings.map((f, i) => (
        <li key={i} className="text-[9.5px] leading-relaxed text-white/50">
          • {f}
        </li>
      ))}
    </ul>
  );
}

/* ------------------------------------------------------ */
/*                      Main section                      */
/* ------------------------------------------------------ */

interface AccessibilityScoreSectionProps {
  /** fires when the user requests an analysis (initial or re-analyze) */
  onAnalyze: () => Promise<AccessibilityScore>;
}

export function AccessibilityScoreSection({
  onAnalyze,
}: AccessibilityScoreSectionProps) {
  const [score, setScore] = useState<AccessibilityScore | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const analyze = useCallback(async () => {
    setLoading(true);
    setError(null);
    setScore(null);
    try {
      const result = await onAnalyze();
      setScore(result);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Could not analyze this page");
    } finally {
      setLoading(false);
    }
  }, [onAnalyze]);

  return (
    <section className="border-b border-white/[0.07] bg-[rgba(124,106,247,0.05)] px-4 py-3">
      {/* Section header */}
      <div className="mb-2.5 flex items-center justify-between">
        <p className="text-[10px] font-semibold tracking-widest text-white/40 uppercase">
          Accessibility Score
        </p>
        {score && !loading && (
          <button
            onClick={analyze}
            aria-label="Re-analyze page"
            className="flex items-center text-white/35 transition-colors hover:text-white/60"
          >
            <RefreshCw size={11} />
          </button>
        )}
      </div>

      {/* State: idle */}
      {!score && !loading && !error && (
        <Button
          variant="outline"
          size="sm"
          onClick={analyze}
          className="h-8 w-full border-violet-400/35 bg-violet-400/8 text-[11px] text-violet-400 hover:bg-violet-400/[0.14] hover:text-violet-300"
        >
          <ScanText size={12} className="mr-1.5" />
          Analyze This Page
        </Button>
      )}

      {/* State: loading */}
      {loading && (
        <div className="flex items-center justify-center gap-2 py-2.5">
          <RefreshCw size={13} className="animate-spin text-violet-400" />
          <span className="text-[11px] text-white/45">Analyzing page…</span>
        </div>
      )}

      {/* State: error */}
      {error && !loading && (
        <div className="flex flex-col items-center gap-1.5">
          <p className="text-[10px] text-red-400">⚠ {error}</p>
          <Button
            variant="ghost"
            size="sm"
            onClick={analyze}
            className="h-6 text-[10px] text-white/50 hover:text-white/80"
          >
            Try again
          </Button>
        </div>
      )}

      {/* State: result */}
      {score && !loading && (
        <>
          <div className="flex items-center gap-3">
            <ScoreGauge score={score.overall} size={76} />
            <div className="flex-1">
              <SubScoreBar
                label="Readability"
                score={score.readability}
                icon="📖"
              />
              <SubScoreBar
                label="Visual Clarity"
                score={score.visualClutter}
                icon="🧹"
              />
            </div>
          </div>
          <FindingsList findings={score.findings} />
        </>
      )}
    </section>
  );
}
