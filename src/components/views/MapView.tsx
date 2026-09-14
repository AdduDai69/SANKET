import React, { useState } from 'react';
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
  Filter,
  Layers,
  MapPin,
  Flame,
  History,
  Clock,
  ExternalLink,
  SlidersHorizontal,
  X
} from 'lucide-react';
import { IssueCategory } from '../../types/civic';

export const MapView: React.FC = () => {
  const {
    incidents,
    selectedIncidentId,
    selectedIncident,
    selectIncident,
    setIsDetailOpen,
    assets,
  } = useCivic();

  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [minRisk, setMinRisk] = useState<number>(0);
  const [recurringOnly, setRecurringOnly] = useState<boolean>(false);
  const [showAssets, setShowAssets] = useState<boolean>(true);
  const [showFilters, setShowFilters] = useState<boolean>(true);

  // Filter incidents for map
  const mapIncidents = incidents.filter((inc) => {
    const matchesCategory = categoryFilter === 'all' || inc.category === categoryFilter;
    const matchesRisk = inc.riskScore >= minRisk;
    const matchesRecurring = !recurringOnly || inc.isRecurring;
    return matchesCategory && matchesRisk && matchesRecurring;
  });

  // Filter physical infrastructure assets for map (respects category filter & layer toggle)
  const mapAssets = showAssets
    ? assets.filter((asset) => {
        if (categoryFilter === 'all') return true;
        if (categoryFilter === 'streetlight') return asset.assetType === 'streetlight';
        if (categoryFilter === 'drainage' || categoryFilter === 'water_leak') return asset.assetType === 'drainage';
        if (categoryFilter === 'waste') return asset.assetType === 'waste';
        if (categoryFilter === 'pothole' || categoryFilter === 'road_damage') return asset.assetType === 'road';
        return true;
      })
    : [];

  const active =
    (selectedIncidentId ? incidents.find((i) => i.id === selectedIncidentId) : null) ||
    mapIncidents[0] ||
    null;

  return (
    <div className="space-y-4 text-left animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-[#E5E3DC]">
        <div>
          <h1 className="text-2xl font-black text-[#191B1F] tracking-tight">
            City Geospatial Command
          </h1>
          <p className="text-xs sm:text-sm text-[#565C68] mt-0.5">
            Full-screen spatial cluster intelligence, recurring failure detection, and Civic DNA assets.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="px-3 py-1.5 rounded-lg border border-[#E5E3DC] bg-white hover:bg-[#F4F3EF] text-xs font-bold text-[#191B1F] flex items-center gap-1.5 transition-colors"
          >
            <SlidersHorizontal className="w-3.5 h-3.5 text-[#2C5E48]" />
            <span>{showFilters ? 'Hide Filters' : 'Filter Signals'}</span>
          </button>
          <DemoBadge label="LIVE TELEMETRY" />
        </div>
      </div>

      {/* Map Experience Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
        {/* Left Filter Panel (Optional / Toggleable) */}
        {showFilters && (
          <div className="lg:col-span-3 bg-white rounded-xl border border-[#E5E3DC] p-4 space-y-4 shadow-xs">
            <div className="flex items-center justify-between pb-2 border-b border-[#E5E3DC]">
              <span className="text-xs font-bold text-[#191B1F] uppercase tracking-wider flex items-center gap-1.5">
                <Filter className="w-3.5 h-3.5 text-[#2C5E48]" />
                Spatial Filters
              </span>
              <span className="text-[11px] font-mono text-[#7E8592]">
                {mapIncidents.length} signals{showAssets ? ` • ${mapAssets.length} assets` : ''}
              </span>
            </div>

            {/* Category Filter */}
            <div>
              <label className="text-[11px] font-semibold text-[#7E8592] uppercase block mb-1">
                Issue Category
              </label>
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="w-full px-2.5 py-1.5 rounded-lg border border-[#E5E3DC] bg-[#FBFBF9] text-xs text-[#191B1F]"
              >
                <option value="all">All Categories</option>
                <option value="pothole">Pothole</option>
                <option value="drainage">Drainage Overflow</option>
                <option value="waste">Solid Waste</option>
                <option value="streetlight">Streetlight</option>
                <option value="road_damage">Road Damage</option>
                <option value="water_leak">Water Main</option>
              </select>
            </div>

            {/* Min Risk Slider */}
            <div>
              <div className="flex justify-between items-center text-[11px] mb-1">
                <span className="font-semibold text-[#7E8592] uppercase">Min Civic Risk</span>
                <span className="font-mono font-bold text-[#C54E38]">{minRisk} / 100</span>
              </div>
              <input
                type="range"
                min="0"
                max="90"
                step="10"
                value={minRisk}
                onChange={(e) => setMinRisk(Number(e.target.value))}
                className="w-full accent-[#C54E38]"
              />
            </div>

            {/* Infrastructure Assets Layer Toggle */}
            <div className="pt-2 border-t border-[#E5E3DC] space-y-2">
              <label className="flex items-center gap-2 text-xs text-[#191B1F] cursor-pointer">
                <input
                  type="checkbox"
                  checked={showAssets}
                  onChange={(e) => setShowAssets(e.target.checked)}
                  className="rounded border-[#E5E3DC] text-[#2C5E48] focus:ring-0"
                />
                <span className="font-semibold text-amber-900">Civic DNA Assets Layer</span>
              </label>
              <p className="text-[10px] text-[#7E8592]">
                Displays physical municipal fixtures with real-time health score badges.
              </p>
            </div>

            {/* Recurring Hotspots Only */}
            <div className="pt-2 border-t border-[#E5E3DC]">
              <label className="flex items-center gap-2 text-xs text-[#191B1F] cursor-pointer">
                <input
                  type="checkbox"
                  checked={recurringOnly}
                  onChange={(e) => setRecurringOnly(e.target.checked)}
                  className="rounded border-[#E5E3DC] text-[#2C5E48] focus:ring-0"
                />
                <span className="font-semibold">Highlight Recurring Hotspots</span>
              </label>
              <p className="text-[10px] text-[#7E8592] mt-1">
                Filters map to locations with &ge;2 historical structural failures.
              </p>
            </div>
          </div>
        )}

        {/* Center: Full-Screen Interactive Map */}
        <div className={`${showFilters ? 'lg:col-span-6' : 'lg:col-span-8'} transition-all`}>
          <CivicMap
            incidents={mapIncidents}
            assets={mapAssets}
            selectedIncidentId={selectedIncidentId}
            showAssets={showAssets}
            height="560px"
          />
        </div>

        {/* Right: Selected Incident Inspector */}
        <div className={`${showFilters ? 'lg:col-span-3' : 'lg:col-span-4'} bg-white rounded-xl border border-[#E5E3DC] p-4 space-y-4 shadow-xs text-left`}>
          {active ? (
            <>
              <div className="flex items-center justify-between pb-2 border-b border-[#E5E3DC]">
                <span className="text-[10px] font-mono text-[#7E8592] uppercase tracking-wider">
                  Inspecting Coordinate
                </span>
                <StatusBadge status={active.status} />
              </div>

              <div>
                <CategoryBadge category={active.category} />
                <h3 className="text-sm font-bold text-[#191B1F] mt-1.5 leading-snug">
                  {active.title}
                </h3>
                <p className="text-xs text-[#565C68] mt-1">
                  {active.sector} • {active.location}
                </p>
              </div>

              {/* Photo preview */}
              <div className="h-32 rounded-lg overflow-hidden border border-[#E5E3DC]">
                <img
                  src={active.beforeImageUrl}
                  alt={active.title}
                  className="w-full h-full object-cover"
                />
              </div>

              {/* SANKET Score Pill Grid */}
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="p-2 rounded-lg bg-[#FAF9F5] border border-[#E5E3DC]">
                  <span className="text-[10px] text-[#7E8592] uppercase block">Civic Risk</span>
                  <span className="font-bold font-mono text-sm text-[#C54E38]">{active.riskScore}/100</span>
                </div>
                <div className="p-2 rounded-lg bg-[#FAF9F5] border border-[#E5E3DC]">
                  <span className="text-[10px] text-[#7E8592] uppercase block">Confidence</span>
                  <span className="font-bold font-mono text-sm text-[#1E6B42]">{active.confidenceScore}%</span>
                </div>
                <div className="p-2 rounded-lg bg-[#FAF9F5] border border-[#E5E3DC]">
                  <span className="text-[10px] text-[#7E8592] uppercase block">Waiting</span>
                  <span className="font-bold font-mono text-sm text-[#191B1F]">{active.waitingDays} days</span>
                </div>
                <div className="p-2 rounded-lg bg-[#FAF9F5] border border-[#E5E3DC]">
                  <span className="text-[10px] text-[#7E8592] uppercase block">Recurrence</span>
                  <span className="font-bold font-mono text-sm text-[#C88427]">
                    {active.isRecurring ? `${active.recurrenceCount}x recorded` : 'Isolated'}
                  </span>
                </div>
              </div>

              {/* Co-located Issues at this location */}
              {(() => {
                const colocated = incidents.filter(
                  (o) =>
                    o.id !== active.id &&
                    (o.status !== 'resolved' && o.status !== 'closed') &&
                    Math.abs(o.latitude - active.latitude) < 0.001 &&
                    Math.abs(o.longitude - active.longitude) < 0.001
                );
                if (colocated.length === 0) return null;
                return (
                  <div className="p-2.5 rounded-lg bg-[#FAF9F5] border border-[#E5E3DC] space-y-1.5 text-xs">
                    <div className="flex items-center justify-between text-[11px] font-bold text-[#191B1F]">
                      <span className="flex items-center gap-1">
                        <Layers className="w-3.5 h-3.5 text-[#2C5E48]" />
                        Co-located Issues ({colocated.length + 1} total)
                      </span>
                      <span className="text-[10px] text-[#7E8592] font-normal">Same site ≠ Same issue</span>
                    </div>
                    <div className="space-y-1">
                      {colocated.map((c) => (
                        <button
                          key={c.id}
                          onClick={() => selectIncident(c.id, false)}
                          className="w-full text-left p-1.5 rounded bg-white hover:bg-[#F4F3EF] border border-[#E5E3DC] flex items-center justify-between gap-1 transition-colors text-[11px]"
                        >
                          <div className="truncate font-semibold text-[#191B1F]">
                            {c.category.replace('_', ' ')}: {c.title}
                          </div>
                          <span className="text-[10px] text-[#7E8592] font-mono shrink-0">
                            Risk {c.riskScore}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })()}

              <button
                onClick={() => setIsDetailOpen(true)}
                className="w-full py-2 rounded-xl bg-[#191B1F] hover:bg-[#2C2F35] text-white text-xs font-bold transition-colors flex items-center justify-center gap-1.5 shadow-sm"
              >
                <span>Investigate Incident</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </button>
            </>
          ) : (
            <div className="p-6 text-center text-xs text-[#7E8592]">
              Select any pin on the map to inspect its telemetry.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
