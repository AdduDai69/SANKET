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

export type LocationSource =
  | 'EXIF_GPS'
  | 'USER_DECLARED'
  | 'CURRENT_DEVICE_GPS'
  | 'NONE';

export type LocationVerificationStatus =
  | 'VERIFIED'
  | 'UNDER_CONSIDERATION'
  | 'REJECTED';

export interface LocationVerificationData {
  score: number;
  status: LocationVerificationStatus;
  statusLabel?: string;
  source: LocationSource;
  incidentLatitude: number;
  incidentLongitude: number;
  submissionLatitude?: number | null;
  submissionLongitude?: number | null;
  captureTimestamp?: string | null;
  uploadTimestamp?: string | null;
  exifGpsAvailable: boolean;
  reason?: string;
  distanceBetweenLocationsMeters?: number | null;
  distance_between_incident_and_submission_km?: number | null;
  distance_between_locations_meters?: number | null;
  distance_km?: number | null;
  isRemoteSubmission?: boolean;
  is_remote_submission?: boolean;
  location_mismatch?: boolean;

  // Backend response compatibility properties
  location_verification_score?: number;
  location_verification_status?: LocationVerificationStatus;
  location_source?: LocationSource;
  incident_latitude?: number;
  incident_longitude?: number;
  submission_latitude?: number | null;
  submission_longitude?: number | null;
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
  department?: string;
  isMyReport?: boolean;

  // SANKET Intelligence: Location Verification (0-100)
  locationVerification?: LocationVerificationData;
  incidentLatitude?: number;
  incidentLongitude?: number;
  submissionLatitude?: number | null;
  submissionLongitude?: number | null;
  locationSource?: LocationSource;
  locationScore?: number;
  locationStatus?: LocationVerificationStatus;
  locationVerificationScore?: number;
  locationVerificationStatus?: LocationVerificationStatus;
  distanceIncidentSubmissionKm?: number | null;
  photoCaptureTimestamp?: string | null;
  cameraDevice?: string | null;
  userDeclaredAddress?: string;
  captureTimestamp?: string | null;
  uploadTimestamp?: string | null;
  exifGpsAvailable?: boolean;

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
  beforePhoto?: string;
  afterPhoto?: string;
  completedAt?: string;

  description: string;

  // Assignment
  assignedTeam?: string;
  assignedOfficer?: string;
  assignedAt?: string;
  assignedDepartment?: string;
  assignedWorkerId?: string | null;
  assignedWorkerName?: string | null;
  assignmentStatus?: string;

  // Civic DNA Asset Linkage
  associatedAssetId?: string | null;
  associatedAssetDistanceMeters?: number | null;
  associatedAssetName?: string | null;

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
  | 'civic_dna'
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

/* =========================================================
   CIVIC DNA: PERSISTENT INFRASTRUCTURE INTELLIGENCE LAYER
   ========================================================= */

export type AssetType =
  | 'streetlight'
  | 'road'
  | 'drainage'
  | 'waste'
  | 'water'
  | 'traffic_signal'
  | 'park'
  | 'other';

export type AssetStatus =
  | 'healthy'
  | 'needs_attention'
  | 'high_risk'
  | 'critical';

export type AssetEventType =
  | 'installation'
  | 'inspection'
  | 'complaint'
  | 'repair'
  | 'component_replacement'
  | 'failure'
  | 'recurrence'
  | 'escalation'
  | 'closure'
  | 'prediction';

export type RecommendationType =
  | 'REPAIR'
  | 'INSPECT'
  | 'REPLACE_COMPONENT'
  | 'REPLACE_ASSET';

export interface AssetEvent {
  id: string;
  assetId: string;
  eventType: AssetEventType;
  date: string;
  year: number;
  title: string;
  description: string;
  department: string;
  cost: number;
  component?: string;
  complaintId?: string;
  officerId?: string;
  contractor?: string;
  metadata?: Record<string, any>;
}

export interface AssetRecommendation {
  action: RecommendationType;
  title: string;
  reason: string;
  confidence: number;
  expectedSavings: number;
  repairCost: number;
  replacementCost: number;
  repairExpectedLifeMonths: number;
  replaceExpectedLifeYears: number;
  recurringComponent?: string;
  statusLabel: string;
}

export interface AssetHealthBreakdown {
  overallScore: number;
  ageScore: number;
  failureHistoryScore: number;
  recurrenceScore: number;
  maintenanceCostScore: number;
  recentInspectionScore: number;
  currentConditionScore: number;
  explanation: string;
}

export interface AssetRiskFactor {
  name: string;
  impact: number;
  description: string;
}

export interface AssetRiskBreakdown {
  currentRiskScore: number;
  riskLevel: RiskLevel;
  primaryFactors: AssetRiskFactor[];
}

export interface FailureInterval {
  fromYear: number;
  toYear: number;
  months: number;
}

export interface FailureFrequencyBar {
  year: number;
  intensity: number;
  label: string;
}

export interface FailurePattern {
  totalFailures: number;
  intervals: FailureInterval[];
  isFrequencyIncreasing: boolean;
  trendText: string;
  frequencyBars: FailureFrequencyBar[];
}

export interface CivicDnaAsset {
  assetId: string;
  assetType: AssetType;
  assetName: string;
  location: string;
  sector: string;
  latitude: number;
  longitude: number;
  department: string;
  installationDate: string;
  installationYear: number;
  ageYears: number;
  currentStatus: AssetStatus;
  currentRiskScore: number;
  currentHealthScore: number;
  totalComplaints: number;
  totalRepairs: number;
  failureCount: number;
  recurrenceCount: number;
  lastRepairDate?: string;
  lastInspectionDate?: string;
  estimatedLifetimeYears: number;
  actualLifetimeYears: number;
  totalMaintenanceCost: number;
  estimatedReplacementCost: number;
  potentialSavings: number;
  currentComponent?: string;
  healthBreakdown: AssetHealthBreakdown;
  riskBreakdown: AssetRiskBreakdown;
  failurePattern: FailurePattern;
  recommendation: AssetRecommendation;
  events: AssetEvent[];
  associatedIncidentIds: string[];
  aiSummary: string;
}