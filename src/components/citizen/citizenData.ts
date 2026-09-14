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
  incidents.filter((i) => (i as any).isMyReport || i.status !== 'resolved' || i.waitingDays < 20);

/**
 * Reports submitted by the citizen.
 * Includes user-submitted reports (tracked via isMyReport flag or localStorage IDs),
 * followed by default sample reports so the list is not empty on first visit.
 */
export const toMyReports = (incidents: Incident[]): Incident[] => {
  let storedUserReports: Incident[] = [];
  try {
    const raw = localStorage.getItem('civiclens_user_reports');
    if (raw) {
      storedUserReports = JSON.parse(raw);
    }
  } catch {}

  let myIds: string[] = [];
  try {
    const raw = localStorage.getItem('civiclens_my_report_ids');
    if (raw) {
      myIds = JSON.parse(raw);
    }
  } catch {}

  // Gather user reports from context memory
  const memoryUserReports = incidents.filter(
    (i) => (i as any).isMyReport || myIds.includes(i.id)
  );

  // Combine stored user reports with memory user reports without duplicates
  const userReports: Incident[] = [...memoryUserReports];
  for (const stored of storedUserReports) {
    if (!userReports.some((u) => u.id === stored.id)) {
      userReports.push(stored);
    }
  }

  // Sample default reports for demonstration if no user reports exist yet
  const defaultSample = incidents
    .filter((i) => ['pothole', 'streetlight', 'drainage'].includes(i.category))
    .slice(0, 3);

  // User submitted reports come first, followed by default sample reports
  const result: Incident[] = [...userReports];
  for (const s of defaultSample) {
    if (!result.some((r) => r.id === s.id)) {
      result.push(s);
    }
  }

  return result;
};

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

/** Standard central coordinates for Chandigarh sectors. */
export const SECTOR_COORDINATES: Record<string, [number, number]> = {
  'Sector 17': [30.7415, 76.7794],
  'Sector 18': [30.7380, 76.7865],
  'Sector 19': [30.7330, 76.7930],
  'Sector 21': [30.7250, 76.7780],
  'Sector 22': [30.7302, 76.7685],
  'Sector 26': [30.7280, 76.8080],
  'Sector 35': [30.7220, 76.7600],
  'Manimajra': [30.7180, 76.8450],
};

export interface SectorBounds {
  minLat: number;
  maxLat: number;
  minLon: number;
  maxLon: number;
}

/**
 * Exact geographic boundaries for Chandigarh administrative sectors.
 * Points outside these boundaries do NOT belong to the sector.
 */
export const SECTOR_BOUNDARIES: Record<string, SectorBounds> = {
  'Sector 17': { minLat: 30.7345, maxLat: 30.7485, minLon: 76.7720, maxLon: 76.7865 },
  'Sector 18': { minLat: 30.7310, maxLat: 30.7450, minLon: 76.7795, maxLon: 76.7935 },
  'Sector 19': { minLat: 30.7260, maxLat: 30.7400, minLon: 76.7860, maxLon: 76.8000 },
  'Sector 21': { minLat: 30.7180, maxLat: 30.7320, minLon: 76.7710, maxLon: 76.7850 },
  'Sector 22': { minLat: 30.7230, maxLat: 30.7375, minLon: 76.7610, maxLon: 76.7760 },
  'Sector 26': { minLat: 30.7190, maxLat: 30.7370, minLon: 76.7990, maxLon: 76.8180 },
  'Sector 35': { minLat: 30.7150, maxLat: 30.7290, minLon: 76.7525, maxLon: 76.7675 },
  'Manimajra': { minLat: 30.7050, maxLat: 30.7310, minLon: 76.8300, maxLon: 76.8600 },
};

/**
 * Determines whether coordinates genuinely fall within an administrative sector's
 * geographic boundary. Returns the sector name if inside, or null if outside.
 */
export function getSectorForCoordinates(lat: number | null | undefined, lon: number | null | undefined): string | null {
  if (lat == null || lon == null || !Number.isFinite(lat) || !Number.isFinite(lon)) {
    return null;
  }

  for (const [secName, bounds] of Object.entries(SECTOR_BOUNDARIES)) {
    if (
      lat >= bounds.minLat &&
      lat <= bounds.maxLat &&
      lon >= bounds.minLon &&
      lon <= bounds.maxLon
    ) {
      return secName;
    }
  }

  return null;
}

/** Prototype categories a citizen can pick/confirm in the report flow. */
export const REPORT_CATEGORIES: IssueCategory[] = [
  'pothole',
  'streetlight',
  'drainage',
  'waste',
  'water_leak',
  'road_damage',
];