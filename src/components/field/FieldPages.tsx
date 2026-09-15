/**
 * Field Worker pages: Home, Jobs queue, Map, History, Profile + Notifications.
 *
 * - Home/Queue: actionable assigned work ("What do I need to fix?").
 * - Map: SAME shared Leaflet CivicMap (public layer, no Admin intelligence),
 *   with the worker's own approximate location.
 * - History: completed/verified jobs, lightweight.
 * - Profile: worker identity (mock), prototype workspace switcher.
 */
import React, { useMemo, useState } from 'react';
import {
  Bell,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  Clock,
  Calendar,
  Filter,
  HardHat,
  Landmark,
  LifeBuoy,
  LogOut,
  Map,
  MapPin,
  Play,
  Repeat,
  ShieldCheck,
  X,
} from 'lucide-react';
import { CivicMap } from '../common/CivicMap';
import type { CivicNotification, Incident } from '../../types/civic';
import { useCivic } from '../../context/CivicContext';
import { greetingForNow, useCitizenLocation } from '../citizen/useCitizenLocation';
import { categoryTitle, FIELD_STATUS, jobPriority, navigateTo, sortJobQueue } from './fieldData';
import type { FieldRoute } from './fieldData';

/* ---------------- Shared bits ---------------- */

export const JobStatusPill: React.FC<{ status: Incident['status'] }> = ({ status }) => {
  const info = FIELD_STATUS[status];
  return (
    <span className={`fw-status fw-status-${info.tone}`}>
      <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
      {info.label}
    </span>
  );
};

export const SectionHeading: React.FC<{
  eyebrow?: string;
  title: string;
  action?: string;
  onAction?: () => void;
}> = ({ eyebrow, title, action, onAction }) => (
  <div className="flex items-end justify-between gap-3">
    <div>
      {eyebrow && <p className="fw-eyebrow">{eyebrow}</p>}
      <h2 className="mt-1 text-lg font-extrabold tracking-[-.035em] text-[#191B1F]">{title}</h2>
    </div>
    {action && (
      <button className="fw-text-action" onClick={onAction}>
        {action}
        <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
      </button>
    )}
  </div>
);

/* ---------------- Job card ---------------- */

const formatAssignedTime = (iso?: string | null) => {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '—';
    return d.toLocaleString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  } catch {
    return '—';
  }
};

export const JobCard: React.FC<{ incident: Incident; onOpen: () => void }> = ({
  incident,
  onOpen,
}) => {
  const priority = jobPriority(incident);
  const ticketLabel = incident.ticketNumber
    ? (incident.ticketNumber.startsWith('CHD-') || incident.ticketNumber.startsWith('TKT-')
      ? incident.ticketNumber
      : `CHD-${incident.ticketNumber}`)
    : `#${incident.id.slice(0, 8)}`;
  const assignedDate = formatAssignedTime(incident.assignedAt || incident.reportedAt);

  return (
    <button
      onClick={onOpen}
      className={`fw-job-card fw-priority-${priority.tone} text-left w-full`}
      aria-label={`${priority.label}: ${categoryTitle(incident)} in ${incident.sector}.`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-[11px] font-bold text-[#565C68] bg-[#F4F3EF] px-2 py-0.5 rounded border border-[#E5E3DC]">
          Complaint {ticketLabel}
        </span>
        <span className={`fw-priority-flag tone-${priority.tone}`}>{priority.label}</span>
      </div>

      <div className="mt-2">
        <span className="text-[11px] text-[#7E8592] uppercase font-bold tracking-wider block">
          Category: <b className="text-[#191B1F] normal-case">{categoryTitle(incident)}</b>
        </span>
      </div>

      <div className="fw-job-meta mt-2 grid grid-cols-1 sm:grid-cols-2 gap-1 text-xs">
        <span className="flex items-center gap-1.5">
          <MapPin className="h-3.5 w-3.5 text-[#2C5E48] shrink-0" aria-hidden="true" />
          <span>Location: <b>{incident.sector}</b></span>
        </span>
        <span className="flex items-center gap-1.5">
          <Clock className="h-3.5 w-3.5 text-[#7E8592] shrink-0" aria-hidden="true" />
          <span>Assigned On: <b>{assignedDate}</b></span>
        </span>
        {incident.isRecurring && (
          <span className="flex items-center gap-1.5 text-[#C88427]">
            <Repeat className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span>Recurring location</span>
          </span>
        )}
      </div>

      <div className="fw-job-foot mt-3 pt-2 border-t border-[#F4F3EF] flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-[#1E6B42]">
          <CheckCircle2 className="h-3.5 w-3.5" />
          <span>Status: <b>{incident.assignmentStatus || 'Assigned'}</b></span>
        </div>
        <span className="fw-text-action">
          View task <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
        </span>
      </div>
    </button>
  );
};

/* =================================================================
 * HOME
 * ================================================================= */

export const FieldHomePage: React.FC<{
  jobs: Incident[];
  selectedDepartment?: string | null;
  onOpenJob: (id: string) => void;
  onNavigate: (route: FieldRoute) => void;
  onSwitchDepartment?: () => void;
}> = ({ jobs, selectedDepartment, onOpenJob, onSwitchDepartment }) => {
  const sorted = useMemo(() => sortJobQueue(jobs), [jobs]);
  const inProgress = jobs.filter((j) => j.status === 'in_progress').length;
  const pending = jobs.filter((j) => j.status === 'assigned' || j.assignmentStatus === 'Assigned').length;

  return (
    <div className="fw-page">
      <section className="fw-welcome">
        <div className="flex items-center justify-between gap-2">
          <p className="fw-eyebrow">
            {selectedDepartment ? `${selectedDepartment.toUpperCase()} FIELD WORKER` : "TODAY'S WORK"} ·{' '}
            {new Date().toLocaleDateString(undefined, {
              weekday: 'long',
              day: 'numeric',
              month: 'short',
            })}
          </p>
          {onSwitchDepartment && (
            <button
              onClick={onSwitchDepartment}
              className="text-[11px] font-bold text-[#2C5E48] hover:underline"
            >
              Switch Department
            </button>
          )}
        </div>
        <h1 className="mt-1">{selectedDepartment ? `${selectedDepartment.toUpperCase()} FIELD WORKER` : `${greetingForNow()}, Raj`}</h1>
        <p>
          {jobs.length
            ? `Assigned Tasks: ${jobs.length} incident${jobs.length === 1 ? '' : 's'} assigned to ${selectedDepartment || 'your department'}. Highest priority first.`
            : `No jobs assigned for ${selectedDepartment || 'your department'} right now — new assignments will appear here.`}
        </p>
      </section>

      <div className="fw-summary-row" role="list" aria-label="Work summary">
        <div className="fw-summary-card" role="listitem">
          <b>{jobs.length}</b>
          <span>Assigned Tasks</span>
        </div>
        <div className="fw-summary-card is-rust" role="listitem">
          <b>{sorted.filter((j) => jobPriority(j).label === 'High Priority').length}</b>
          <span>High Priority</span>
        </div>
        <div className="fw-summary-card is-teal" role="listitem">
          <b>{inProgress}</b>
          <span>In Progress</span>
        </div>
      </div>

      {/* -------- Queue -------- */}
      <section className="mt-6">
        <SectionHeading
          eyebrow={selectedDepartment ? `${selectedDepartment.toUpperCase()} ASSIGNMENTS` : "TODAY'S ASSIGNMENTS"}
          title="Assigned Tasks"
        />
        {sorted.length ? (
          <div className="mt-4 space-y-3">
            {sorted.map((incident) => (
              <JobCard
                key={incident.id}
                incident={incident}
                onOpen={() => onOpenJob(incident.id)}
              />
            ))}
          </div>
        ) : (
          <p className="mt-4 text-sm text-[#565C68]">
            All assigned work for {selectedDepartment || 'your department'} is complete. New assignments will appear here.
          </p>
        )}
      </section>
    </div>
  );
};

/* ---------------- Jobs list ---------------- */

export const FieldJobsPage: React.FC<{
  jobs: Incident[];
  selectedDepartment?: string | null;
  onOpenJob: (id: string) => void;
  onSwitchDepartment?: () => void;
}> = ({ jobs, selectedDepartment, onOpenJob, onSwitchDepartment }) => {
  const [dateFilter, setDateFilter] = useState<'all' | 'today' | 'upcoming'>('all');
  const [priorityFilter, setPriorityFilter] = useState<'all' | 'high' | 'medium' | 'low'>('all');

  const isTaskToday = (job: Incident): boolean => {
    const dateStr = job.assignedAt || job.reportedAt;
    if (!dateStr) return false;
    const d = new Date(dateStr);
    const now = new Date();
    const isSameDay =
      d.getFullYear() === now.getFullYear() &&
      d.getMonth() === now.getMonth() &&
      d.getDate() === now.getDate();
    return isSameDay || job.waitingDays === 0;
  };

  const isTaskUpcoming = (job: Incident): boolean => {
    const dateStr = job.assignedAt || job.reportedAt;
    if (!dateStr) return false;
    const d = new Date(dateStr);
    const now = new Date();
    return d.getTime() > now.getTime() || job.waitingDays > 0;
  };

  const matchesPriority = (job: Incident, filter: 'all' | 'high' | 'medium' | 'low'): boolean => {
    if (filter === 'all') return true;
    const p = jobPriority(job);
    const label = p.label.toLowerCase();
    const risk = (job.riskLevel || '').toLowerCase();

    if (filter === 'high') {
      return label.includes('high') || risk === 'high' || risk === 'critical';
    }
    if (filter === 'medium') {
      return label.includes('medium') || risk === 'medium';
    }
    if (filter === 'low') {
      return label.includes('standard') || risk === 'low';
    }
    return true;
  };

  const filteredJobs = useMemo(() => {
    return jobs.filter((job) => {
      // Date filter
      if (dateFilter === 'today' && !isTaskToday(job)) return false;
      if (dateFilter === 'upcoming' && !isTaskUpcoming(job)) return false;

      // Priority filter
      if (!matchesPriority(job, priorityFilter)) return false;

      return true;
    });
  }, [jobs, dateFilter, priorityFilter]);

  const sorted = useMemo(() => sortJobQueue(filteredJobs), [filteredJobs]);
  const isFiltered = dateFilter !== 'all' || priorityFilter !== 'all';

  const clearFilters = () => {
    setDateFilter('all');
    setPriorityFilter('all');
  };

  return (
    <div className="fw-page">
      <div className="flex items-center justify-between">
        <SectionHeading
          eyebrow={selectedDepartment ? `${selectedDepartment.toUpperCase()} WORK QUEUE` : "WORK QUEUE"}
          title="Assigned Tasks"
        />
        {onSwitchDepartment && (
          <button
            onClick={onSwitchDepartment}
            className="text-xs font-bold text-[#2C5E48] hover:underline"
          >
            Switch Department
          </button>
        )}
      </div>
      <p className="mt-1 text-sm text-[#565C68]">
        {jobs.length} task{jobs.length === 1 ? '' : 's'} assigned to {selectedDepartment || 'your department'}.
      </p>

      {/* FILTER CONTROLS */}
      <div className="mt-4 bg-white border border-[#E5E3DC] rounded-xl p-3 sm:p-4 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          {/* Date Filter */}
          <div className="flex flex-col gap-1.5 flex-1 min-w-[140px]">
            <label className="text-[11px] font-bold text-[#565C68] uppercase tracking-wider flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-[#7E8592]" />
              Date
            </label>
            <div className="inline-flex rounded-lg border border-[#E5E3DC] p-0.5 bg-[#FAF9F5]">
              {(['all', 'today', 'upcoming'] as const).map((d) => (
                <button
                  key={d}
                  onClick={() => setDateFilter(d)}
                  className={`flex-1 px-3 py-1 text-xs font-semibold rounded-md transition-colors capitalize ${
                    dateFilter === d
                      ? 'bg-white text-[#191B1F] shadow-xs font-bold'
                      : 'text-[#7E8592] hover:text-[#191B1F]'
                  }`}
                >
                  {d}
                </button>
              ))}
            </div>
          </div>

          {/* Priority Filter */}
          <div className="flex flex-col gap-1.5 flex-1 min-w-[180px]">
            <label className="text-[11px] font-bold text-[#565C68] uppercase tracking-wider flex items-center gap-1.5">
              <Filter className="w-3.5 h-3.5 text-[#7E8592]" />
              Priority
            </label>
            <div className="inline-flex rounded-lg border border-[#E5E3DC] p-0.5 bg-[#FAF9F5]">
              {(['all', 'high', 'medium', 'low'] as const).map((p) => (
                <button
                  key={p}
                  onClick={() => setPriorityFilter(p)}
                  className={`flex-1 px-2.5 py-1 text-xs font-semibold rounded-md transition-colors capitalize ${
                    priorityFilter === p
                      ? 'bg-white text-[#191B1F] shadow-xs font-bold'
                      : 'text-[#7E8592] hover:text-[#191B1F]'
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          {/* Clear Filters Button */}
          {isFiltered && (
            <div className="sm:self-end flex items-center">
              <button
                onClick={clearFilters}
                className="px-3 py-1.5 text-xs font-bold text-[#C54E38] hover:bg-[#FDF0ED] border border-[#F8D2CA] rounded-lg transition-colors flex items-center gap-1.5 w-full sm:w-auto justify-center"
              >
                <X className="w-3.5 h-3.5" />
                Clear Filters
              </button>
            </div>
          )}
        </div>

        {/* Count indicator */}
        <div className="mt-3 pt-2.5 border-t border-[#F4F3EF] flex flex-wrap items-center justify-between gap-1 text-xs text-[#7E8592]">
          <span>
            Showing <b className="text-[#191B1F]">{sorted.length}</b> of {jobs.length} task{jobs.length === 1 ? '' : 's'}
          </span>
          {isFiltered && (
            <span className="text-xs font-medium text-[#2C5E48]">
              {dateFilter !== 'all' ? `Date: ${dateFilter}` : ''}
              {dateFilter !== 'all' && priorityFilter !== 'all' ? ' • ' : ''}
              {priorityFilter !== 'all' ? `Priority: ${priorityFilter}` : ''}
            </span>
          )}
        </div>
      </div>

      <div className="mt-4 space-y-3">
        {sorted.length > 0 ? (
          sorted.map((incident) => (
            <JobCard key={incident.id} incident={incident} onOpen={() => onOpenJob(incident.id)} />
          ))
        ) : (
          <div className="bg-white border border-[#E5E3DC] rounded-xl p-8 text-center">
            <p className="text-sm font-bold text-[#191B1F]">No matching tasks</p>
            <p className="text-xs text-[#7E8592] mt-1">
              No assigned tasks match your selected date and priority filters.
            </p>
            {isFiltered && (
              <button
                onClick={clearFilters}
                className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-[#FAF9F5] border border-[#E5E3DC] text-[#191B1F] hover:bg-[#F4F3EF]"
              >
                <X className="w-3.5 h-3.5" />
                Clear Filters
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

/* =================================================================
 * MAP
 * ================================================================= */

export const FieldMapPage: React.FC<{
  jobs: Incident[];
  onOpenJob: (id: string) => void;
}> = ({ jobs, onOpenJob }) => {
  const [selectedId, setSelectedId] = useState<string | null>(jobs[0]?.id ?? null);
  const { coords } = useCitizenLocation();
  const selected = jobs.find((j) => j.id === selectedId) ?? null;

  return (
    <div className="fw-page">
      <SectionHeading eyebrow="FIELD MAP" title="Your job locations" />
      <p className="citizen-hint">
        Pan, zoom, and tap markers — the same interactive map used across CivicLens.
      </p>

      <div className="citizen-map-wrapper citizen-map-page-wrapper">
        <CivicMap
          variant="citizen"
          incidents={jobs}
          height="100%"
          selectedIncidentId={selectedId}
          onSelectIncident={(id) => setSelectedId(id)}
          onIssueClick={(id) => onOpenJob(id)}
          userLocation={coords}
          focusTarget={selected ? [selected.latitude, selected.longitude] : null}
        />
      </div>

      <p className="citizen-location-note">
        <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
        Your approximate location appears when location permission is granted. Reporters' private
        locations are never shown.
      </p>
    </div>
  );
};

/* =================================================================
 * HISTORY
 * ================================================================= */

export const FieldHistoryPage: React.FC<{ completed: Incident[] }> = ({ completed }) => (
  <div className="fw-page">
    <SectionHeading eyebrow="COMPLETED" title="Your completed jobs" />
    <p className="mt-1 text-sm text-[#565C68]">
      Verified completions from the municipal team appear here.
    </p>
    <div className="mt-4 space-y-3">
      {completed.length ? (
        completed.map((incident) => (
          <article key={incident.id} className="fw-job-card" style={{ cursor: 'default' }}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <span className="fw-job-title">{categoryTitle(incident)}</span>
                <div className="fw-job-meta">
                  <span>
                    <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
                    {incident.sector}
                  </span>
                  <span>
                    <Clock className="h-3.5 w-3.5" aria-hidden="true" />
                    Completed{' '}
                    {new Date(incident.lastUpdated).toLocaleDateString(undefined, {
                      month: 'short',
                      day: 'numeric',
                    })}
                  </span>
                </div>
              </div>
              <JobStatusPill status={incident.status} />
            </div>
            <p className="mt-2 text-xs text-[#565C68]">
              {FIELD_STATUS[incident.status].explanation}
            </p>
          </article>
        ))
      ) : (
        <p className="text-sm text-[#565C68]">Completed jobs will appear here once verified.</p>
      )}
    </div>
  </div>
);

/* =================================================================
 * PROFILE
 * ================================================================= */

export const FieldProfilePage: React.FC<{
  onNavigate: (path: string) => void;
}> = ({ onNavigate }) => {
  const { showToast } = useCivic();
  const [available, setAvailable] = useState(true);

  return (
    <div className="fw-page">
      <SectionHeading eyebrow="PROFILE" title="Your field account" />

      <section className="citizen-profile-card">
        <div className="citizen-profile-avatar" aria-hidden="true">
          RK
        </div>
        <div>
          <h2 className="text-base font-extrabold text-[#191B1F]">Raj Kumar</h2>
          <p className="text-xs text-[#565C68]">Field Worker · EMP-20481</p>
          <p className="text-xs text-[#565C68]">PWD Road Maintenance · Zone 1</p>
        </div>
        <span className="fw-status fw-status-green ml-auto">
          <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
          Available
        </span>
      </section>

      <section className="citizen-settings-list" aria-label="Field Worker settings">
        <div className="citizen-settings-row">
          <span>
            <HardHat className="h-4 w-4" aria-hidden="true" />
            Available for assignments
          </span>
          <span className="citizen-switch">
            <input
              type="checkbox"
              checked={available}
              onChange={(e) => setAvailable(e.target.checked)}
              aria-label="Available for assignments"
            />
            <em aria-hidden="true" />
          </span>
        </div>
        <button
          className="citizen-settings-row"
          onClick={() =>
            showToast('Help & support', 'Support is not part of this prototype yet.', 'info')
          }
        >
          <span>
            <LifeBuoy className="h-4 w-4" aria-hidden="true" />
            Help & support
          </span>
          <b>
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </b>
        </button>
        <button
          className="citizen-settings-row"
          onClick={() => onNavigate('/')}
          aria-label="Sign out and return to the workspace selection screen"
        >
          <span>
            <LogOut className="h-4 w-4" aria-hidden="true" />
            Sign out
          </span>
          <b>
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </b>
        </button>
      </section>

      {/* -------- Prototype workspace switcher (demo only) -------- */}
      <section className="citizen-switcher" aria-labelledby="fw-switcher-title">
        <p className="fw-eyebrow" id="fw-switcher-title">
          PROTOTYPE WORKSPACE SWITCHER
        </p>
        <p className="mt-1 text-sm text-[#565C68]">
          Demo-only access to the other CivicLens workspaces. A real field account would not see
          this.
        </p>
        <div className="citizen-switcher-grid">
          <button onClick={() => onNavigate('/')}>
            <ShieldCheck className="h-4 w-4" aria-hidden="true" />
            Role selection
          </button>
          <button onClick={() => onNavigate('/citizen')}>
            <ClipboardList className="h-4 w-4" aria-hidden="true" />
            Citizen
          </button>
          <button onClick={() => onNavigate('/admin')}>
            <Landmark className="h-4 w-4" aria-hidden="true" />
            Municipal Admin
          </button>
        </div>
      </section>
    </div>
  );
};

/* =================================================================
 * NOTIFICATIONS PANEL
 * ================================================================= */

export const FieldNotifications: React.FC<{
  notifications: CivicNotification[];
  onClose: () => void;
}> = ({ notifications, onClose }) => {
  const { markNotificationRead, clearAllNotifications } = useCivic();

  return (
    <div
      className="citizen-notification-layer"
      role="dialog"
      aria-modal="true"
      aria-label="Field notifications"
    >
      <button className="absolute inset-0" onClick={onClose} aria-label="Close notifications" />
      <section>
        <div className="flex items-center justify-between">
          <div>
            <p className="fw-eyebrow">FIELD UPDATES</p>
            <h2 className="text-lg font-extrabold tracking-[-.03em]">Notifications</h2>
          </div>
          <button className="fw-icon-button" onClick={onClose} aria-label="Close notifications">
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        {notifications.length ? (
          <>
            {notifications.slice(0, 6).map((n) => (
              <button
                key={n.id}
                className={`citizen-notification ${n.read ? '' : 'is-unread'}`}
                onClick={() => markNotificationRead(n.id)}
              >
                <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                <span>
                  <b>{n.title}</b>
                  <small>
                    {n.message} ·{' '}
                    {new Date(n.timestamp).toLocaleDateString(undefined, {
                      month: 'short',
                      day: 'numeric',
                    })}
                  </small>
                </span>
              </button>
            ))}
            <button className="fw-text-action mt-3 self-center" onClick={clearAllNotifications}>
              Mark all as read
            </button>
          </>
        ) : (
          <div className="citizen-notification-empty" role="status">
            <Bell className="mx-auto h-5 w-5" aria-hidden="true" />
            <p className="mt-2">You're all caught up.</p>
            <p className="text-xs text-[#7E8592]">
              Assignment and verification updates will appear here.
            </p>
          </div>
        )}

        <p className="citizen-confirm-fineprint mt-auto">
          <ClipboardList className="h-3.5 w-3.5" aria-hidden="true" />
          Tap a notification to mark it as read.
        </p>
      </section>
    </div>
  );
};