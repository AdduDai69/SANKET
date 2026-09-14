import React from 'react';
import { useCivic } from '../../context/CivicContext';
import { MunicipalTab } from '../../types/civic';
import {
  LayoutDashboard,
  AlertOctagon,
  ListOrdered,
  MapPin,
  History,
  BarChart3,
  FileText,
  Settings,
  HelpCircle,
  Eye,
  ShieldAlert,
  Flame,
  Sparkles,
} from 'lucide-react';

export const Sidebar: React.FC = () => {
  const { activeTab, setActiveTab, incidents } = useCivic();

  const highRiskCount = incidents.filter((i) => i.riskScore >= 70 && i.status !== 'resolved').length;
  const recurringCount = incidents.filter((i) => i.isRecurring).length;

  const navItems: {
    id: MunicipalTab;
    label: string;
    icon: React.ReactNode;
    badge?: string | number;
    badgeColor?: string;
  }[] = [
    {
      id: 'dashboard',
      label: 'Dashboard',
      icon: <LayoutDashboard className="w-4 h-4" />
    },
    {
      id: 'incidents',
      label: 'Incidents',
      icon: <AlertOctagon className="w-4 h-4" />,
      badge: incidents.length
    },
    {
      id: 'priority_queue',
      label: 'Priority Queue',
      icon: <ListOrdered className="w-4 h-4" />,
      badge: highRiskCount,
      badgeColor: 'bg-[#FDF0ED] text-[#C54E38]'
    },
    {
      id: 'map_view',
      label: 'Map View',
      icon: <MapPin className="w-4 h-4" />
    },
    {
      id: 'civic_memory',
      label: 'Civic Memory',
      icon: <History className="w-4 h-4" />,
      badge: `${recurringCount} sites`,
      badgeColor: 'bg-[#FDF6EC] text-[#C88427]'
    },
    {
      id: 'civic_dna',
      label: 'Civic DNA',
      icon: <Sparkles className="w-4 h-4" />,
      badge: 'Assets',
      badgeColor: 'bg-amber-100 text-amber-900 border border-amber-300'
    },
    {
      id: 'analytics',
      label: 'Analytics',
      icon: <BarChart3 className="w-4 h-4" />
    },
    {
      id: 'reports',
      label: 'Reports',
      icon: <FileText className="w-4 h-4" />
    }
  ];

  return (
    <aside className="w-64 self-start bg-[#F4F3EF] border-r border-[#E5E3DC] flex flex-col justify-between shrink-0 h-[calc(100dvh-69px)] sticky top-[69px] select-none">
      <div className="px-4 pt-3 pb-4">
        {/* Brand & Logo */}
        <div className="px-2 py-1.5 mb-3">
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => setActiveTab('dashboard')}
              aria-label="Go to CivicLens dashboard"
              title="Go to dashboard"
              className="h-[53px] w-[170px] shrink-0 rounded-lg bg-no-repeat shadow-sm transition-transform duration-150 hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#405A73] active:translate-y-0"
              style={{
                backgroundImage: "url('/civiclens-brand-reference.png')",
                backgroundSize: '436px 218px',
                backgroundPosition: '-5px -133px'
              }}
            />
            <div>
              <span className="sr-only">SANKET Municipal Intelligence Engine</span>
            </div>
          </div>
        </div>

        {/* Primary Navigation */}
        <div className="space-y-1">
          <div className="px-3 py-1 text-[11px] font-semibold text-[#7E8592] uppercase tracking-wider">
            Operations
          </div>
          {navItems.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-semibold transition-all duration-150 text-left ${
                  isActive
                    ? 'bg-white text-[#191B1F] shadow-sm border border-[#E5E3DC]/80 font-bold'
                    : 'text-[#565C68] hover:bg-[#ECEAE3] hover:text-[#191B1F]'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <span className={`${isActive ? 'text-[#2C5E48]' : 'text-[#7E8592]'}`}>
                    {item.icon}
                  </span>
                  <span>{item.label}</span>
                </div>
                {item.badge && (
                  <span
                    className={`text-[10px] font-mono px-1.5 py-0.5 rounded font-medium ${
                      item.badgeColor || 'bg-[#EAE8E1] text-[#565C68]'
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <hr className="my-4 border-[#E5E3DC]" />

        {/* Secondary Links */}
        <div className="space-y-1">
          <div className="px-3 py-1 text-[11px] font-semibold text-[#7E8592] uppercase tracking-wider">
            Platform
          </div>
          <button
            onClick={() => setActiveTab('settings')}
            className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all duration-150 text-left ${
              activeTab === 'settings'
                ? 'bg-white text-[#191B1F] shadow-sm border border-[#E5E3DC]/80 font-bold'
                : 'text-[#565C68] hover:bg-[#ECEAE3] hover:text-[#191B1F]'
            }`}
          >
            <Settings className={`w-4 h-4 ${activeTab === 'settings' ? 'text-[#2C5E48]' : 'text-[#7E8592]'}`} />
            <span>Settings & Rules</span>
          </button>
          <button
            onClick={() => setActiveTab('methodology')}
            className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all duration-150 text-left ${
              activeTab === 'methodology'
                ? 'bg-white text-[#191B1F] shadow-sm border border-[#E5E3DC]/80 font-bold'
                : 'text-[#565C68] hover:bg-[#ECEAE3] hover:text-[#191B1F]'
            }`}
          >
            <HelpCircle className={`w-4 h-4 ${activeTab === 'methodology' ? 'text-[#2C5E48]' : 'text-[#7E8592]'}`} />
            <span>SANKET Methodology</span>
          </button>
        </div>

      </div>

      {/* Bottom Mission statement / SANKET banner */}
      <div className="p-4 border-t border-[#E5E3DC] bg-[#FAF9F5]">
        <div className="p-2.5 rounded-lg bg-white border border-[#E5E3DC] text-left">
          <div className="flex items-center gap-1.5 text-[11px] font-bold text-[#2C5E48]">
            <Eye className="w-3.5 h-3.5" />
            <span>SANKET Paradigm</span>
          </div>
          <p className="text-[11px] text-[#565C68] mt-1 leading-snug italic">
            "Every report is a signal. Together, they reveal the real problem."
          </p>
        </div>
      </div>
    </aside>
  );
};
