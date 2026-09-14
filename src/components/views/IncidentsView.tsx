import React from 'react';
import { useCivic } from '../../context/CivicContext';
import {
  RiskBadge,
  ConfidenceBadge,
  StatusBadge,
  CategoryBadge,
  DemoBadge
} from '../common/Badges';
import {
  Search,
  Filter,
  X,
  History,
  Clock,
  ArrowUpDown,
  ChevronRight,
  Eye,
  SlidersHorizontal
} from 'lucide-react';
import { IssueCategory, IncidentStatus } from '../../types/civic';

export const IncidentsView: React.FC = () => {
  const {
    incidents,
    selectIncident,
    selectedIncidentId,
    search,
    setSearch,
    categoryFilter,
    setCategoryFilter,
    riskFilter,
    setRiskFilter,
    statusFilter,
    setStatusFilter,
    recurringOnly,
    setRecurringOnly
  } = useCivic();

  // Filtered dataset
  const filteredIncidents = incidents.filter((inc) => {
    const matchesSearch =
      search === '' ||
      inc.title.toLowerCase().includes(search.toLowerCase()) ||
      inc.location.toLowerCase().includes(search.toLowerCase()) ||
      inc.sector.toLowerCase().includes(search.toLowerCase()) ||
      inc.ticketNumber.toLowerCase().includes(search.toLowerCase());

    const matchesCategory = categoryFilter === 'all' || inc.category === categoryFilter;

    let matchesRisk = true;
    if (riskFilter === 'critical') matchesRisk = inc.riskScore >= 80;
    else if (riskFilter === 'high') matchesRisk = inc.riskScore >= 70 && inc.riskScore < 80;
    else if (riskFilter === 'medium') matchesRisk = inc.riskScore >= 50 && inc.riskScore < 70;
    else if (riskFilter === 'low') matchesRisk = inc.riskScore < 50;

    const matchesStatus = statusFilter === 'all' || inc.status === statusFilter;

    const matchesRecurring = !recurringOnly || inc.isRecurring;

    return matchesSearch && matchesCategory && matchesRisk && matchesStatus && matchesRecurring;
  });

  const clearFilters = () => {
    setSearch('');
    setCategoryFilter('all');
    setRiskFilter('all');
    setStatusFilter('all');
    setRecurringOnly(false);
  };

  const hasActiveFilters =
    search !== '' || categoryFilter !== 'all' || riskFilter !== 'all' || statusFilter !== 'all' || recurringOnly;

  return (
    <div className="space-y-5 text-left animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-[#E5E3DC]">
        <div>
          <h1 className="text-2xl font-black text-[#191B1F] tracking-tight">
            Incidents Directory
          </h1>
          <p className="text-xs sm:text-sm text-[#565C68] mt-0.5">
            Investigate, verify and manage civic reports across Chandigarh.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <DemoBadge label="30 DETERMINISTIC RECORDS" />
        </div>
      </div>

      {/* Filter Controls Bar */}
      <div className="p-4 rounded-xl bg-white border border-[#E5E3DC] shadow-xs space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5">
          {/* Search Input */}
          <div className="relative lg:col-span-2">
            <Search className="w-4 h-4 text-[#7E8592] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by ticket #, street, or keyword..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 rounded-lg border border-[#E5E3DC] bg-[#FBFBF9] text-xs text-[#191B1F] placeholder-[#7E8592] focus:outline-none focus:border-[#2C5E48]"
            />
          </div>

          {/* Category Filter */}
          <div>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="w-full px-3 py-1.5 rounded-lg border border-[#E5E3DC] bg-[#FBFBF9] text-xs text-[#191B1F] focus:outline-none focus:border-[#2C5E48]"
            >
              <option value="all">All Issue Categories</option>
              <option value="pothole">Pothole</option>
              <option value="drainage">Drainage Overflow</option>
              <option value="waste">Solid Waste</option>
              <option value="streetlight">Streetlight Fault</option>
              <option value="road_damage">Road Damage</option>
              <option value="water_leak">Water Main Leak</option>
            </select>
          </div>

          {/* Risk Filter */}
          <div>
            <select
              value={riskFilter}
              onChange={(e) => setRiskFilter(e.target.value)}
              className="w-full px-3 py-1.5 rounded-lg border border-[#E5E3DC] bg-[#FBFBF9] text-xs text-[#191B1F] focus:outline-none focus:border-[#2C5E48]"
            >
              <option value="all">All Risk Tiers</option>
              <option value="critical">Critical (&ge;80)</option>
              <option value="high">High (70-79)</option>
              <option value="medium">Medium (50-69)</option>
              <option value="low">Low (&lt;50)</option>
            </select>
          </div>

          {/* Status Filter */}
          <div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-3 py-1.5 rounded-lg border border-[#E5E3DC] bg-[#FBFBF9] text-xs text-[#191B1F] focus:outline-none focus:border-[#2C5E48]"
            >
              <option value="all">All Statuses</option>
              <option value="reported">Reported</option>
              <option value="assigned">Assigned</option>
              <option value="in_progress">In Progress</option>
              <option value="resolved">Resolved</option>
              <option value="needs_review">Needs Review</option>
            </select>
          </div>
        </div>

        {/* Secondary Toggles */}
        <div className="flex flex-col gap-2 pt-2 border-t border-[#F4F3EF] text-xs sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <label className="flex items-center gap-1.5 cursor-pointer text-[#565C68] hover:text-[#191B1F]">
              <input
                type="checkbox"
                checked={recurringOnly}
                onChange={(e) => setRecurringOnly(e.target.checked)}
                className="rounded border-[#E5E3DC] text-[#2C5E48] focus:ring-0"
              />
              <span className="font-medium">Show Recurring Hotspots Only</span>
            </label>

            <span className="text-[#7E8592] font-mono text-[11px]">
              Showing {filteredIncidents.length} of {incidents.length} records
            </span>
          </div>

          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="self-start flex items-center gap-1 text-[11px] font-bold text-[#C54E38] hover:underline"
            >
              <X className="w-3.5 h-3.5" />
              <span>Reset Filters</span>
            </button>
          )}
        </div>
      </div>

      {/* ========================================================= */}
      {/* DATA TABLE (Desktop) / CARDS (Mobile)                     */}
      {/* ========================================================= */}
      {filteredIncidents.length === 0 ? (
        <div className="p-12 text-center bg-white rounded-xl border border-[#E5E3DC]">
          <SlidersHorizontal className="w-8 h-8 text-[#7E8592] mx-auto mb-2" />
          <p className="text-sm font-bold text-[#191B1F]">No incidents match the active criteria</p>
          <p className="text-xs text-[#7E8592] mt-1">Try clearing filters to inspect all municipal reports.</p>
          <button
            onClick={clearFilters}
            className="mt-3 px-3 py-1.5 rounded-lg text-xs font-bold bg-[#191B1F] text-white"
          >
            Clear Filters
          </button>
        </div>
      ) : (
        <>
          {/* Desktop Table */}
          <div className="hidden md:block bg-white rounded-xl border border-[#E5E3DC] shadow-xs overflow-hidden">
            <table className="w-full text-left text-xs divide-y divide-[#E5E3DC]">
              <thead className="bg-[#FAF9F5] text-[#7E8592] uppercase font-semibold text-[10px] tracking-wider">
                <tr>
                  <th className="px-4 py-3">Incident & Ticket</th>
                  <th className="px-4 py-3">Location & Sector</th>
                  <th className="px-4 py-3">Civic Risk</th>
                  <th className="px-4 py-3">Civic Confidence</th>
                  <th className="px-4 py-3">Aging</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Assigned Team</th>
                  <th className="px-4 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F4F3EF]">
                {filteredIncidents.map((inc) => {
                  const isSelected = inc.id === selectedIncidentId;
                  return (
                    <tr
                      key={inc.id}
                      onClick={() => selectIncident(inc.id, true)}
                      className={`hover:bg-[#FAF9F5] cursor-pointer transition-colors ${
                        isSelected ? 'bg-[#FAF9F5]' : ''
                      }`}
                    >
                      <td className="px-4 py-3.5">
                        <div className="font-bold text-[#191B1F]">{inc.title}</div>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="font-mono text-[10px] text-[#7E8592]">{inc.ticketNumber}</span>
                          <CategoryBadge category={inc.category} />
                          {inc.isRecurring && (
                            <span className="text-[9px] font-bold text-[#C88427] bg-[#FDF6EC] px-1 py-0.2 rounded border border-[#F9E8CE]">
                              {inc.recurrenceCount}x Recur
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="px-4 py-3.5">
                        <div className="font-semibold text-[#191B1F] flex items-center gap-1.5 flex-wrap">
                          <span>{inc.sector}</span>
                          {inc.locationVerificationStatus === 'UNDER_CONSIDERATION' ? (
                            <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-amber-50 text-amber-700 border border-amber-200" title="Held for location desk review">
                              Desk Review
                            </span>
                          ) : inc.locationSource === 'EXIF_GPS' ? (
                            <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-emerald-50 text-emerald-700 border border-emerald-200" title="Photo EXIF GPS Verified">
                              GPS ✓
                            </span>
                          ) : null}
                        </div>
                        <div className="text-[11px] text-[#7E8592] truncate max-w-xs">{inc.location}</div>
                      </td>

                      <td className="px-4 py-3.5">
                        <RiskBadge score={inc.riskScore} size="sm" showLabel={false} />
                      </td>

                      <td className="px-4 py-3.5">
                        <ConfidenceBadge confidence={inc.confidenceScore} size="sm" />
                      </td>

                      <td className="px-4 py-3.5 font-mono">
                        <span className={inc.waitingDays >= 30 ? 'font-bold text-[#C54E38]' : 'text-[#565C68]'}>
                          {inc.waitingDays}d
                        </span>
                      </td>

                      <td className="px-4 py-3.5">
                        <StatusBadge status={inc.status} />
                      </td>

                      <td className="px-4 py-3.5 text-[#565C68] text-[11px]">
                        {inc.assignedTeam ? (
                          <span className="truncate max-w-[140px] block">{inc.assignedTeam}</span>
                        ) : (
                          <span className="italic text-[#7E8592]">Unassigned</span>
                        )}
                      </td>

                      <td className="px-4 py-3.5 text-right">
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-[#F4F3EF] hover:bg-[#ECEAE3] text-[#191B1F] font-bold text-[11px] transition-colors">
                          <Eye className="w-3 h-3 text-[#2C5E48]" />
                          Details
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile Card List */}
          <div className="md:hidden space-y-3">
            {filteredIncidents.map((inc) => (
              <div
                key={inc.id}
                onClick={() => selectIncident(inc.id, true)}
                className="p-4 bg-white rounded-xl border border-[#E5E3DC] shadow-xs space-y-3 cursor-pointer"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="text-[10px] font-mono text-[#7E8592] block">{inc.ticketNumber}</span>
                    <h3 className="text-sm font-bold text-[#191B1F]">{inc.title}</h3>
                    <p className="text-xs text-[#565C68] mt-0.5 flex items-center gap-1.5 flex-wrap">
                      <span>{inc.sector} • {inc.location}</span>
                      {inc.locationVerificationStatus === 'UNDER_CONSIDERATION' ? (
                        <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-amber-50 text-amber-700 border border-amber-200">
                          Desk Review
                        </span>
                      ) : inc.locationSource === 'EXIF_GPS' ? (
                        <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                          GPS ✓
                        </span>
                      ) : null}
                    </p>
                  </div>
                  <RiskBadge score={inc.riskScore} size="sm" showLabel={false} />
                </div>

                <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-[#F4F3EF] text-xs">
                  <CategoryBadge category={inc.category} />
                  <StatusBadge status={inc.status} />
                  <span className="font-mono text-[#7E8592]">{inc.waitingDays}d waiting</span>
                </div>

                <div className="flex items-center justify-between text-xs pt-2 border-t border-[#F4F3EF]">
                  <ConfidenceBadge confidence={inc.confidenceScore} size="sm" />
                  <span className="text-[#2C5E48] font-bold flex items-center gap-1">
                    Investigate <ChevronRight className="w-3.5 h-3.5" />
                  </span>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
};
