import React from 'react';
import { FailurePattern } from '../../types/civic';
import { AlertCircle, Clock, Zap, Activity } from 'lucide-react';

interface FailurePatternCardProps {
  failurePattern: FailurePattern;
  recurringComponent?: string;
  recurrenceCount: number;
}

export const FailurePatternCard: React.FC<FailurePatternCardProps> = ({
  failurePattern,
  recurringComponent,
  recurrenceCount,
}) => {
  return (
    <div className="bg-white rounded-xl border border-stone-200 p-5 shadow-xs">
      {/* Title */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-stone-700" />
          <h4 className="text-sm font-bold text-stone-900 font-serif">
            Failure Pattern & Interval Dynamics
          </h4>
        </div>
        {failurePattern.isFrequencyIncreasing && (
          <span className="inline-flex items-center gap-1 text-[11px] font-mono font-semibold px-2 py-0.5 rounded bg-red-100 text-red-800 border border-red-200 animate-pulse">
            <Zap className="w-3 h-3 text-red-600" />
            Accelerating Rhythm
          </span>
        )}
      </div>

      {/* Dynamic Summary Banner */}
      <div
        className={`p-3.5 rounded-lg border text-xs leading-relaxed mb-4 ${
          failurePattern.isFrequencyIncreasing
            ? 'bg-red-50/70 border-red-200 text-red-900'
            : 'bg-stone-50 border-stone-200 text-stone-700'
        }`}
      >
        <div className="flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
          <div>
            <span className="font-semibold">Acceleration Warning: </span>
            {failurePattern.trendText}
          </div>
        </div>
      </div>

      {/* Recidivist Component Callout */}
      {recurringComponent && (
        <div className="mb-4 p-3 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-900 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="font-semibold">Recurring Component Failure:</span>
            <span className="font-mono bg-amber-100/80 px-2 py-0.5 rounded text-amber-950 font-bold">
              {recurringComponent}
            </span>
          </div>
          <span className="font-mono font-semibold text-amber-800 text-[11px]">
            {recurrenceCount}x Recurrences
          </span>
        </div>
      )}

      {/* Interval Bar Visualizer */}
      <div className="space-y-3">
        <div className="flex items-center justify-between text-xs text-stone-500 font-mono">
          <span>Breakdown Interval History</span>
          <span>Time Between Failures (Shortening = Decay)</span>
        </div>

        <div className="space-y-2">
          {failurePattern.intervals.map((interval, idx) => {
            // Shorter interval represents higher urgency/severity
            const isLatest = idx === failurePattern.intervals.length - 1;
            const percentage = Math.max(15, Math.min(100, (interval.months / 24) * 100));

            return (
              <div key={idx} className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-stone-700 font-medium">
                    Cycle {idx + 1} ({interval.fromYear} → {interval.toYear})
                  </span>
                  <span
                    className={`font-mono font-bold ${
                      interval.months <= 9 ? 'text-red-700' : 'text-stone-700'
                    }`}
                  >
                    {interval.months} Months
                  </span>
                </div>
                <div className="w-full bg-stone-100 rounded-full h-3 overflow-hidden p-0.5 border border-stone-200">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      interval.months <= 8
                        ? 'bg-red-500'
                        : interval.months <= 12
                        ? 'bg-amber-500'
                        : 'bg-emerald-500'
                    }`}
                    style={{ width: `${percentage}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Micro Telemetry Footer */}
      <div className="mt-4 pt-3 border-t border-stone-100 flex items-center justify-between text-[11px] text-stone-500 font-mono">
        <span className="flex items-center gap-1">
          <Clock className="w-3.5 h-3.5 text-stone-400" />
          Total Failures: {failurePattern.totalFailures}
        </span>
        <span>
          Rhythm: {failurePattern.isFrequencyIncreasing ? 'Shortening by ~61%' : 'Stable'}
        </span>
      </div>
    </div>
  );
};
