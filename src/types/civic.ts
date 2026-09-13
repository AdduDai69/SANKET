export type IssueCategory =
  | 'pothole'
  | 'drainage'
  | 'waste'
  | 'streetlight'
  | 'road_damage'
  | 'water_leak'
  | 'other';

export type IncidentStatus =
  | 'reported'
  | 'assigned'
  | 'in_progress'
  | 'resolved'
  | 'closed'
  | 'needs_review';

export type RiskLevel = 'critical' | 'high' | 'medium' | 'low';

export interface IncidentHistory {
  date: string;
  month: string;
  year: number;
  issue: string;
  category: IssueCategory;
  resolution: string;
  daysToFail: number;
  contractor?: string;
}

export interface ConfidenceEvidence {
  relatedReportsCount: number;
  locationMatchRadiusMeters: number;
  visualSimilarityPercentage: number;
  timeClusteringScore: number;
  citizenSignalSources: string[];
  lastCalculatedAgo: string;
}

export interface AgingStep {
  day: number;
  label: string;
  riskBoost: number;
  isPast: boolean;
  isCurrent: boolean;
}

export interface SmartClosureData {
  matchConfidence: number;
  distanceMeters: number;
  isLikelyMatch: boolean;
  visualMatchScore: number | null;
  explanation: string;
  inspectedAt?: string;
}

export interface Incident {
  id: string;
  ticketNumber: string;
  title: string;
  category: IssueCategory;
  location: string;
  sector: string;
  latitude: number;
  longitude: number;
  reportedAt: string;
  waitingDays: number;

  status: IncidentStatus;

  // SANKET Intelligence: Civic Risk (0-100)
  riskScore: number;
  riskLevel: RiskLevel;
  severity: number;
  publicImpact: number;
  locationExposure: number;
  waitingScore: number;
  riskReasoning: string;

  // SANKET Intelligence: Civic Confidence (0-100%)
  confidenceScore: number;
  confidenceEvidence: ConfidenceEvidence;

  // SANKET Intelligence: Civic Memory
  isRecurring: boolean;
  recurrenceCount: number;
  lastFailureDate?: string;
  failurePattern?: string;
  history?: IncidentHistory[];
  rootCauseHypothesis?: string;

  // SANKET Intelligence: Priority Aging
  agingCurve: AgingStep[];
  agingThresholdCrossed: boolean;

  // SANKET Intelligence: Smart Closure Match
  smartClosure?: SmartClosureData;

  // Evidence
  beforeImageUrl: string;
  afterImageUrl?: string;

  description: string;

  // Assignment
  assignedTeam?: string;
  assignedOfficer?: string;
  assignedAt?: string;

  // Provenance
  sourceAttribution: string;
  lastUpdated: string;
}

export type Persona =
  | 'municipal'
  | 'field_officer'
  | 'citizen';

export type MunicipalTab =
  | 'dashboard'
  | 'incidents'
  | 'priority_queue'
  | 'map_view'
  | 'civic_memory'
  | 'analytics'
  | 'reports'
  | 'settings'
  | 'methodology';

export interface OfflineReport {
  id: string;
  timestamp: string;
  category: IssueCategory;
  location: string;
  sector: string;
  latitude: number;
  longitude: number;
  description: string;
  imageDataUrl?: string;
  synced: boolean;
}

export interface CivicNotification {
  id: string;
  title: string;
  message: string;
  timestamp: string;
  type: 'urgent' | 'warning' | 'info' | 'verified';
  incidentId?: string;
  read: boolean;
}