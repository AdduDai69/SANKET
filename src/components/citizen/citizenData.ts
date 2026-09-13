/**
 * Citizen-facing data helpers & prototype data.
 *
 * IMPORTANT: All incident data shown to citizens is PROTOTYPE / DEMO data
 * derived from the shared mock incident store. Nothing here represents live
 * municipal data, and no private citizen information is ever exposed —
 * only public civic information (issue type, approximate area, status).
 */
import type { Incident, IncidentStatus, IssueCategory } from '../../types/civic';

export type CitizenRoute = 'home' | 'map' | 'report' | 'reports' | 'profile';

export const CITIZEN_ROUTES: Record<CitizenRoute, string> = {
  home: '/citizen',
  map: '/citizen/map',
  report: '/citizen/report',
  reports: '/citizen/reports',
  profile: '/citizen/profile',
};

/* ------------------------------------------------------------------
 * Citizen-friendly status language.
 * Internal operational terminology (risk scores, SLA, aging factors)
 * is intentionally never surfaced here.
 * ------------------------------------------------------------------ */
export interface CitizenStatusInfo {
  label: string;
  tone: 'slate' | 'gold' | 'blue' | 'teal' | 'green';
  /** Short human explanation of what this status means for the citizen. */
  explanation: string;
}

export const CITIZEN_STATUS: Record<IncidentStatus, CitizenStatusInfo> = {
  reported: {
    label: 'Reported',
    tone: 'slate',
    explanation: 'Your report has been received and queued for municipal review.',
  },
  needs_review: {
    label: 'Under Review',
    tone: 'gold',
    explanation: 'Municipal staff are verifying the details of this issue.',
  },
  assigned: {
    label: 'Assigned',
    tone: 'blue',
    explanation: 'A municipal team has been assigned to look into this issue.',
  },
  in_progress: {
    label: 'In Progress',
    tone: 'teal',
    explanation: 'Work on this issue has started on site.',
  },
  resolved: {
    label: 'Resolved',
    tone: 'green',
    explanation: 'This issue has been marked as resolved. Thank you for your report!',
  },
  closed: {
  label: 'Closed',
  tone: 'slate',
  explanation: 'This civic issue has been closed after resolution or verification.',
},
};

/** Human label for an issue category. */
export const categoryLabel = (category: IssueCategory): string =>
  ({
    pothole: 'Pothole',
    drainage: 'Drainage',
    waste: 'Waste',
    streetlight: 'Streetlight',
    road_damage: 'Road damage',
    water_leak: 'Water leak',
    other: 'Other issue',
  })[category] ?? 'Issue';

/** Relative "updated" phrasing from waiting days (prototype-friendly). */
export const updatedLabel = (waitingDays: number): string => {
  if (waitingDays <= 0) return 'Updated just now';
  if (waitingDays === 1) return 'Updated yesterday';
  return `Updated ${waitingDays} days ago`;
};

/**
 * Citizen-visible incidents. Filters the shared store down to what a
 * citizen may see: public civic information only, capped to a small set.
 * (Prototype: "my reports" are simulated as the first few incidents.)
 */
export const toCitizenIncidents = (incidents: Incident[]): Incident[] =>
  incidents.filter((i) => i.status !== 'resolved' || i.waitingDays < 20);

/** Prototype "reports I submitted" — stable subset so the demo feels real. */
export const toMyReports = (incidents: Incident[]): Incident[] =>
  incidents.filter((i) => ['pothole', 'streetlight', 'drainage'].includes(i.category)).slice(0, 3);

/** Nearby public issues (approximate area only, no personal data). */
export const toNearbyIssues = (incidents: Incident[]): Incident[] =>
  incidents.filter((i) => i.status !== 'resolved').slice(0, 4);

/** Map filter groups for the citizen map. */
export const MAP_FILTERS: { id: string; label: string; categories: IssueCategory[] }[] = [
  { id: 'all', label: 'All', categories: [] },
  { id: 'roads', label: 'Roads', categories: ['pothole', 'road_damage'] },
  { id: 'waste', label: 'Waste', categories: ['waste'] },
  { id: 'drainage', label: 'Drainage', categories: ['drainage'] },
  { id: 'streetlights', label: 'Streetlights', categories: ['streetlight'] },
];

/** Deterministic pseudo-position for prototype map markers (0–100%). */
export const markerPosition = (id: string, index: number): { left: string; top: string } => {
  const seed = id.split('').reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
  const left = 14 + ((seed * 7 + index * 23) % 72);
  const top = 18 + ((seed * 13 + index * 31) % 58);
  return { left: `${left}%`, top: `${top}%` };
};

/** Sectors offered in the report flow (prototype location picker). */
export const REPORT_SECTORS = [
  'Sector 17',
  'Sector 18',
  'Sector 19',
  'Sector 21',
  'Sector 22',
  'Sector 26',
  'Sector 35',
  'Manimajra',
];

/** Prototype categories a citizen can pick/confirm in the report flow. */
export const REPORT_CATEGORIES: IssueCategory[] = [
  'pothole',
  'streetlight',
  'drainage',
  'waste',
  'water_leak',
  'road_damage',
];