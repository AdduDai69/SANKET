import React from 'react';
import { Landmark, TrendingUp, AlertTriangle, IndianRupee } from 'lucide-react';

interface MaintenanceEconomicsCardProps {
  totalMaintenanceCost: number;
  estimatedReplacementCost: number;
  potentialSavings: number;
  assetType: string;
}

export const MaintenanceEconomicsCard: React.FC<MaintenanceEconomicsCardProps> = ({
  totalMaintenanceCost,
  estimatedReplacementCost,
  potentialSavings,
  assetType,
}) => {
  const formatRupees = (val: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(val);
  };

  const costRatioPercent = Math.round(
    (totalMaintenanceCost / Math.max(1, estimatedReplacementCost)) * 100
  );

  const isExceeded = totalMaintenanceCost > estimatedReplacementCost;

  return (
    <div className="bg-white rounded-xl border border-stone-200 p-5 shadow-xs">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Landmark className="w-4 h-4 text-stone-700" />
          <h4 className="text-sm font-bold text-stone-900 font-serif">
            Maintenance Economics & Sunk Costs
          </h4>
        </div>
        <span
          className={`text-[11px] font-mono font-bold px-2 py-0.5 rounded border ${
            isExceeded
              ? 'bg-red-50 text-red-700 border-red-200'
              : 'bg-emerald-50 text-emerald-700 border-emerald-200'
          }`}
        >
          {costRatioPercent}% of Replacement
        </span>
      </div>

      {/* KPI Metrics */}
      <div className="grid grid-cols-3 gap-3 my-4">
        <div className="p-3 bg-stone-50 rounded-lg border border-stone-200">
          <div className="text-[11px] text-stone-500 font-mono">Spent to Date</div>
          <div className="text-base sm:text-lg font-bold text-stone-900 font-mono mt-0.5">
            {formatRupees(totalMaintenanceCost)}
          </div>
        </div>
        <div className="p-3 bg-stone-50 rounded-lg border border-stone-200">
          <div className="text-[11px] text-stone-500 font-mono">New Replacement</div>
          <div className="text-base sm:text-lg font-bold text-stone-900 font-mono mt-0.5">
            {formatRupees(estimatedReplacementCost)}
          </div>
        </div>
        <div className="p-3 bg-emerald-50 rounded-lg border border-emerald-200">
          <div className="text-[11px] text-emerald-700 font-mono font-medium">Net Savings</div>
          <div className="text-base sm:text-lg font-bold text-emerald-800 font-mono mt-0.5">
            {formatRupees(potentialSavings)}
          </div>
        </div>
      </div>

      {/* Economic Threshold Visualizer Bar */}
      <div className="space-y-1.5 mb-3">
        <div className="flex justify-between text-xs text-stone-600">
          <span>Replacement Cost Baseline (100%)</span>
          <span className="font-mono font-semibold">
            {costRatioPercent > 100 ? `+${costRatioPercent - 100}% Above Par` : 'Within Budget'}
          </span>
        </div>
        <div className="w-full bg-stone-200 rounded-full h-3 overflow-hidden relative">
          {/* Baseline threshold marker at 100% */}
          <div
            className={`h-full rounded-full transition-all duration-700 ${
              isExceeded ? 'bg-red-500' : 'bg-emerald-500'
            }`}
            style={{ width: `${Math.min(100, costRatioPercent)}%` }}
          />
        </div>
      </div>

      {/* Warning Callout if Exceeded */}
      {isExceeded && (
        <div className="p-3 rounded-lg bg-amber-50/80 border border-amber-200 text-xs text-amber-900 flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
          <div>
            <span className="font-semibold">Sunk Cost Warning: </span>
            Cumulative patching costs have surpassed initial capital procurement. Continued reactive
            maintenance yields negative public return.
          </div>
        </div>
      )}
    </div>
  );
};
