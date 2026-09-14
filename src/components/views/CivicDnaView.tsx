import React, { useState, useMemo } from 'react';
import { useCivic } from '../../context/CivicContext';
import { CivicDnaAsset } from '../../types/civic';
import {
  Search,
  Filter,
  Layers,
  ShieldAlert,
  AlertTriangle,
  TrendingDown,
  Sparkles,
  ArrowUpRight,
  Landmark,
  Building,
  CheckCircle,
  Zap,
  Activity,
  SlidersHorizontal,
  LayoutGrid,
  List,
  MapPin,
} from 'lucide-react';

export const CivicDnaView: React.FC = () => {
  const {
    assets,
    openAssetProfile,
    assetSearch,
    setAssetSearch,
    assetDepartmentFilter,
    setAssetDepartmentFilter,
    assetRiskFilter,
    setAssetRiskFilter,
  } = useCivic();

  const [viewMode, setViewMode] = useState<'table' | 'grid'>('table');
  const [recommendationFilter, setRecommendationFilter] = useState<string>('all');

  const departments = [
    { id: 'all', label: 'All Departments' },
    { id: 'Street Lighting', label: 'Street Lighting' },
    { id: 'Roads & Infrastructure', label: 'Roads & Infra' },
    { id: 'Drainage', label: 'Drainage & Sewerage' },
    { id: 'Solid Waste', label: 'Solid Waste' },
  ];

  const filteredAssets = useMemo(() => {
    return assets.filter(a => {
      // Search
      if (assetSearch.trim()) {
        const q = assetSearch.toLowerCase();
        const match =
          a.assetId.toLowerCase().includes(q) ||
          a.assetName.toLowerCase().includes(q) ||
          a.location.toLowerCase().includes(q) ||
          a.sector.toLowerCase().includes(q);
        if (!match) return false;
      }

      // Department
      if (assetDepartmentFilter !== 'all') {
        if (!a.department.toLowerCase().includes(assetDepartmentFilter.toLowerCase())) {
          return false;
        }
      }

      // Risk
      if (assetRiskFilter !== 'all') {
        if (assetRiskFilter === 'high' && a.currentRiskScore < 70) return false;
        if (assetRiskFilter === 'medium' && (a.currentRiskScore < 50 || a.currentRiskScore >= 70))
          return false;
        if (assetRiskFilter === 'low' && a.currentRiskScore >= 50) return false;
      }

      // Recommendation
      if (recommendationFilter !== 'all') {
        if (
          recommendationFilter === 'replace' &&
          !a.recommendation.action.startsWith('REPLACE')
        )
          return false;
        if (
          recommendationFilter === 'repair' &&
          a.recommendation.action !== 'REPAIR'
        )
          return false;
      }

      return true;
    });
  }, [assets, assetSearch, assetDepartmentFilter, assetRiskFilter, recommendationFilter]);

  const formatRupees = (val: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(val);
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto animate-fade-in">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-stone-200">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-mono uppercase tracking-widest font-bold text-stone-500 bg-stone-100 px-2 py-0.5 rounded border border-stone-200">
              Municipal Asset Registry
            </span>
            <span className="text-xs font-mono px-2 py-0.5 rounded-full font-bold bg-amber-100 text-amber-900 border border-amber-200 flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-amber-600" />
              Civic DNA Intelligence
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-stone-900 font-serif tracking-tight">
            Persistent Infrastructure Intelligence
          </h1>
          <p className="text-xs sm:text-sm text-stone-600 mt-1 max-w-2xl font-sans">
            Every municipal fixture holds a persistent digital identity, failure rhythm telemetry, and
            economic cost-benefit analytics to prevent infinite repeat patch-repairs.
          </p>
        </div>

        {/* Quick Action / Demo Signature Button */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => openAssetProfile('S35-L092')}
            className="px-3.5 py-2 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-mono text-xs font-semibold flex items-center gap-2 shadow-xs transition-colors"
          >
            <Sparkles className="w-4 h-4 text-amber-200" />
            <span>Demo Signature: #S35-L092</span>
          </button>
        </div>
      </div>

      {/* Top 5 KPI Metrics Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <div className="bg-white p-4 rounded-xl border border-stone-200 shadow-xs">
          <div className="flex items-center justify-between text-xs text-stone-500 font-mono">
            <span>Tracked Assets</span>
            <Layers className="w-4 h-4 text-stone-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-stone-900 mt-1">2,481</div>
          <div className="text-[11px] text-stone-400 mt-0.5">Across 56 Sectors</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-stone-200 shadow-xs">
          <div className="flex items-center justify-between text-xs text-stone-500 font-mono">
            <span>High-Risk Assets</span>
            <ShieldAlert className="w-4 h-4 text-red-500" />
          </div>
          <div className="text-2xl font-bold font-mono text-red-600 mt-1">187</div>
          <div className="text-[11px] text-red-700/80 mt-0.5">Risk &gt; 70%</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-stone-200 shadow-xs">
          <div className="flex items-center justify-between text-xs text-stone-500 font-mono">
            <span>Accelerating Rhythm</span>
            <Zap className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-2xl font-bold font-mono text-amber-600 mt-1">63</div>
          <div className="text-[11px] text-stone-500 mt-0.5">Shortening intervals</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-stone-200 shadow-xs">
          <div className="flex items-center justify-between text-xs text-stone-500 font-mono">
            <span>Replace Advised</span>
            <AlertTriangle className="w-4 h-4 text-stone-500" />
          </div>
          <div className="text-2xl font-bold font-mono text-stone-900 mt-1">28</div>
          <div className="text-[11px] text-stone-500 mt-0.5">Component / Unit</div>
        </div>

        <div className="bg-emerald-50/60 p-4 rounded-xl border border-emerald-200 shadow-xs col-span-2 sm:col-span-1">
          <div className="flex items-center justify-between text-xs text-emerald-700 font-mono">
            <span>Potential Savings</span>
            <Landmark className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-bold font-mono text-emerald-800 mt-1">₹18.4 L</div>
          <div className="text-[11px] text-emerald-600 mt-0.5">Vs continued repairs</div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-stone-200 shadow-xs space-y-3">
        <div className="flex flex-col md:flex-row gap-3">
          {/* Search Input */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-stone-400 absolute left-3 top-3" />
            <input
              type="text"
              value={assetSearch}
              onChange={e => setAssetSearch(e.target.value)}
              placeholder="Search by Asset ID (e.g. S35-L092), Name, Sector (e.g. Sector 35)..."
              className="w-full pl-9 pr-4 py-2 text-xs bg-stone-50 border border-stone-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-stone-400 font-sans"
            />
          </div>

          {/* Risk Level Filter */}
          <select
            value={assetRiskFilter}
            onChange={e => setAssetRiskFilter(e.target.value)}
            className="text-xs bg-stone-50 border border-stone-200 rounded-lg px-3 py-2 font-mono"
          >
            <option value="all">All Risk Tiers</option>
            <option value="high">Critical / High Risk (&gt;70%)</option>
            <option value="medium">Medium Risk (50-69%)</option>
            <option value="low">Low Risk (&lt;50%)</option>
          </select>

          {/* Recommendation Filter */}
          <select
            value={recommendationFilter}
            onChange={e => setRecommendationFilter(e.target.value)}
            className="text-xs bg-stone-50 border border-stone-200 rounded-lg px-3 py-2 font-mono"
          >
            <option value="all">All Recommendations</option>
            <option value="replace">Replacement Advised</option>
            <option value="repair">Patch Repair Suitable</option>
          </select>

          {/* View Mode Toggle */}
          <div className="flex items-center border border-stone-200 rounded-lg overflow-hidden shrink-0">
            <button
              onClick={() => setViewMode('table')}
              className={`p-2 transition-colors ${
                viewMode === 'table' ? 'bg-stone-900 text-white' : 'bg-stone-50 text-stone-600'
              }`}
              title="Table View"
            >
              <List className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('grid')}
              className={`p-2 transition-colors ${
                viewMode === 'grid' ? 'bg-stone-900 text-white' : 'bg-stone-50 text-stone-600'
              }`}
              title="Grid View"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Department Tabs */}
        <div className="flex items-center gap-2 overflow-x-auto pt-1 border-t border-stone-100 text-xs">
          {departments.map(dept => (
            <button
              key={dept.id}
              onClick={() => setAssetDepartmentFilter(dept.id)}
              className={`px-3 py-1 rounded-full font-medium transition-colors shrink-0 ${
                assetDepartmentFilter === dept.id
                  ? 'bg-stone-900 text-white shadow-xs'
                  : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
              }`}
            >
              {dept.label}
            </button>
          ))}
        </div>
      </div>

      {/* Asset List Content */}
      {viewMode === 'table' ? (
        <div className="bg-white rounded-xl border border-stone-200 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-stone-50/80 border-b border-stone-200 text-stone-500 font-mono uppercase text-[10px]">
                  <th className="py-3 px-4">Asset ID & Details</th>
                  <th className="py-3 px-4">Sector & Dept</th>
                  <th className="py-3 px-4 text-center">Health</th>
                  <th className="py-3 px-4 text-center">Risk Tier</th>
                  <th className="py-3 px-4 text-center">Failures</th>
                  <th className="py-3 px-4">Spend vs Replace</th>
                  <th className="py-3 px-4">Recommendation</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-200">
                {filteredAssets.map(asset => {
                  const isSignature = asset.assetId === 'S35-L092';
                  const isAccelerating = asset.failurePattern?.isFrequencyIncreasing;
                  const isReplace = asset.recommendation.action.startsWith('REPLACE');

                  return (
                    <tr
                      key={asset.assetId}
                      className={`hover:bg-stone-50/80 transition-colors ${
                        isSignature ? 'bg-amber-50/30 font-medium' : ''
                      }`}
                    >
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-stone-900 text-xs">
                            #{asset.assetId}
                          </span>
                          {isSignature && (
                            <span className="bg-amber-100 text-amber-900 text-[10px] font-mono px-1.5 py-0.2 rounded font-bold border border-amber-300">
                              Demo Focus
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-stone-700 font-medium line-clamp-1">
                          {asset.assetName}
                        </div>
                        <div className="text-[11px] text-stone-400 font-mono">
                          Installed {asset.installationYear} ({asset.ageYears}y)
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="text-xs font-semibold text-stone-800">{asset.sector}</div>
                        <div className="text-[11px] text-stone-500">{asset.department}</div>
                      </td>

                      <td className="py-3.5 px-4 text-center">
                        <span
                          className={`inline-block font-mono font-bold px-2 py-0.5 rounded text-xs ${
                            asset.currentHealthScore >= 75
                              ? 'bg-emerald-100 text-emerald-800'
                              : asset.currentHealthScore >= 60
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-red-100 text-red-800'
                          }`}
                        >
                          {asset.currentHealthScore}/100
                        </span>
                      </td>

                      <td className="py-3.5 px-4 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <span
                            className={`font-mono font-bold text-xs ${
                              asset.currentRiskScore >= 70
                                ? 'text-red-600'
                                : asset.currentRiskScore >= 50
                                ? 'text-amber-600'
                                : 'text-stone-600'
                            }`}
                          >
                            {asset.currentRiskScore}%
                          </span>
                          {isAccelerating && (
                            <span title="Accelerating Failure Rhythm">
                              <Zap className="w-3 h-3 text-red-500 shrink-0" />
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="py-3.5 px-4 text-center font-mono text-xs">
                        <span className="font-bold text-stone-800">{asset.failureCount}</span>
                        <span className="text-stone-400"> / {asset.totalComplaints} rep</span>
                      </td>

                      <td className="py-3.5 px-4 font-mono text-xs">
                        <div className="text-stone-900 font-semibold">
                          {formatRupees(asset.totalMaintenanceCost)}
                        </div>
                        <div className="text-[11px] text-stone-400">
                          repl: {formatRupees(asset.estimatedReplacementCost)}
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-flex items-center gap-1 text-[11px] font-mono font-bold px-2 py-0.5 rounded border ${
                            isReplace
                              ? 'bg-amber-50 text-amber-900 border-amber-200'
                              : 'bg-stone-100 text-stone-700 border-stone-200'
                          }`}
                        >
                          {asset.recommendation.action.replace('_', ' ')}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        <button
                          onClick={() => openAssetProfile(asset.assetId)}
                          className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-stone-900 text-white hover:bg-stone-800 transition-colors inline-flex items-center gap-1"
                        >
                          <span>View DNA</span>
                          <ArrowUpRight className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* Grid View */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredAssets.map(asset => {
            const isSignature = asset.assetId === 'S35-L092';
            const isReplace = asset.recommendation.action.startsWith('REPLACE');

            return (
              <div
                key={asset.assetId}
                className={`bg-white rounded-xl border p-5 shadow-xs hover:shadow-md transition-all flex flex-col justify-between ${
                  isSignature ? 'border-amber-400 ring-2 ring-amber-200/50' : 'border-stone-200'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="font-mono text-xs font-bold text-stone-600 bg-stone-100 px-2 py-0.5 rounded">
                      #{asset.assetId}
                    </span>
                    <span
                      className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full ${
                        asset.currentHealthScore >= 75
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      Health: {asset.currentHealthScore}/100
                    </span>
                  </div>

                  <h3 className="text-base font-bold text-stone-900 font-serif line-clamp-1">
                    {asset.assetName}
                  </h3>
                  <p className="text-xs text-stone-500 mt-0.5 flex items-center gap-1">
                    <MapPin className="w-3 h-3" />
                    <span>{asset.location}</span>
                  </p>

                  <div className="my-3 p-3 bg-stone-50 rounded-lg border border-stone-150 space-y-1 text-xs">
                    <div className="flex justify-between">
                      <span className="text-stone-500">Department:</span>
                      <span className="font-medium text-stone-800">{asset.department}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-stone-500">Cumulative Spend:</span>
                      <span className="font-mono font-bold text-stone-900">
                        {formatRupees(asset.totalMaintenanceCost)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-stone-500">Replacement Cost:</span>
                      <span className="font-mono text-stone-600">
                        {formatRupees(asset.estimatedReplacementCost)}
                      </span>
                    </div>
                  </div>

                  <div className="text-xs text-stone-600 bg-amber-50/70 p-2.5 rounded border border-amber-200">
                    <span className="font-semibold text-stone-900">Recommendation: </span>
                    {asset.recommendation.title}
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-stone-100 flex items-center justify-between">
                  <span className="text-xs text-stone-400 font-mono">
                    {asset.events.length} Telemetry Events
                  </span>
                  <button
                    onClick={() => openAssetProfile(asset.assetId)}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-stone-900 text-white hover:bg-stone-800 transition-colors inline-flex items-center gap-1"
                  >
                    <span>Inspect Profile</span>
                    <ArrowUpRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
