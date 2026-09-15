import React, { useEffect, useState } from 'react';
import { CivicProvider, useCivic } from './context/CivicContext';
import { Header } from './components/common/Header';
import { Sidebar } from './components/common/Sidebar';
import { Toast } from './components/common/Toast';
import { DashboardView } from './components/views/DashboardView';
import { IncidentsView } from './components/views/IncidentsView';
import { PriorityQueueView } from './components/views/PriorityQueueView';
import { MapView } from './components/views/MapView';
import { CivicMemoryView } from './components/views/CivicMemoryView';
import { AnalyticsView } from './components/views/AnalyticsView';
import { ReportsView } from './components/views/ReportsView';
import { SettingsView } from './components/views/SettingsView';
import { MethodologyView } from './components/views/MethodologyView';
import { FieldOfficerView } from './components/views/FieldOfficerView';
import { CitizenView } from './components/views/CitizenView';
import { IncidentDetailDrawer } from './components/views/IncidentDetailDrawer';
import { ScoreExplanationModal } from './components/intelligence/ScoreExplanationModal';
import { EvidenceDrawer } from './components/intelligence/EvidenceDrawer';
import { SmartClosureModal } from './components/intelligence/SmartClosureModal';
import { CivicDnaView } from './components/views/CivicDnaView';
import { CivicDnaProfileModal } from './components/dna/CivicDnaProfileModal';
import {
  LayoutDashboard,
  AlertOctagon,
  ListOrdered,
  MapPin,
  History,
  BarChart3,
  FileText,
  Sparkles
} from 'lucide-react';
import { MunicipalTab } from './types/civic';
import { Persona } from './types/civic';
import { RoleSelectionPage } from './components/entry/RoleSelectionPage';
import { CitizenWorkspace } from './components/citizen/CitizenWorkspace';
import { FieldWorkspace } from './components/field/FieldWorkspace';

const MainShell: React.FC = () => {
  const { persona, activeTab, setActiveTab } = useCivic();

  const mobileNavItems: { id: MunicipalTab; label: string; icon: React.ReactNode }[] = [
    { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard className="w-4 h-4" /> },
    { id: 'incidents', label: 'Incidents', icon: <AlertOctagon className="w-4 h-4" /> },
    { id: 'priority_queue', label: 'Queue', icon: <ListOrdered className="w-4 h-4" /> },
    { id: 'map_view', label: 'Map', icon: <MapPin className="w-4 h-4" /> },
    { id: 'civic_dna', label: 'Civic DNA', icon: <Sparkles className="w-4 h-4" /> },
    { id: 'civic_memory', label: 'Memory', icon: <History className="w-4 h-4" /> }
  ];

  return (
    <div className="h-[100dvh] overflow-hidden isolate bg-[#FBFBF9] text-[#191B1F] flex flex-col selection:bg-[#2C5E48]/20 selection:text-[#1E4333]">
      <Header />

      {/* Main Content Router based on Persona */}
      {persona === 'municipal' && (
        <div className="flex-1 flex min-h-0 min-w-0 overflow-hidden">
          {/* Desktop Left Sidebar */}
          <div className="hidden md:block">
            <Sidebar />
          </div>

          {/* Main Scrollable View Area */}
          <main className="flex-1 min-w-0 overflow-y-auto overscroll-contain px-4 sm:px-6 lg:px-8 py-5 sm:py-6 pb-24 md:pb-8 max-w-7xl mx-auto w-full">
            {activeTab === 'dashboard' && <DashboardView />}
            {activeTab === 'incidents' && <IncidentsView />}
            {activeTab === 'priority_queue' && <PriorityQueueView />}
            {activeTab === 'map_view' && <MapView />}
            {activeTab === 'civic_dna' && <CivicDnaView />}
            {activeTab === 'civic_memory' && <CivicMemoryView />}
            {activeTab === 'analytics' && <AnalyticsView />}
            {activeTab === 'reports' && <ReportsView />}
            {activeTab === 'settings' && <SettingsView />}
            {activeTab === 'methodology' && <MethodologyView />}
          </main>

          {/* Mobile Bottom Navigation Bar */}
          <nav className="md:hidden fixed bottom-0 inset-x-0 bg-white/95 backdrop-blur-md border-t border-[#E5E3DC] z-30 flex items-center justify-around px-1 pt-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] shadow-lg">
            {mobileNavItems.map((item) => {
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`flex flex-1 flex-col items-center gap-1 py-1 px-1 rounded-lg text-[10px] font-semibold transition-colors ${
                    isActive ? 'text-[#2C5E48] font-bold' : 'text-[#7E8592]'
                  }`}
                >
                  {item.icon}
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>
        </div>
      )}

      {persona === 'field_officer' && (
        <main className="flex-1 px-4 py-5 sm:py-6 max-w-xl mx-auto w-full">
          <FieldOfficerView />
        </main>
      )}

      {persona === 'citizen' && (
        <main className="flex-1 px-4 py-5 sm:py-6 max-w-xl mx-auto w-full">
          <CitizenView />
        </main>
      )}

      {/* Global SANKET Intelligence Modals & Drawers */}
      <IncidentDetailDrawer />
      <ScoreExplanationModal />
      <EvidenceDrawer />
      <SmartClosureModal />
      <CivicDnaProfileModal />
      <Toast />
    </div>
  );
};

export default function App() {
  const [pathname, setPathname] = useState(() => window.location.pathname);

  useEffect(() => {
    const onPopState = () => setPathname(window.location.pathname);
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const navigate = (path: string) => {
    window.history.pushState({}, '', path);
    setPathname(path);
  };

  const citizenRoute = pathname === '/citizen' ? 'home' : pathname === '/citizen/map' ? 'map' : pathname === '/citizen/report' ? 'report' : pathname === '/citizen/reports' ? 'reports' : pathname === '/citizen/profile' ? 'profile' : null;

  // Field Worker routing (includes /field/jobs/:id detail routes)
  const jobMatch = pathname.match(/^\/field\/jobs\/([^/]+)$/);
  const fieldJobId = jobMatch ? jobMatch[1] : null;
  const fieldRoute: FieldRouteName | null =
    pathname === '/field'
      ? 'home'
      : pathname === '/field/jobs' || fieldJobId
        ? 'jobs'
        : pathname === '/field/map'
          ? 'map'
          : pathname === '/field/history'
            ? 'history'
            : pathname === '/field/profile'
              ? 'profile'
              : null;

  const routePersona: Record<string, Persona> = { '/admin': 'municipal' };
  const personaForRoute = routePersona[pathname];

  return (
    <CivicProvider>
      {citizenRoute ? (
        <RoutedCitizenWorkspace route={citizenRoute} onNavigate={navigate} />
      ) : fieldRoute ? (
        <RoutedFieldWorkspace route={fieldRoute} jobId={fieldJobId} onNavigate={navigate} />
      ) : personaForRoute ? (
        <RoutedWorkspace persona={personaForRoute} />
      ) : (
        <RoleSelectionPage onNavigate={navigate} />
      )}
    </CivicProvider>
  );
}

export type FieldRouteName = 'home' | 'jobs' | 'map' | 'history' | 'profile';

const RoutedWorkspace: React.FC<{ persona: Persona }> = ({ persona }) => {
  const { setPersona } = useCivic();
  useEffect(() => { setPersona(persona); }, [persona, setPersona]);
  return <MainShell />;
};

const RoutedCitizenWorkspace: React.FC<{ route: 'home' | 'map' | 'report' | 'reports' | 'profile'; onNavigate: (path: string) => void }> = ({ route, onNavigate }) => {
  const { setPersona } = useCivic();
  useEffect(() => { setPersona('citizen'); }, [setPersona]);
  return <CitizenWorkspace route={route} onNavigate={onNavigate} />;
};

const RoutedFieldWorkspace: React.FC<{ route: FieldRouteName; jobId: string | null; onNavigate: (path: string) => void }> = ({ route, jobId, onNavigate }) => {
  const { setPersona, refreshIncidents } = useCivic();
  useEffect(() => { setPersona('field_officer'); }, [setPersona]);
  useEffect(() => { refreshIncidents?.().catch(() => {}); }, [refreshIncidents]);
  return <FieldWorkspace route={route} jobId={jobId} onNavigate={onNavigate} />;
};
