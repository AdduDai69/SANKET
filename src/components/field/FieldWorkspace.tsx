/**
 * FieldWorkspace — the main Field Worker frame.
 *
 * A separate, operational workspace within CivicLens: ASSIGNED → UNDERSTAND →
 * NAVIGATE → EXECUTE → CAPTURE → SUBMIT → VERIFY. Reuses the SAME incident
 * model and the SAME shared Leaflet map as Admin/Citizen.
 *
 * Routes (wired in App.tsx):
 *   /field            → Home
 *   /field/jobs       → Work queue
 *   /field/jobs/:id   → Job detail
 *   /field/map        → Field map
 *   /field/history    → Completed jobs
 *   /field/profile    → Profile + prototype workspace switcher
 */
import React, { useMemo, useState } from 'react';
import './field.css';
import { useCivic } from '../../context/CivicContext';
import type { Incident } from '../../types/civic';
import { DEPARTMENTS, toCompletedJobs, toMyJobs } from './fieldData';
import type { Department, FieldRoute } from './fieldData';
import { FieldBottomNav, FieldHeader } from './FieldShell';
import {
  FieldHistoryPage,
  FieldHomePage,
  FieldJobsPage,
  FieldMapPage,
  FieldNotifications,
  FieldProfilePage,
} from './FieldPages';
import { FieldJobDetail } from './FieldJobDetail';
import { ChevronRight } from 'lucide-react';

export type { FieldRoute } from './fieldData';

export const FieldWorkspace: React.FC<{
  route: FieldRoute;
  jobId?: string | null;
  onNavigate: (path: string) => void;
}> = ({ route, jobId, onNavigate }) => {
  const { incidents, notifications, unreadNotificationCount } = useCivic();
  const [showNotifications, setShowNotifications] = useState(false);

  // Always start with null so EVERY time the user clicks on Field Worker,
  // the category/department selection options are displayed first.
  const [selectedDepartment, setSelectedDepartment] = useState<Department | null>(null);

  const handleSelectDepartment = (dept: Department) => {
    setSelectedDepartment(dept);
  };

  const handleSwitchDepartment = () => {
    setSelectedDepartment(null);
  };

  const go = (next: FieldRoute) => {
    if (next === 'home') {
      setSelectedDepartment(null);
    }
    onNavigate(
      next === 'home'
        ? '/field'
        : next === 'jobs'
          ? '/field/jobs'
          : next === 'map'
            ? '/field/map'
            : next === 'history'
              ? '/field/history'
              : '/field/profile'
    );
  };

  // Field Worker queue strictly filtered to the selected department
  const myJobs = useMemo<Incident[]>(
    () => toMyJobs(incidents, selectedDepartment),
    [incidents, selectedDepartment]
  );
  const completed = useMemo<Incident[]>(
    () => toCompletedJobs(incidents, selectedDepartment),
    [incidents, selectedDepartment]
  );

  const openJob = (id: string) => onNavigate(`/field/jobs/${id}`);

  // -----------------------------------------------------------------
  // Screen 1: Mandatory Department Selection Screen (Section 8)
  // -----------------------------------------------------------------
  if (!selectedDepartment) {
    return (
      <div className="field-workspace min-h-screen bg-[#FBFBF9] flex flex-col justify-between">
        <a href="#field-main" className="fw-skip-link">
          Skip to main content
        </a>

        <FieldHeader
          active={route}
          unreadCount={unreadNotificationCount}
          onNavigate={go}
          onNotifications={() => setShowNotifications(true)}
        />

        <main id="field-main" className="fw-frame fw-main flex items-center justify-center p-4 py-8">
          <div className="w-full max-w-md bg-white rounded-2xl border border-[#E5E3DC] shadow-sm p-6 sm:p-8 space-y-6">
            <div className="text-center space-y-2">
              <span className="inline-block text-[11px] font-bold font-mono tracking-widest text-[#2C5E48] uppercase bg-[#EBF7EF] px-3 py-1 rounded-full border border-[#C8EAD4]">
                FIELD WORKER
              </span>
              <h1 className="text-2xl font-black text-[#191B1F] tracking-tight">
                Select your department
              </h1>
              <p className="text-xs text-[#565C68] max-w-xs mx-auto">
                Select your municipal department to view your assigned work queue and field tasks.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-2.5">
              {DEPARTMENTS.map((dept) => {
                const count = toMyJobs(incidents, dept).length;
                return (
                  <button
                    key={dept}
                    onClick={() => handleSelectDepartment(dept)}
                    className="w-full p-4 rounded-xl border border-[#E5E3DC] hover:border-[#2C5E48] hover:bg-[#FAF9F5] active:bg-[#F4F3EF] transition-all flex items-center justify-between group text-left shadow-2xs hover:shadow-xs"
                  >
                    <div className="space-y-0.5">
                      <div className="text-sm font-bold text-[#191B1F] group-hover:text-[#2C5E48] transition-colors">
                        {dept}
                      </div>
                      <div className="text-[11px] text-[#7E8592]">
                        {dept === 'Electrical' && 'Streetlights, signals & power'}
                        {dept === 'Roads' && 'Potholes, pavement & road damage'}
                        {dept === 'Water Supply' && 'Pipelines, water leakage & drainage'}
                        {dept === 'Sanitation' && 'Garbage, waste & clean public areas'}
                        {dept === 'Horticulture' && 'Fallen trees & public green areas'}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono font-semibold text-[#565C68] bg-[#F4F3EF] px-2 py-0.5 rounded border border-[#E5E3DC]">
                        {count} {count === 1 ? 'task' : 'tasks'}
                      </span>
                      <ChevronRight className="w-4 h-4 text-[#7E8592] group-hover:text-[#2C5E48] transition-transform group-hover:translate-x-0.5" />
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </main>

        <FieldBottomNav active={route} onNavigate={go} />

        {showNotifications && (
          <FieldNotifications
            notifications={notifications}
            onClose={() => setShowNotifications(false)}
          />
        )}
      </div>
    );
  }

  // -----------------------------------------------------------------
  // Screen 2: Role -> Worker Dashboard (Section 9 & 10)
  // -----------------------------------------------------------------
  return (
    <div className="field-workspace">
      <a href="#field-main" className="fw-skip-link">
        Skip to main content
      </a>

      <FieldHeader
        active={route}
        unreadCount={unreadNotificationCount}
        department={selectedDepartment}
        onNavigate={go}
        onNotifications={() => setShowNotifications(true)}
        onSwitchDepartment={handleSwitchDepartment}
      />

      {/* Role Banner with Switch Department Button */}
      <div className="bg-[#FAF9F5] border-b border-[#E5E3DC] px-4 py-2 flex items-center justify-between text-xs">
        <div className="flex items-center gap-2">
          <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-[#2C5E48] bg-[#EBF7EF] px-2 py-0.5 rounded border border-[#C8EAD4]">
            {selectedDepartment.toUpperCase()} FIELD WORKER
          </span>
          <span className="text-[#565C68] font-medium hidden sm:inline">
            Active department queue ({myJobs.length} assigned)
          </span>
        </div>
        <button
          onClick={handleSwitchDepartment}
          className="text-xs font-bold text-[#2C5E48] hover:text-[#1E4333] hover:underline flex items-center gap-1"
        >
          <span>Switch Department</span>
          <ChevronRight className="w-3 h-3" />
        </button>
      </div>

      <main id="field-main" className="fw-frame fw-main">
        {route === 'home' && (
          <FieldHomePage
            jobs={myJobs}
            selectedDepartment={selectedDepartment}
            onOpenJob={openJob}
            onNavigate={go}
            onSwitchDepartment={handleSwitchDepartment}
          />
        )}
        {route === 'jobs' && !jobId && (
          <FieldJobsPage
            jobs={myJobs}
            selectedDepartment={selectedDepartment}
            onOpenJob={openJob}
            onSwitchDepartment={handleSwitchDepartment}
          />
        )}
        {route === 'map' && <FieldMapPage jobs={myJobs} onOpenJob={openJob} />}
        {route === 'history' && <FieldHistoryPage completed={completed} />}
        {route === 'profile' && <FieldProfilePage onNavigate={onNavigate} />}
        {/* Job detail is rendered on the jobs route when an id is present */}
        {jobId && route === 'jobs' && <FieldJobDetail key={jobId} incidentId={jobId} />}
      </main>

      <FieldBottomNav active={route} onNavigate={go} />

      {showNotifications && (
        <FieldNotifications
          notifications={notifications}
          onClose={() => setShowNotifications(false)}
        />
      )}
    </div>
  );
};