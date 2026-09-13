/**
 * Field Worker–facing data helpers & prototype data.
 *
 * Reuses the SAME underlying incident model as Admin/Citizen — the field
 * worker simply sees a different presentation: "What do I need to fix?"
 * SANKET internals stay behind the scenes; the worker sees human reasons
 * ("Why this job?"), not formulas.
 */
import type { Incident, IncidentStatus } from '../../types/civic';

export type FieldRoute = 'home' | 'jobs' | 'map' | 'history' | 'profile';

/** Navigate via the History API so App.tsx re-renders the new route. */
export const navigateTo = (path: string) => {
  window.history.pushState({}, '', path);
  window.dispatchEvent(new PopStateEvent('popstate'));
};

export const FIELD_ROUTES: Record<FieldRoute, string> = {
  home: '/field',
  jobs: '/field/jobs',
  map: '/field/map',
  history: '/field/history',
  profile: '/field/profile',
};

/* ---------------- Job status (operational language) ---------------- */

export interface FieldStatusInfo {
  label: string;
  tone: 'slate' | 'gold' | 'blue' | 'teal' | 'green';
  explanation: string;
}

export const FIELD_STATUS: Record<IncidentStatus, FieldStatusInfo> = {
  reported: { label: 'Unassigned', tone: 'slate', explanation: 'Waiting for dispatch assignment.' },
  needs_review: {
    label: 'Under Review',
    tone: 'gold',
    explanation: 'Supervisory review of the evidence is underway.',
  },
  assigned: {
    label: 'Assigned to you',
    tone: 'blue',
    explanation: 'This job is in your queue. Travel to the site and start work.',
  },
  in_progress: {
    label: 'In Progress',
    tone: 'teal',
    explanation: 'Work has started on site. Capture evidence and submit completion.',
  },
  resolved: {
    label: 'Verified',
    tone: 'green',
    explanation: 'Your completion evidence was verified by the municipal team.',
  },
  closed: {
  label: 'Closed',
  tone: 'slate',
  explanation: 'This field job has been closed after resolution or verification.',
},
};

/* ---------------- Job priority (operational context, no formulas) ---------------- */

export interface JobPriority {
  label: 'High Priority' | 'Medium Priority' | 'Standard';
  tone: 'rust' | 'gold' | 'slate';
  /** Human-readable "why this job" reasons derived from incident data. */
  reasons: string[];
}

export const jobPriority = (incident: Incident): JobPriority => {
  const high = incident.riskLevel === 'critical' || incident.riskLevel === 'high';
  const reasons: string[] = [];
  if (incident.confidenceEvidence.relatedReportsCount > 3) {
    reasons.push(`Multiple reports nearby (${incident.confidenceEvidence.relatedReportsCount})`);
  }
  if (incident.isRecurring) {
    reasons.push(`Recurring location (${incident.recurrenceCount}× recorded)`);
  }
  if (incident.waitingDays > 0) {
    reasons.push(`${incident.waitingDays} days waiting`);
  }
  if (incident.locationExposure >= 7) {
    reasons.push('High public exposure');
  }
  return {
    label: high ? 'High Priority' : incident.riskLevel === 'medium' ? 'Medium Priority' : 'Standard',
    tone: high ? 'rust' : incident.riskLevel === 'medium' ? 'gold' : 'slate',
    reasons: reasons.length ? reasons : ['Scheduled maintenance route'],
  };
};

/* ---------------- Job selection ---------------- */

/** Prototype: incidents "assigned to this worker" (assigned or active work). */
export const toMyJobs = (incidents: Incident[]): Incident[] =>
  incidents.filter((i) => i.status === 'assigned' || i.status === 'in_progress');

/** Completed/verified jobs for history. */
export const toCompletedJobs = (incidents: Incident[]): Incident[] =>
  incidents.filter((i) => i.status === 'resolved' || i.status === 'needs_review');

/** Queue ordering: highest urgency first (priority → waiting days). */
export const sortJobQueue = (jobs: Incident[]): Incident[] =>
  [...jobs].sort(
    (a, b) =>
      (b.riskLevel === 'critical' ? 2 : b.riskLevel === 'high' ? 1 : 0) -
        (a.riskLevel === 'critical' ? 2 : a.riskLevel === 'high' ? 1 : 0) || b.waitingDays - a.waitingDays
  );

export const categoryTitle = (incident: Incident): string =>
  incident.title.length < 46 ? incident.title : incident.category.replace('_', ' ');

export const updatedLabel = (incident: Incident): string => {
  const d = incident.waitingDays;
  if (d <= 0) return 'Updated just now';
  if (d === 1) return 'Updated yesterday';
  return `Updated ${d} days ago`;
};