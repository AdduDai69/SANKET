import React, { useState } from 'react';
import { AssetEvent, AssetEventType } from '../../types/civic';
import {
  Wrench,
  AlertTriangle,
  FileText,
  Search,
  RefreshCw,
  PlusCircle,
  Sparkles,
  CheckCircle2,
  Calendar,
  Building,
  IndianRupee,
} from 'lucide-react';

interface CivicDnaTimelineProps {
  events: AssetEvent[];
  assetName: string;
  assetNumber: string;
}

export const CivicDnaTimeline: React.FC<CivicDnaTimelineProps> = ({
  events,
  assetName,
  assetNumber,
}) => {
  const [filterType, setFilterType] = useState<string>('all');

  const filteredEvents = events.filter(ev => {
    if (filterType === 'all') return true;
    if (filterType === 'complaints') return ev.eventType === 'complaint';
    if (filterType === 'repairs')
      return ev.eventType === 'repair' || ev.eventType === 'component_replacement';
    if (filterType === 'inspections') return ev.eventType === 'inspection';
    if (filterType === 'failures') return ev.eventType === 'failure';
    return true;
  });

  const getEventIcon = (type: AssetEventType) => {
    switch (type) {
      case 'installation':
        return <PlusCircle className="w-4 h-4 text-emerald-600" />;
      case 'complaint':
        return <AlertTriangle className="w-4 h-4 text-amber-600" />;
      case 'repair':
        return <Wrench className="w-4 h-4 text-blue-600" />;
      case 'failure':
        return <AlertTriangle className="w-4 h-4 text-red-600" />;
      case 'component_replacement':
        return <RefreshCw className="w-4 h-4 text-purple-600" />;
      case 'inspection':
        return <Search className="w-4 h-4 text-stone-600" />;
      case 'prediction':
        return <Sparkles className="w-4 h-4 text-indigo-600" />;
      default:
        return <FileText className="w-4 h-4 text-stone-500" />;
    }
  };

  const getEventBadgeColor = (type: AssetEventType) => {
    switch (type) {
      case 'installation':
        return 'bg-emerald-100 text-emerald-800 border-emerald-200';
      case 'complaint':
        return 'bg-amber-100 text-amber-800 border-amber-200';
      case 'repair':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'failure':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'component_replacement':
        return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'inspection':
        return 'bg-stone-100 text-stone-700 border-stone-200';
      case 'prediction':
        return 'bg-indigo-100 text-indigo-800 border-indigo-200';
      default:
        return 'bg-stone-100 text-stone-700 border-stone-200';
    }
  };

  const formatRupees = (val?: number) => {
    if (!val) return null;
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(val);
  };

  return (
    <div className="space-y-4">
      {/* Event Category Filter Pills */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
        {[
          { id: 'all', label: `All Events (${events.length})` },
          {
            id: 'repairs',
            label: `Repairs (${events.filter(e => e.eventType === 'repair' || e.eventType === 'component_replacement').length})`,
          },
          {
            id: 'complaints',
            label: `Complaints (${events.filter(e => e.eventType === 'complaint').length})`,
          },
          {
            id: 'failures',
            label: `Failures (${events.filter(e => e.eventType === 'failure').length})`,
          },
          {
            id: 'inspections',
            label: `Inspections (${events.filter(e => e.eventType === 'inspection').length})`,
          },
        ].map(btn => (
          <button
            key={btn.id}
            onClick={() => setFilterType(btn.id)}
            className={`px-2.5 py-1 rounded-full font-medium transition-colors shrink-0 ${
              filterType === btn.id
                ? 'bg-stone-900 text-white shadow-xs'
                : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
            }`}
          >
            {btn.label}
          </button>
        ))}
      </div>

      {/* Vertical Timeline Stream */}
      <div className="relative pl-6 border-l-2 border-stone-200 space-y-6 pt-2">
        {filteredEvents.map((ev, index) => {
          const costStr = formatRupees(ev.cost);
          const isLatest = index === filteredEvents.length - 1;

          return (
            <div key={ev.id} className="relative group">
              {/* Glyph on Timeline Line */}
              <div
                className={`absolute -left-[31px] top-1 w-6 h-6 rounded-full border-2 border-white bg-white shadow-xs flex items-center justify-center`}
              >
                {getEventIcon(ev.eventType)}
              </div>

              {/* Event Content Card */}
              <div className="bg-white p-4 rounded-xl border border-stone-200 shadow-xs hover:border-stone-300 transition-all">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 mb-1.5">
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-[10px] font-mono uppercase font-bold px-2 py-0.5 rounded border ${getEventBadgeColor(
                        ev.eventType
                      )}`}
                    >
                      {ev.eventType.replace('_', ' ')}
                    </span>
                    <h5 className="text-sm font-bold text-stone-900 font-serif">
                      {ev.title}
                    </h5>
                  </div>
                  <span className="text-xs font-mono text-stone-500 shrink-0">
                    {ev.date} ({ev.year})
                  </span>
                </div>

                <p className="text-xs text-stone-600 leading-relaxed font-sans mt-1">
                  {ev.description}
                </p>

                {/* Metadata Pills (Department, Contractor, Cost, Component) */}
                <div className="mt-3 pt-2.5 border-t border-stone-100 flex flex-wrap items-center gap-2 text-[11px] text-stone-500 font-mono">
                  {ev.department && (
                    <span className="flex items-center gap-1 bg-stone-50 px-2 py-0.5 rounded border border-stone-150">
                      <Building className="w-3 h-3 text-stone-400" />
                      {ev.department}
                    </span>
                  )}
                  {ev.contractor && (
                    <span className="bg-stone-50 px-2 py-0.5 rounded border border-stone-150 text-stone-600">
                      Contractor: <strong className="text-stone-800">{ev.contractor}</strong>
                    </span>
                  )}
                  {costStr && (
                    <span className="bg-amber-50 text-amber-900 px-2 py-0.5 rounded border border-amber-200 font-bold">
                      Cost: {costStr}
                    </span>
                  )}
                  {ev.complaintId && (
                    <span className="bg-blue-50 text-blue-800 px-2 py-0.5 rounded border border-blue-200">
                      Grievance #{ev.complaintId}
                    </span>
                  )}
                  {ev.metadata?.component && (
                    <span className="bg-red-50 text-red-800 px-2 py-0.5 rounded border border-red-200">
                      Part: {ev.metadata.component}
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
