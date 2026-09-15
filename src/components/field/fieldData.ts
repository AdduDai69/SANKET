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

export const DEPARTMENTS = [
  'Electrical',
  'Roads',
  'Water Supply',
  'Sanitation',
  'Horticulture',
] as const;

export type Department = typeof DEPARTMENTS[number];

/** Deterministic Category -> Department mapping on frontend */
export const mapCategoryToDepartment = (
  category?: string | null,
  dept?: string | null
): Department => {
  // If dept is already one of the 5 canonical departments, check category first, else use dept
  const cat = (category || '').toLowerCase().trim();
  if (
    cat.includes('streetlight') ||
    cat.includes('street light') ||
    cat.includes('signal') ||
    cat.includes('electric') ||
    cat.includes('light')
  ) {
    return 'Electrical';
  }
  if (
    cat.includes('water') ||
    cat.includes('leak') ||
    cat.includes('pipeline') ||
    cat.includes('pipe') ||
    cat.includes('drain')
  ) {
    return 'Water Supply';
  }
  if (
    cat.includes('garbage') ||
    cat.includes('waste') ||
    cat.includes('sanitat') ||
    cat.includes('clean')
  ) {
    return 'Sanitation';
  }
  if (
    cat.includes('tree') ||
    cat.includes('horticult') ||
    cat.includes('green') ||
    cat.includes('park') ||
    cat.includes('branch')
  ) {
    return 'Horticulture';
  }
  if (
    cat.includes('pothole') ||
    cat.includes('road') ||
    cat.includes('pavement') ||
    cat.includes('asphalt') ||
    cat.includes('bridge')
  ) {
    return 'Roads';
  }

  // Check department string if category was generic/other
  const d = (dept || '').toLowerCase().trim();
  if (d.includes('elect') || d.includes('light')) return 'Electrical';
  if (d.includes('water') || d.includes('drain') || d.includes('pipe')) return 'Water Supply';
  if (d.includes('sanit') || d.includes('waste') || d.includes('garb')) return 'Sanitation';
  if (d.includes('hort') || d.includes('tree') || d.includes('green')) return 'Horticulture';
  if (d.includes('road') || d.includes('pothole') || d.includes('pavement')) return 'Roads';

  // If dept strictly matches canonical name
  for (const dep of DEPARTMENTS) {
    if (dep.toLowerCase() === d) return dep;
  }

  return 'Roads';
};

/** Default field workers registry */
export const DEFAULT_WORKERS: Record<Department, { id: string; name: string }> = {
  Electrical: { id: 'E-104', name: 'Rajesh Kumar' },
  Roads: { id: 'R-203', name: 'Vikas Sen' },
  'Water Supply': { id: 'W-117', name: 'Suresh Sharma' },
  Sanitation: { id: 'S-052', name: 'Amit Singh' },
  Horticulture: { id: 'H-031', name: 'Gurpreet Gill' },
};

/** Incidents assigned to this worker's department */
export const toMyJobs = (incidents: Incident[], department?: string | null): Incident[] => {
  return incidents.filter((i) => {
    // Resolved and closed jobs belong in history
    if (i.status === 'resolved' || i.status === 'closed') return false;

    if (department) {
      const resolved = mapCategoryToDepartment(i.category, i.assignedDepartment || i.department);
      return resolved.toLowerCase().trim() === department.toLowerCase().trim();
    }
    return true;
  });
};

/** Completed/verified jobs for history filtered by department */
export const toCompletedJobs = (incidents: Incident[], department?: string | null): Incident[] => {
  return incidents.filter((i) => {
    const isResolved = i.status === 'resolved' || i.status === 'closed';
    if (!isResolved) return false;

    if (department) {
      const resolved = mapCategoryToDepartment(i.category, i.assignedDepartment || i.department);
      return resolved.toLowerCase().trim() === department.toLowerCase().trim();
    }
    return true;
  });
};

export const sortJobQueue = (jobs: Incident[]): Incident[] =>
  [...jobs].sort((a, b) => {
    // 1. Newly received / citizen-submitted tasks are placed right at the top
    const aNew = (a as any).isMyReport || a.waitingDays === 0 ? 1 : 0;
    const bNew = (b as any).isMyReport || b.waitingDays === 0 ? 1 : 0;
    if (aNew !== bNew) return bNew - aNew;

    // 2. Risk score (descending)
    const riskDiff = (b.riskScore ?? 0) - (a.riskScore ?? 0);
    if (riskDiff !== 0) return riskDiff;

    // 3. Reported date / last updated (newest first)
    const aTime = new Date(a.reportedAt || a.lastUpdated || 0).getTime();
    const bTime = new Date(b.reportedAt || b.lastUpdated || 0).getTime();
    if (bTime !== aTime) return bTime - aTime;

    return (b.waitingDays ?? 0) - (a.waitingDays ?? 0);
  });

export const categoryTitle = (incident: Incident): string =>
  incident.title.length < 46 ? incident.title : incident.category.replace('_', ' ');

export const updatedLabel = (incident: Incident): string => {
  const d = incident.waitingDays;
  if (d <= 0) return 'Updated just now';
  if (d === 1) return 'Updated yesterday';
  return `Updated ${d} days ago`;
};