import React from 'react';
import { AssetRecommendation } from '../../types/civic';
import { CheckCircle, AlertTriangle, ArrowRight, ShieldAlert, Sparkles, TrendingUp } from 'lucide-react';

interface RepairVsReplaceCardProps {
  recommendation: AssetRecommendation;
  assetName: string;
  assetNumber: string;
  totalMaintenanceCost: number;
}

export const RepairVsReplaceCard: React.FC<RepairVsReplaceCardProps> = ({
  recommendation,
  assetName,
  assetNumber,
  totalMaintenanceCost,
}) => {
  const isReplace =
    recommendation.action === 'REPLACE_COMPONENT' ||
    recommendation.action === 'REPLACE_ASSET';

  const formatRupees = (val: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(val);
  };

  return (
    <div className="bg-white rounded-xl border-2 border-stone-200 overflow-hidden shadow-sm hover:shadow-md transition-shadow">
      {/* Header Banner */}
      <div
        className={`px-5 py-4 border-b flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 ${
          isReplace
            ? 'bg-amber-50/80 border-amber-200'
            : 'bg-emerald-50/80 border-emerald-200'
        }`}
      >
        <div className="flex items-center gap-3">
          <div
            className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${
              isReplace ? 'bg-amber-600 text-white' : 'bg-emerald-700 text-white'
            }`}
          >
            {isReplace ? (
              <ShieldAlert className="w-5 h-5" />
            ) : (
              <CheckCircle className="w-5 h-5" />
            )}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-mono uppercase tracking-wider font-bold text-stone-500">
                Civic Decision Engine
              </span>
              <span
                className={`text-[10px] font-mono px-2 py-0.5 rounded-full font-bold uppercase ${
                  isReplace
                    ? 'bg-amber-200/70 text-amber-900'
                    : 'bg-emerald-200/70 text-emerald-900'
                }`}
              >
                {recommendation.confidence}% Confidence
              </span>
            </div>
            <h3 className="text-base font-bold text-stone-900 font-serif">
              {recommendation.title}
            </h3>
          </div>
        </div>

        {/* Action Badge */}
        <div className="inline-flex items-center gap-1.5 self-start sm:self-auto px-3 py-1 rounded-full text-xs font-semibold bg-stone-900 text-white shadow-xs">
          <Sparkles className="w-3.5 h-3.5 text-amber-300" />
          <span>{recommendation.action.replace('_', ' ')}</span>
        </div>
      </div>

      {/* Rationale Callout */}
      <div className="p-5 space-y-4">
        <p className="text-sm text-stone-700 leading-relaxed font-sans bg-stone-50 p-3.5 rounded-lg border border-stone-200">
          <span className="font-semibold text-stone-900">Deterministic Rationale: </span>
          {recommendation.reason}
        </p>

        {/* Dual Option Comparison Matrix */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
          {/* Option A: Repair Again */}
          <div className="p-4 rounded-xl border border-stone-200 bg-stone-50/50 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-stone-500 font-mono">
                  Option A: Patch Repair
                </span>
                <span className="text-[11px] font-medium text-stone-500 bg-stone-200/60 px-2 py-0.5 rounded">
                  Interim Fix
                </span>
              </div>
              <div className="text-xl font-bold text-stone-800 font-mono">
                {formatRupees(recommendation.repairCost)}
              </div>
              <p className="text-xs text-stone-500 mt-1">
                Typical single-incident repair expenditure
              </p>
            </div>

            <div className="mt-4 pt-3 border-t border-stone-200 text-xs space-y-1.5">
              <div className="flex justify-between">
                <span className="text-stone-600">Expected Life Extension:</span>
                <span className="font-semibold text-amber-700">
                  ~{recommendation.repairExpectedLifeMonths} Months
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-stone-600">Recidivism Probability:</span>
                <span className="font-semibold text-red-600">High (&gt;75%)</span>
              </div>
            </div>
          </div>

          {/* Option B: Replacement */}
          <div
            className={`p-4 rounded-xl border-2 flex flex-col justify-between ${
              isReplace
                ? 'border-emerald-500/80 bg-emerald-50/40 shadow-xs'
                : 'border-stone-200 bg-stone-50/50'
            }`}
          >
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-emerald-800 font-mono flex items-center gap-1">
                  Option B: Replacement
                  {isReplace && <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />}
                </span>
                <span className="text-[11px] font-bold text-emerald-900 bg-emerald-100 px-2 py-0.5 rounded">
                  Recommended
                </span>
              </div>
              <div className="text-xl font-bold text-emerald-800 font-mono">
                {formatRupees(recommendation.replacementCost)}
              </div>
              <p className="text-xs text-stone-600 mt-1">
                {recommendation.recurringComponent
                  ? `Targeted subassembly: ${recommendation.recurringComponent}`
                  : 'New unit replacement cost'}
              </p>
            </div>

            <div className="mt-4 pt-3 border-t border-emerald-200 text-xs space-y-1.5">
              <div className="flex justify-between">
                <span className="text-stone-600">Expected Life Extension:</span>
                <span className="font-semibold text-emerald-800">
                  ~{recommendation.replaceExpectedLifeYears} Years
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-stone-600">Projected Net Savings:</span>
                <span className="font-bold text-emerald-700 font-mono">
                  {formatRupees(recommendation.expectedSavings)}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Economic Takeaway Pill */}
        <div className="flex items-center gap-2 text-xs text-stone-600 bg-stone-100/80 px-3.5 py-2.5 rounded-lg">
          <TrendingUp className="w-4 h-4 text-emerald-700 shrink-0" />
          <span>
            Cumulative past maintenance ({formatRupees(totalMaintenanceCost)}) already exceeds
            replacement threshold. Replacement eliminates recurring breakdown cycle.
          </span>
        </div>
      </div>
    </div>
  );
};
