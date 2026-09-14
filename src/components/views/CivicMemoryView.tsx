import React, { useState } from 'react';
import { useCivic } from '../../context/CivicContext';
import {
  RiskBadge,
  ConfidenceBadge,
  StatusBadge,
  CategoryBadge,
  DemoBadge
} from '../common/Badges';
import {
  History,
  AlertTriangle,
  Layers,
  ChevronRight,
  MapPin,
  Calendar,
  Wrench,
  HelpCircle,
  Sparkles,
  ArrowRight,
  Search
} from 'lucide-react';

export const CivicMemoryView: React.FC = () => {
  const { incidents, selectIncident, setIsDetailOpen, setActiveTab, assets, openAssetProfile } = useCivic();

  const [selectedSiteId, setSelectedSiteId] = useState<string>('inc-001');
  const [memorySearch, setMemorySearch] = useState<string>('');

  // Recurring incidents
  const recurringIncidents = incidents.filter((i) => i.isRecurring);

  const filteredSites = recurringIncidents.filter(
    (i) =>
      memorySearch === '' ||
      i.sector.toLowerCase().includes(memorySearch.toLowerCase()) ||
      i.location.toLowerCase().includes(memorySearch.toLowerCase())
  );

  const selectedSite =
    recurringIncidents.find((i) => i.id === selectedSiteId) || recurringIncidents[0];

  const matchedAsset = selectedSite?.associatedAssetId
    ? assets.find((a) => a.assetId === selectedSite.associatedAssetId)
    : null;

  return (
    <div className="space-y-6 text-left animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-[#E5E3DC]">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-black text-[#191B1F] tracking-tight">
              Civic Memory Engine
            </h1>
            <span className="px-2 py-0.5 rounded text-xs font-bold bg-[#FDF6EC] text-[#C88427] border border-[#F9E8CE]">
              Structural Intelligence
            </span>
          </div>
          <p className="text-xs sm:text-sm text-[#565C68] mt-0.5">
            Understand what keeps failing — and where. Move from superficial complaints to root infrastructure causes.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <DemoBadge label="HISTORICAL FAILURE TELEMETRY" />
        </div>
      </div>

      {/* Paradigm Shift Banner */}
      <div className="p-4 rounded-xl bg-[#FAF9F5] border border-[#E5E3DC] flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-lg bg-[#2C5E48] text-white flex items-center justify-center shrink-0 mt-0.5 shadow-xs">
            <History className="w-5 h-5 text-emerald-200" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-[#191B1F]">
              Beyond Symptom Management
            </h3>
            <p className="text-xs text-[#565C68] mt-0.5 leading-relaxed">
              When a pothole is repeatedly filled at the same coordinate every 90 days, the problem is not the surface asphalt — it is the sub-base drainage. SANKET Civic Memory isolates recurrent fatigue patterns across city infrastructure.
            </p>
          </div>
        </div>
        <button
          onClick={() => setActiveTab('map_view')}
          className="px-3.5 py-1.5 rounded-lg text-xs font-bold bg-white text-[#191B1F] border border-[#E5E3DC] hover:bg-[#ECEAE3] transition-colors shrink-0 shadow-xs flex items-center gap-1.5"
        >
          <span>View Hotspots on Map</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Main Layout: Left Recurring Locations List + Right Deep Dive */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Recurring Sites List (4 Cols) */}
        <div className="lg:col-span-4 space-y-3">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-[#7E8592] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search recurring sectors..."
              value={memorySearch}
              onChange={(e) => setMemorySearch(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 rounded-lg border border-[#E5E3DC] bg-white text-xs text-[#191B1F] focus:outline-none focus:border-[#2C5E48]"
            />
          </div>

          <div className="space-y-2">
            {filteredSites.map((site) => {
              const isSelected = site.id === selectedSite?.id;
              return (
                <div
                  key={site.id}
                  onClick={() => setSelectedSiteId(site.id)}
                  className={`p-3.5 rounded-xl border transition-all cursor-pointer text-left ${
                    isSelected
                      ? 'bg-white border-[#191B1F] shadow-sm ring-1 ring-[#191B1F]'
                      : 'bg-white border-[#E5E3DC] hover:border-[#191B1F]/30'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="text-[10px] font-bold text-[#C88427] bg-[#FDF6EC] px-1.5 py-0.2 rounded border border-[#F9E8CE]">
                        {site.recurrenceCount} RECURRING FAILURES
                      </span>
                      <h4 className="text-xs font-bold text-[#191B1F] mt-1">
                        {site.sector}
                      </h4>
                      <p className="text-[11px] text-[#565C68] truncate mt-0.5">
                        {site.location}
                      </p>
                    </div>
                    <RiskBadge score={site.riskScore} size="sm" showLabel={false} />
                  </div>

                  <div className="mt-2 pt-2 border-t border-[#F4F3EF] flex items-center justify-between text-[11px] text-[#7E8592]">
                    <span className="font-mono">Last failure: {site.lastFailureDate || '2026-03'}</span>
                    <span className="text-[#2C5E48] font-bold flex items-center gap-0.5">
                      Timeline <ChevronRight className="w-3 h-3" />
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right: Selected Infrastructure Failure Investigation (8 Cols) */}
        <div className="lg:col-span-8">
          {selectedSite ? (
            <div className="bg-white rounded-xl border border-[#E5E3DC] p-5 sm:p-6 space-y-6 shadow-xs">
              {/* Site Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-[#E5E3DC]">
                <div>
                  <div className="flex items-center gap-2">
                    <CategoryBadge category={selectedSite.category} />
                    <span className="text-xs font-mono font-bold text-[#C88427] bg-[#FDF6EC] px-2 py-0.5 rounded border border-[#F9E8CE]">
                      {selectedSite.recurrenceCount} Recorded Incidents
                    </span>
                  </div>
                  <h3 className="text-lg font-bold text-[#191B1F] mt-1.5">
                    {selectedSite.sector} • {selectedSite.title}
                  </h3>
                  <p className="text-xs text-[#565C68] mt-0.5">
                    {selectedSite.location}
                  </p>
                </div>

                <div className="flex items-center gap-2 self-start sm:self-auto">
                  {matchedAsset && (
                    <button
                      onClick={() => openAssetProfile(matchedAsset.assetId)}
                      className="px-3 py-1.5 rounded-lg bg-amber-600 text-white text-xs font-semibold hover:bg-amber-700 transition-colors flex items-center gap-1.5 shadow-xs"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-amber-200" />
                      <span>Civic DNA #{matchedAsset.assetId}</span>
                    </button>
                  )}
                  <button
                    onClick={() => {
                      selectIncident(selectedSite.id, true);
                    }}
                    className="px-3 py-1.5 rounded-lg bg-[#191B1F] text-white text-xs font-bold hover:bg-[#2C2F35] transition-colors"
                  >
                    Open Incident File →
                  </button>
                </div>
              </div>

              {/* Linked Civic DNA Asset Banner */}
              {matchedAsset && (
                <div className="p-3.5 rounded-xl bg-amber-50/60 border border-amber-200 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="font-mono font-bold text-amber-900">
                        PHYSICAL ASSET: #{matchedAsset.assetId}
                      </span>
                      <span className="bg-amber-100 text-amber-900 px-1.5 py-0.2 rounded font-mono text-[10px] font-bold">
                        Health: {matchedAsset.currentHealthScore}/100
                      </span>
                    </div>
                    <div className="font-medium text-stone-900">{matchedAsset.assetName}</div>
                    <div className="text-stone-500 text-[11px]">
                      {matchedAsset.department} &bull; Sunk Spend: ₹{matchedAsset.totalMaintenanceCost.toLocaleString('en-IN')} vs New: ₹{matchedAsset.estimatedReplacementCost.toLocaleString('en-IN')}
                    </div>
                  </div>

                  <button
                    onClick={() => openAssetProfile(matchedAsset.assetId)}
                    className="px-3 py-1.5 rounded-lg bg-stone-900 hover:bg-stone-800 text-white text-xs font-semibold shrink-0 transition-colors"
                  >
                    Inspect Asset Civic DNA →
                  </button>
                </div>
              )}

              {/* Historical Timeline */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-xs font-bold text-[#191B1F] uppercase tracking-wider flex items-center gap-1.5">
                    <Calendar className="w-4 h-4 text-[#2C5E48]" />
                    Infrastructure Failure Chronology
                  </h4>
                  <span className="text-[11px] font-mono text-[#7E8592]">
                    Data span: 2025 – 2026
                  </span>
                </div>

                {/* Timeline Cards */}
                <div className="relative border-l-2 border-[#E5E3DC] ml-3 pl-5 space-y-4">
                  {selectedSite.history && selectedSite.history.length > 0 ? (
                    selectedSite.history.map((item, idx) => (
                      <div key={idx} className="relative group">
                        <div className="absolute -left-[27px] top-1.5 w-3 h-3 rounded-full bg-[#C88427] border-2 border-white shadow-xs"></div>
                        <div className="p-3.5 rounded-xl bg-[#FAF9F5] border border-[#E5E3DC]">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-[#191B1F]">
                              {item.month} {item.year} — {item.issue}
                            </span>
                            <span className="text-[10px] font-mono text-[#7E8592]">
                              Failed after {item.daysToFail} days
                            </span>
                          </div>
                          <div className="mt-1.5 text-xs text-[#565C68]">
                            <b>Applied Patch:</b> {item.resolution}
                          </div>
                          {item.contractor && (
                            <div className="mt-1 text-[11px] text-[#7E8592]">
                              Contractor: {item.contractor}
                            </div>
                          )}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="p-3.5 rounded-xl bg-[#FAF9F5] border border-[#E5E3DC] text-xs text-[#565C68]">
                      Multiple historical service reports logged at this coordinate during previous monsoon and winter cycles.
                    </div>
                  )}

                  {/* Current Failure Node */}
                  <div className="relative">
                    <div className="absolute -left-[27px] top-1.5 w-3 h-3 rounded-full bg-[#C54E38] border-2 border-white shadow-xs animate-ping"></div>
                    <div className="absolute -left-[27px] top-1.5 w-3 h-3 rounded-full bg-[#C54E38] border-2 border-white shadow-xs"></div>
                    <div className="p-3.5 rounded-xl bg-[#FDF0ED] border border-[#F8D2CA]">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-[#C54E38]">
                          ACTIVE REPORT (Aug 2026) — {selectedSite.title}
                        </span>
                        <span className="text-[10px] font-mono text-[#C54E38] font-bold">
                          {selectedSite.waitingDays} days waiting
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-[#565C68]">
                        Surface patch again failed due to unresolved foundation moisture saturation.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* SANKET Root Cause Hypothesis vs Superficial Patch */}
              <div className="space-y-3 pt-4 border-t border-[#E5E3DC]">
                <h4 className="text-xs font-bold text-[#191B1F] uppercase tracking-wider flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-[#2C5E48]" />
                  SANKET Root Cause Diagnosis
                </h4>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {/* Superficial Approach */}
                  <div className="p-3.5 rounded-xl bg-[#FDF0ED]/40 border border-[#F8D2CA]">
                    <span className="text-[11px] font-bold text-[#C54E38] uppercase tracking-wider block mb-1">
                      Traditional Patch (What was done)
                    </span>
                    <p className="text-xs text-[#565C68] leading-relaxed">
                      Repeatedly laying cold-mix asphalt over existing road depressions without addressing subgrade moisture. Mean time between failures: <b>92 days</b>.
                    </p>
                  </div>

                  {/* Structural Recommendation */}
                  <div className="p-3.5 rounded-xl bg-[#EBF3EE] border border-[#C5DDD0]">
                    <span className="text-[11px] font-bold text-[#2C5E48] uppercase tracking-wider block mb-1">
                      Recommended Engineering Remedy
                    </span>
                    <p className="text-xs text-[#191B1F] leading-relaxed">
                      {selectedSite.rootCauseHypothesis ||
                        'Excavate subgrade aggregate, replace leaking utility stormwater culvert joints, and install French drains before resurfacing.'}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="p-8 text-center bg-white rounded-xl border border-[#E5E3DC] text-xs text-[#7E8592]">
              Select a recurring site to inspect its chronological failure analysis.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
