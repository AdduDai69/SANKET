import React from 'react';
import { useCivic } from '../../context/CivicContext';
import { CivicMap } from '../common/CivicMap';
import {
  RiskBadge,
  ConfidenceBadge,
  StatusBadge,
  CategoryBadge,
  DemoBadge
} from '../common/Badges';
import {
  Flame,
  Clock,
  History,
  ShieldCheck,
  ChevronRight,
  ArrowRight,
  Filter,
  CheckCircle2,
  AlertCircle,
  Sparkles,
} from 'lucide-react';

export const DashboardView: React.FC = () => {
  const {
    incidents,
    selectIncident,
    selectedIncidentId,
    setActiveTab,
    setQueueFilter,
    assets,
    openAssetProfile,
  } = useCivic();

  // Attention summary figures
  const highRiskIncidents = incidents.filter((i) => i.riskScore >= 70 && i.status !== 'resolved');
  const urgentCount = incidents.filter((i) => i.riskScore >= 80 && i.status !== 'resolved').length;
  const waitingTooLongIncidents = incidents.filter((i) => i.waitingDays >= 20 && i.status !== 'resolved');
  const crossedSlaCount = incidents.filter((i) => i.waitingDays >= 30 && i.status !== 'resolved').length;
  const recurringCount = incidents.filter((i) => i.isRecurring).length;

  // Average confidence across active incidents
  const avgConfidence = Math.round(
    incidents.reduce((acc, curr) => acc + curr.confidenceScore, 0) / incidents.length
  );

  // Top attention list (sorted by risk desc)
  const needsAttentionList = [...incidents]
    .filter((i) => i.status !== 'resolved')
    .sort((a, b) => b.riskScore - a.riskScore)
    .slice(0, 5);

  return (
    <div className="space-y-6 text-left animate-fade-in">
      {/* Top Greeting & Operational Statement */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-[#E5E3DC]">
        <div>
          <h1 className="text-2xl font-black text-[#191B1F] tracking-tight">
            Good morning, Officer.
          </h1>
          <p className="text-xs sm:text-sm text-[#565C68] mt-0.5">
            Here's what needs attention across your city today.
          </p>
        </div>
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <DemoBadge label="MUNICIPAL COMMAND FEED" />
          <span className="text-xs font-mono text-[#7E8592]">
            Sep 9, 2026 • 22:35
          </span>
        </div>
      </div>

      {/* ========================================================= */}
      {/* 4 ATTENTION SUMMARY CARDS (Clickable triggers)            */}
      {/* ========================================================= */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        {/* Card 1: High-Risk Incidents */}
        <div
          onClick={() => {
            setQueueFilter('high_risk');
            setActiveTab('priority_queue');
          }}
          className="p-4 rounded-xl bg-white border border-[#E5E3DC] hover:border-[#C54E38]/50 hover:shadow-md transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[#7E8592] uppercase tracking-wider">
              High-Risk Incidents
            </span>
            <div className="w-7 h-7 rounded-lg bg-[#FDF0ED] text-[#C54E38] flex items-center justify-center group-hover:scale-110 transition-transform">
              <Flame className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-3xl font-black font-mono text-[#C54E38]">
              {highRiskIncidents.length}
            </span>
            <span className="text-xs text-[#7E8592] font-semibold">Active</span>
          </div>
          <p className="text-xs text-[#C54E38] font-medium mt-1">
            {urgentCount} require immediate dispatch
          </p>
          <div className="mt-3 pt-2 border-t border-[#F4F3EF] flex items-center justify-between text-[11px] text-[#7E8592]">
            <span>Filter Priority Queue</span>
            <ArrowRight className="w-3 h-3 group-hover:translate-x-1 transition-transform text-[#C54E38]" />
          </div>
        </div>

        {/* Card 2: Waiting Too Long */}
        <div
          onClick={() => {
            setQueueFilter('waiting_too_long');
            setActiveTab('priority_queue');
          }}
          className="p-4 rounded-xl bg-white border border-[#E5E3DC] hover:border-[#C88427]/50 hover:shadow-md transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[#7E8592] uppercase tracking-wider">
              Waiting Too Long
            </span>
            <div className="w-7 h-7 rounded-lg bg-[#FDF6EC] text-[#C88427] flex items-center justify-center group-hover:scale-110 transition-transform">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-3xl font-black font-mono text-[#191B1F]">
              {waitingTooLongIncidents.length}
            </span>
            <span className="text-xs text-[#7E8592] font-semibold">&gt;20 Days</span>
          </div>
          <p className="text-xs text-[#C88427] font-medium mt-1">
            {crossedSlaCount} crossed aging SLA threshold
          </p>
          <div className="mt-3 pt-2 border-t border-[#F4F3EF] flex items-center justify-between text-[11px] text-[#7E8592]">
            <span>View Aging Audit</span>
            <ArrowRight className="w-3 h-3 group-hover:translate-x-1 transition-transform text-[#C88427]" />
          </div>
        </div>

        {/* Card 3: Recurring Locations */}
        <div
          onClick={() => {
            setActiveTab('civic_memory');
          }}
          className="p-4 rounded-xl bg-white border border-[#E5E3DC] hover:border-[#2C5E48]/50 hover:shadow-md transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[#7E8592] uppercase tracking-wider">
              Recurring Locations
            </span>
            <div className="w-7 h-7 rounded-lg bg-[#EBF3EE] text-[#2C5E48] flex items-center justify-center group-hover:scale-110 transition-transform">
              <History className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-3xl font-black font-mono text-[#191B1F]">
              {recurringCount}
            </span>
            <span className="text-xs text-[#7E8592] font-semibold">Sites</span>
          </div>
          <p className="text-xs text-[#565C68] font-medium mt-1">
            Infrastructure failures detected repeatedly
          </p>
          <div className="mt-3 pt-2 border-t border-[#F4F3EF] flex items-center justify-between text-[11px] text-[#7E8592]">
            <span>Open Civic Memory</span>
            <ArrowRight className="w-3 h-3 group-hover:translate-x-1 transition-transform text-[#2C5E48]" />
          </div>
        </div>

        {/* Card 4: Avg. Confidence */}
        <div
          onClick={() => {
            setActiveTab('incidents');
          }}
          className="p-4 rounded-xl bg-white border border-[#E5E3DC] hover:border-[#1E6B42]/50 hover:shadow-md transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[#7E8592] uppercase tracking-wider">
              Avg. Confidence
            </span>
            <div className="w-7 h-7 rounded-lg bg-[#EBF7EF] text-[#1E6B42] flex items-center justify-center group-hover:scale-110 transition-transform">
              <ShieldCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-3xl font-black font-mono text-[#1E6B42]">
              {avgConfidence}%
            </span>
            <span className="text-xs text-[#7E8592] font-semibold">Corroboration</span>
          </div>
          <p className="text-xs text-[#565C68] font-medium mt-1">
            Across 30 active civic signals
          </p>
          <div className="mt-3 pt-2 border-t border-[#F4F3EF] flex items-center justify-between text-[11px] text-[#7E8592]">
            <span>View Signal Telemetry</span>
            <ArrowRight className="w-3 h-3 group-hover:translate-x-1 transition-transform text-[#1E6B42]" />
          </div>
        </div>
      </div>

      {/* ========================================================= */}
      {/* MAIN DASHBOARD: LIVE CIVIC MAP + NEEDS ATTENTION LIST     */}
      {/* ========================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left / Center: Live Civic Map (7 Cols) */}
        <div className="lg:col-span-7 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-[#2C5E48]"></span>
              <h2 className="text-xs font-bold text-[#191B1F] uppercase tracking-wider">
                Live Civic Map • Spatial Intelligence
              </h2>
            </div>
            <button
              onClick={() => setActiveTab('map_view')}
              className="text-xs font-bold text-[#2C5E48] hover:underline flex items-center gap-1"
            >
              <span>Full Screen Map</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <CivicMap
            incidents={incidents}
            selectedIncidentId={selectedIncidentId}
            height="460px"
          />
        </div>

        {/* Right: Needs Attention List (5 Cols) */}
        <div className="lg:col-span-5 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-[#C54E38]"></span>
              <h2 className="text-xs font-bold text-[#191B1F] uppercase tracking-wider">
                Needs Attention
              </h2>
            </div>
            <span className="text-xs text-[#7E8592] font-mono">
              Top 5 Urgent
            </span>
          </div>

          <div className="bg-white rounded-xl border border-[#E5E3DC] divide-y divide-[#F4F3EF] overflow-hidden shadow-xs">
            {needsAttentionList.map((inc) => {
              const isSelected = inc.id === selectedIncidentId;
              return (
                <div
                  key={inc.id}
                  onClick={() => selectIncident(inc.id, true)}
                  className={`p-3.5 hover:bg-[#FBFBF9] cursor-pointer transition-colors ${
                    isSelected ? 'bg-[#FAF9F5] border-l-4 border-[#C54E38]' : ''
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <CategoryBadge category={inc.category} />
                        {inc.isRecurring && (
                          <span className="text-[10px] font-bold text-[#C88427] bg-[#FDF6EC] px-1.5 py-0.2 rounded border border-[#F9E8CE]">
                            RECURRING
                          </span>
                        )}
                      </div>
                      <h3 className="text-xs font-bold text-[#191B1F] truncate">
                        {inc.title}
                      </h3>
                      <p className="text-[11px] text-[#565C68] mt-0.5 truncate">
                        {inc.sector} • {inc.location}
                      </p>
                    </div>

                    <div className="text-right shrink-0">
                      <RiskBadge score={inc.riskScore} size="sm" showLabel={false} />
                      <span className="block text-[11px] font-mono text-[#7E8592] mt-1">
                        {inc.waitingDays}d waiting
                      </span>
                    </div>
                  </div>

                  <div className="mt-2.5 flex items-center justify-between text-[11px] text-[#7E8592] pt-2 border-t border-[#FAF9F5]">
                    <StatusBadge status={(inc.assignmentStatus === 'Completed' || inc.status === 'resolved' || (inc as any).status === 'closed') ? 'resolved' : inc.status} />
                    <span className="text-[#2C5E48] font-bold group-hover:underline flex items-center gap-0.5">
                      Investigate <ChevronRight className="w-3 h-3" />
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          <button
            onClick={() => setActiveTab('incidents')}
            className="w-full py-2.5 text-center rounded-xl bg-[#F4F3EF] hover:bg-[#ECEAE3] border border-[#E5E3DC] text-xs font-bold text-[#191B1F] transition-colors"
          >
            View All 30 Incidents in Data Table →
          </button>
        </div>
      </div>

      {/* ========================================================= */}
      {/* CIVIC DNA INTELLIGENCE: PERSISTENT INFRASTRUCTURE LAYER   */}
      {/* ========================================================= */}
      <div className="bg-white rounded-xl border border-[#E5E3DC] p-5 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-[#E5E3DC]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-900 flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-amber-700" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold text-[#191B1F] uppercase font-serif tracking-tight">
                  Civic DNA &bull; Persistent Infrastructure Intelligence
                </h2>
                <span className="text-[10px] font-mono font-bold bg-amber-100 text-amber-900 px-2 py-0.5 rounded-full border border-amber-300">
                  NEW
                </span>
              </div>
              <p className="text-xs text-[#565C68] mt-0.5">
                Lifecycle telemetry and repair-vs-replace economics for tracked municipal fixtures.
              </p>
            </div>
          </div>

          <button
            onClick={() => setActiveTab('civic_dna')}
            className="px-3 py-1.5 rounded-lg bg-stone-900 hover:bg-stone-800 text-white text-xs font-semibold flex items-center gap-1.5 self-start sm:self-auto transition-colors"
          >
            <span>Open Civic DNA Hub</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Highlight Grid: Top 3 Stressed Assets */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
          {assets.slice(0, 3).map((asset) => {
            const isSignature = asset.assetId === 'S35-L092';
            return (
              <div
                key={asset.assetId}
                onClick={() => openAssetProfile(asset.assetId)}
                className={`p-4 rounded-xl border transition-all cursor-pointer hover:shadow-md ${
                  isSignature
                    ? 'border-amber-400 bg-amber-50/40 ring-1 ring-amber-300/60'
                    : 'border-[#E5E3DC] bg-stone-50/40 hover:bg-stone-50'
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className="font-mono text-xs font-bold text-stone-900 bg-white px-2 py-0.5 rounded border border-stone-200">
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

                <h3 className="text-xs font-bold text-stone-900 truncate">
                  {asset.assetName}
                </h3>
                <p className="text-[11px] text-stone-500 mt-0.5 truncate">
                  {asset.location} &bull; {asset.department}
                </p>

                <div className="my-2.5 pt-2 border-t border-stone-200/60 flex items-center justify-between text-xs font-mono">
                  <span className="text-stone-500">Spent: ₹{asset.totalMaintenanceCost.toLocaleString('en-IN')}</span>
                  <span className="font-semibold text-amber-900">
                    {asset.recommendation.action.replace('_', ' ')}
                  </span>
                </div>

                <div className="text-[11px] font-semibold text-stone-900 flex items-center justify-between">
                  <span className="text-stone-500 font-mono text-[10px]">{asset.events.length} lifecycle events</span>
                  <span className="text-stone-900 hover:underline flex items-center gap-0.5">
                    View DNA <ChevronRight className="w-3 h-3" />
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
