import React, { useState, useEffect } from 'react';
import { useCivic } from '../../context/CivicContext';
import { RepairVsReplaceCard } from './RepairVsReplaceCard';
import { FailurePatternCard } from './FailurePatternCard';
import { MaintenanceEconomicsCard } from './MaintenanceEconomicsCard';
import { AssetHealthScoreCard } from './AssetHealthScoreCard';
import { CivicDnaTimeline } from './CivicDnaTimeline';
import {
  X,
  MapPin,
  Building,
  Calendar,
  Layers,
  Sparkles,
  ExternalLink,
  ShieldAlert,
  AlertCircle,
  FileText,
  Activity,
  History,
} from 'lucide-react';

export const CivicDnaProfileModal: React.FC = () => {
  const {
    selectedAsset,
    isAssetProfileOpen,
    closeAssetProfile,
    incidents,
    selectIncident,
    setIsDetailOpen,
  } = useCivic();

  const [activeSubTab, setActiveSubTab] = useState<'decision' | 'timeline' | 'complaints'>(
    'decision'
  );

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isAssetProfileOpen) {
        closeAssetProfile();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isAssetProfileOpen, closeAssetProfile]);

  if (!isAssetProfileOpen || !selectedAsset) return null;

  // Filter linked complaints from main incidents list
  const linkedComplaints = incidents.filter(
    inc =>
      selectedAsset.associatedIncidentIds?.includes(inc.id) ||
      inc.associatedAssetId === selectedAsset.assetId
  );

  const formatRupees = (val: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(val);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'operational':
        return 'bg-emerald-100 text-emerald-800 border-emerald-200';
      case 'needs_attention':
        return 'bg-amber-100 text-amber-800 border-amber-200';
      case 'critical':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'end_of_life':
        return 'bg-stone-200 text-stone-800 border-stone-300';
      default:
        return 'bg-stone-100 text-stone-700 border-stone-200';
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-stone-900/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 md:p-6 animate-fade-in">
      <div
        className="bg-stone-50 rounded-2xl border border-stone-300 shadow-2xl w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden animate-scale-up"
        onClick={e => e.stopPropagation()}
      >
        {/* Modal Top Header */}
        <div className="bg-white px-6 py-5 border-b border-stone-200 shrink-0">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex flex-wrap items-center gap-2 mb-1.5">
                <span className="font-mono text-xs font-bold text-stone-500 bg-stone-100 px-2 py-0.5 rounded border border-stone-200">
                  CIVIC DNA #{selectedAsset.assetId}
                </span>
                <span
                  className={`text-[11px] font-mono font-bold uppercase px-2.5 py-0.5 rounded-full border ${getStatusBadge(
                    selectedAsset.currentStatus
                  )}`}
                >
                  {selectedAsset.currentStatus.replace('_', ' ')}
                </span>
                <span className="text-xs text-stone-500 flex items-center gap-1 font-mono">
                  <MapPin className="w-3.5 h-3.5 text-stone-400" />
                  {selectedAsset.sector}
                </span>
              </div>
              <h2 className="text-xl sm:text-2xl font-black text-stone-900 font-serif">
                {selectedAsset.assetName}
              </h2>
              <p className="text-xs text-stone-600 mt-1 flex items-center gap-2">
                <span>{selectedAsset.location}</span>
                <span>&bull;</span>
                <span className="font-medium text-stone-800">{selectedAsset.department}</span>
              </p>
            </div>

            <button
              onClick={closeAssetProfile}
              className="p-2 rounded-lg text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition-colors"
              aria-label="Close modal"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          {/* Quick Telemetry KPI Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-6 gap-2 mt-4 pt-3 border-t border-stone-100 text-xs">
            <div className="p-2 bg-stone-50 rounded border border-stone-150">
              <div className="text-[10px] text-stone-400 font-mono">Commissioned</div>
              <div className="font-bold text-stone-800 font-mono mt-0.5">
                {selectedAsset.installationYear} ({selectedAsset.ageYears}y old)
              </div>
            </div>
            <div className="p-2 bg-stone-50 rounded border border-stone-150">
              <div className="text-[10px] text-stone-400 font-mono">Total Complaints</div>
              <div className="font-bold text-stone-800 font-mono mt-0.5">
                {selectedAsset.totalComplaints} Reports
              </div>
            </div>
            <div className="p-2 bg-stone-50 rounded border border-stone-150">
              <div className="text-[10px] text-stone-400 font-mono">Repairs Executed</div>
              <div className="font-bold text-stone-800 font-mono mt-0.5">
                {selectedAsset.totalRepairs} Interventions
              </div>
            </div>
            <div className="p-2 bg-stone-50 rounded border border-stone-150">
              <div className="text-[10px] text-stone-400 font-mono">Cumulative Spend</div>
              <div className="font-bold text-stone-900 font-mono mt-0.5">
                {formatRupees(selectedAsset.totalMaintenanceCost)}
              </div>
            </div>
            <div className="p-2 bg-stone-50 rounded border border-stone-150">
              <div className="text-[10px] text-stone-400 font-mono">New Unit Cost</div>
              <div className="font-bold text-stone-800 font-mono mt-0.5">
                {formatRupees(selectedAsset.estimatedReplacementCost)}
              </div>
            </div>
            <div className="p-2 bg-emerald-50 rounded border border-emerald-200">
              <div className="text-[10px] text-emerald-700 font-mono font-medium">Net Savings</div>
              <div className="font-bold text-emerald-800 font-mono mt-0.5">
                {formatRupees(selectedAsset.potentialSavings)}
              </div>
            </div>
          </div>

          {/* Tab Navigation */}
          <div className="flex items-center gap-4 mt-4 pt-2 border-t border-stone-200 text-xs font-medium">
            <button
              onClick={() => setActiveSubTab('decision')}
              className={`pb-2 border-b-2 font-mono uppercase tracking-wider flex items-center gap-1.5 transition-colors ${
                activeSubTab === 'decision'
                  ? 'border-stone-900 text-stone-900 font-bold'
                  : 'border-transparent text-stone-500 hover:text-stone-800'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              Decision Engine & Health
            </button>
            <button
              onClick={() => setActiveSubTab('timeline')}
              className={`pb-2 border-b-2 font-mono uppercase tracking-wider flex items-center gap-1.5 transition-colors ${
                activeSubTab === 'timeline'
                  ? 'border-stone-900 text-stone-900 font-bold'
                  : 'border-transparent text-stone-500 hover:text-stone-800'
              }`}
            >
              <History className="w-3.5 h-3.5" />
              Lifecycle DNA Timeline ({selectedAsset.events.length})
            </button>
            <button
              onClick={() => setActiveSubTab('complaints')}
              className={`pb-2 border-b-2 font-mono uppercase tracking-wider flex items-center gap-1.5 transition-colors ${
                activeSubTab === 'complaints'
                  ? 'border-stone-900 text-stone-900 font-bold'
                  : 'border-transparent text-stone-500 hover:text-stone-800'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              Connected Grievances ({linkedComplaints.length})
            </button>
          </div>
        </div>

        {/* Scrollable Content Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 bg-stone-50/50">
          {activeSubTab === 'decision' && (
            <div className="space-y-5">
              {/* Signature Repair vs Replace Decision Card */}
              <RepairVsReplaceCard
                recommendation={selectedAsset.recommendation}
                assetName={selectedAsset.assetName}
                assetNumber={selectedAsset.assetId}
                totalMaintenanceCost={selectedAsset.totalMaintenanceCost}
              />

              {/* Two Column Grid: Health & Interval Pattern */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <AssetHealthScoreCard
                  healthScore={selectedAsset.currentHealthScore}
                  riskScore={selectedAsset.currentRiskScore}
                  healthBreakdown={selectedAsset.healthBreakdown}
                  riskBreakdown={selectedAsset.riskBreakdown}
                />

                <FailurePatternCard
                  failurePattern={selectedAsset.failurePattern}
                  recurringComponent={selectedAsset.currentComponent}
                  recurrenceCount={selectedAsset.recurrenceCount}
                />
              </div>

              {/* Maintenance Economics Card */}
              <MaintenanceEconomicsCard
                totalMaintenanceCost={selectedAsset.totalMaintenanceCost}
                estimatedReplacementCost={selectedAsset.estimatedReplacementCost}
                potentialSavings={selectedAsset.potentialSavings}
                assetType={selectedAsset.assetType}
              />

              {/* AI Civic DNA Narrative Dossier */}
              <div className="bg-white rounded-xl border border-stone-200 p-5 shadow-xs">
                <div className="flex items-center gap-2 mb-2 text-xs font-mono font-bold uppercase tracking-wider text-stone-600">
                  <Sparkles className="w-4 h-4 text-amber-500" />
                  SANKET Civic DNA Intelligence Summary
                </div>
                <p className="text-xs sm:text-sm text-stone-700 leading-relaxed font-sans bg-stone-50 p-4 rounded-lg border border-stone-200">
                  {selectedAsset.aiSummary}
                </p>
              </div>
            </div>
          )}

          {activeSubTab === 'timeline' && (
            <div className="bg-white rounded-xl border border-stone-200 p-5 shadow-xs">
              <CivicDnaTimeline
                events={selectedAsset.events}
                assetName={selectedAsset.assetName}
                assetNumber={selectedAsset.assetId}
              />
            </div>
          )}

          {activeSubTab === 'complaints' && (
            <div className="space-y-4">
              <div className="text-xs text-stone-600">
                Citizen grievance tickets verified within proximity of this physical asset:
              </div>

              {linkedComplaints.length === 0 ? (
                <div className="p-8 text-center bg-white rounded-xl border border-stone-200 text-stone-500 text-xs">
                  No active open complaints currently linked to this asset.
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-3">
                  {linkedComplaints.map(inc => (
                    <div
                      key={inc.id}
                      className="bg-white p-4 rounded-xl border border-stone-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs hover:border-stone-300 transition-all"
                    >
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-mono text-xs font-bold text-stone-900">
                            {inc.ticketNumber}
                          </span>
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded uppercase font-bold bg-amber-100 text-amber-800">
                            {inc.status.replace('_', ' ')}
                          </span>
                          <span className="text-xs text-stone-400">&bull;</span>
                          <span className="text-xs text-stone-500 font-mono">
                            {inc.associatedAssetDistanceMeters || 18}m proximity
                          </span>
                        </div>
                        <h4 className="text-sm font-bold text-stone-900 font-serif">
                          {inc.title}
                        </h4>
                        <p className="text-xs text-stone-500 line-clamp-1 mt-0.5">
                          {inc.description}
                        </p>
                      </div>

                      <button
                        onClick={() => {
                          closeAssetProfile();
                          selectIncident(inc.id, true);
                          setIsDetailOpen(true);
                        }}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-stone-900 text-white hover:bg-stone-800 self-start sm:self-auto transition-colors"
                      >
                        <span>Inspect Ticket</span>
                        <ExternalLink className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="bg-white px-6 py-3.5 border-t border-stone-200 flex items-center justify-between text-xs text-stone-500 font-mono shrink-0">
          <span>Asset Coordinates: {selectedAsset.latitude.toFixed(4)}° N, {selectedAsset.longitude.toFixed(4)}° E</span>
          <button
            onClick={closeAssetProfile}
            className="px-4 py-1.5 rounded-lg bg-stone-100 hover:bg-stone-200 text-stone-800 font-medium transition-colors"
          >
            Close Profile
          </button>
        </div>
      </div>
    </div>
  );
};
