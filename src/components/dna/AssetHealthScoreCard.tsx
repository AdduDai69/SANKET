import React, { useState } from 'react';
import { AssetHealthBreakdown, AssetRiskBreakdown } from '../../types/civic';
import { Shield, ChevronDown, ChevronUp, Info, AlertOctagon } from 'lucide-react';

interface AssetHealthScoreCardProps {
  healthScore: number;
  riskScore: number;
  healthBreakdown: AssetHealthBreakdown;
  riskBreakdown: AssetRiskBreakdown;
}

export const AssetHealthScoreCard: React.FC<AssetHealthScoreCardProps> = ({
  healthScore,
  riskScore,
  healthBreakdown,
  riskBreakdown,
}) => {
  const [showExplanation, setShowExplanation] = useState<boolean>(true);

  // Health score color scheme
  const getHealthColor = (score: number) => {
    if (score >= 75) return { bg: 'bg-emerald-500', text: 'text-emerald-700', badge: 'bg-emerald-100 text-emerald-800', label: 'Robust' };
    if (score >= 60) return { bg: 'bg-amber-500', text: 'text-amber-700', badge: 'bg-amber-100 text-amber-800', label: 'Degraded' };
    return { bg: 'bg-red-500', text: 'text-red-700', badge: 'bg-red-100 text-red-800', label: 'Critical' };
  };

  const healthStyle = getHealthColor(healthScore);

  return (
    <div className="bg-white rounded-xl border border-stone-200 p-5 shadow-xs">
      {/* Header with dual scores */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-stone-200">
        <div className="flex items-center gap-3">
          <div className="relative w-16 h-16 rounded-full border-4 border-stone-100 flex items-center justify-center bg-stone-50">
            <span className={`text-2xl font-black font-mono ${healthStyle.text}`}>
              {healthScore}
            </span>
            <div
              className={`absolute -top-1 -right-1 w-4 h-4 rounded-full border-2 border-white ${healthStyle.bg}`}
            />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h4 className="text-base font-bold text-stone-900 font-serif">
                Civic Health Score
              </h4>
              <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full ${healthStyle.badge}`}>
                {healthStyle.label}
              </span>
            </div>
            <p className="text-xs text-stone-500 mt-0.5 font-sans">
              Objective 0–100 infrastructure condition index
            </p>
          </div>
        </div>

        {/* Predictive Risk Metric */}
        <div className="flex items-center gap-3 bg-stone-50 px-3.5 py-2 rounded-lg border border-stone-200">
          <AlertOctagon className="w-5 h-5 text-red-600 shrink-0" />
          <div>
            <div className="text-[10px] uppercase font-mono tracking-wider font-bold text-stone-500">
              Predictive Risk
            </div>
            <div className="text-sm font-bold text-stone-900 font-mono">
              {riskScore}% Risk &bull;{' '}
              <span className="text-red-700 uppercase">{riskBreakdown.riskLevel}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Why this score toggle */}
      <div className="pt-4">
        <button
          onClick={() => setShowExplanation(!showExplanation)}
          className="w-full flex items-center justify-between text-xs font-semibold text-stone-700 hover:text-stone-900 py-1.5 transition-colors"
        >
          <span className="flex items-center gap-1.5 font-mono">
            <Info className="w-3.5 h-3.5 text-stone-500" />
            Why This Health Score? (Explainable Breakdown)
          </span>
          {showExplanation ? (
            <ChevronUp className="w-4 h-4 text-stone-400" />
          ) : (
            <ChevronDown className="w-4 h-4 text-stone-400" />
          )}
        </button>

        {showExplanation && (
          <div className="mt-3 space-y-3 pt-2">
            <p className="text-xs text-stone-600 italic bg-stone-50 p-3 rounded-lg border border-stone-200">
              &ldquo;{healthBreakdown.explanation}&rdquo;
            </p>

            {/* Factor Bars */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <div className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-stone-600">Age & Lifecycle Depreciation</span>
                  <span className="font-mono font-bold text-stone-800">
                    {healthBreakdown.ageScore}/100
                  </span>
                </div>
                <div className="w-full bg-stone-100 rounded-full h-1.5 overflow-hidden">
                  <div
                    className="bg-stone-600 h-full rounded-full"
                    style={{ width: `${healthBreakdown.ageScore}%` }}
                  />
                </div>
              </div>

              <div className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-stone-600">Failure History Penalty</span>
                  <span className="font-mono font-bold text-stone-800">
                    {healthBreakdown.failureHistoryScore}/100
                  </span>
                </div>
                <div className="w-full bg-stone-100 rounded-full h-1.5 overflow-hidden">
                  <div
                    className="bg-red-500 h-full rounded-full"
                    style={{ width: `${healthBreakdown.failureHistoryScore}%` }}
                  />
                </div>
              </div>

              <div className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-stone-600">Recurrence Rhythm</span>
                  <span className="font-mono font-bold text-stone-800">
                    {healthBreakdown.recurrenceScore}/100
                  </span>
                </div>
                <div className="w-full bg-stone-100 rounded-full h-1.5 overflow-hidden">
                  <div
                    className="bg-amber-500 h-full rounded-full"
                    style={{ width: `${healthBreakdown.recurrenceScore}%` }}
                  />
                </div>
              </div>

              <div className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-stone-600">Maintenance Cost Burden</span>
                  <span className="font-mono font-bold text-stone-800">
                    {healthBreakdown.maintenanceCostScore}/100
                  </span>
                </div>
                <div className="w-full bg-stone-100 rounded-full h-1.5 overflow-hidden">
                  <div
                    className="bg-amber-600 h-full rounded-full"
                    style={{ width: `${healthBreakdown.maintenanceCostScore}%` }}
                  />
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
