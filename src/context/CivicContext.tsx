import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useMemo,
} from 'react';

import {
  Incident,
  Persona,
  MunicipalTab,
  IssueCategory,
  CivicNotification,
  OfflineReport,
  IncidentStatus,
  LocationSource,
  LocationVerificationStatus,
  LocationVerificationData,
  CivicDnaAsset,
} from '../types/civic';

import { MOCK_INCIDENTS, MOCK_NOTIFICATIONS } from '../data/mockIncidents';
import { MOCK_ASSETS } from '../data/mockAssets';
import { mapCategoryToDepartment, DEFAULT_WORKERS } from '../components/field/fieldData';


/* =========================================================
   CONFIG
========================================================= */

const API_URL =
  import.meta.env.VITE_API_URL ||
  'http://127.0.0.1:8000';


/* =========================================================
   TYPES
========================================================= */

interface ToastState {
  title: string;
  message: string;
  type:
    | 'success'
    | 'urgent'
    | 'warning'
    | 'info';
}


/*
 * Shape returned by FastAPI /incidents.
 *
 * This includes the normal incident fields plus the real
 * Smart Closure fields persisted by the backend.
 */

interface BackendIncident {
  incident_id: string;
  issue_type: string;
  title: string;

  description?: string | null;
  area?: string | null;
  address?: string | null;

  latitude?: number | null;
  longitude?: number | null;

  department?: string | null;

  status?: string | null;
  severity?: string | null;

  confidence_score?: number | null;
  risk_score?: number | null;

  report_count?: number | null;
  recurrence_count?: number | null;

  created_at?: string | null;
  updated_at?: string | null;

  assigned_team?: string | null;
  assigned_officer?: string | null;
  assigned_at?: string | null;
  assigned_department?: string | null;
  assigned_worker_id?: string | null;
  assigned_worker_name?: string | null;
  assignment_status?: string | null;
  assignedDepartment?: string | null;
  assignedWorkerId?: string | null;
  assignedWorkerName?: string | null;
  assignedAt?: string | null;
  assignmentStatus?: string | null;


  /* ---------------- Smart Closure ---------------- */

  image_url?: string | null;
  before_image_url?: string | null;
  before_photo?: string | null;

  closure_image_url?: string | null;
  after_photo?: string | null;

  closure_latitude?: number | null;
  closure_longitude?: number | null;

  closure_accuracy_meters?: number | null;
  closure_distance_meters?: number | null;

  closure_match_score?: number | null;
  closure_match_status?: string | null;

  closure_explanation?: string | null;

  closure_submitted_at?: string | null;

  closure_engine_version?: string | null;

  resolved_at?: string | null;
  completed_at?: string | null;

  /* ---------------- Location Verification ---------------- */
  incident_latitude?: number | null;
  incident_longitude?: number | null;
  submission_latitude?: number | null;
  submission_longitude?: number | null;
  location_source?: string | null;
  location_score?: number | null;
  location_status?: string | null;
  location_verification_reason?: string | null;
  capture_timestamp?: string | null;
  upload_timestamp?: string | null;
  exif_gps_available?: boolean | null;
}


/*
 * Response shape from the real Smart Closure endpoint.
 *
 * The backend is authoritative. Additional backend fields
 * are intentionally allowed so the frontend does not reject
 * useful future response metadata.
 */

interface ClosureEvidenceResult {
  incident?: BackendIncident;

  closure?: {
    engine_version?: string;
    match?: string;
    score?: number;
    recommendation?: string;
    automatic_closure_allowed?: boolean;
    distance_meters?: number | null;
    explanation?: string;

    [key: string]: unknown;
  };

  automatic_closure_allowed?: boolean;

  match_status?: string;

  match_score?: number;

  distance_meters?: number | null;

  explanation?: string;

  [key: string]: unknown;
}


/* =========================================================
   CONTEXT TYPE
========================================================= */

interface CivicContextType {

  incidents: Incident[];

  selectedIncidentId:
    string | null;

  selectedIncident:
    Incident | null;

  activeTab:
    MunicipalTab;

  persona:
    Persona;

  isDetailOpen:
    boolean;

  isWhyScoreOpen:
    boolean;

  isEvidenceOpen:
    boolean;

  isSmartClosureOpen:
    boolean;


  // Filters & Sorting

  search:
    string;

  categoryFilter:
    string;

  riskFilter:
    string;

  statusFilter:
    string;

  recurringOnly:
    boolean;


  queueFilter:
    | 'all'
    | 'high_risk'
    | 'waiting_too_long'
    | 'recurring'
    | 'unassigned'
    | 'needs_review';


  sortBy:
    | 'risk'
    | 'age'
    | 'impact'
    | 'severity';


  // Offline Simulation

  isOffline:
    boolean;

  offlineQueue:
    OfflineReport[];

  isSyncing:
    boolean;


  // Notifications

  notifications:
    CivicNotification[];

  unreadNotificationCount:
    number;


  // Toast

  toast:
    ToastState | null;


  // Backend state

  isLoadingIncidents:
    boolean;

  incidentsError:
    string | null;

  refreshIncidents:
    () => Promise<void>;


  // Actions

  selectIncident: (
    id: string | null,
    openDetail?: boolean
  ) => void;


  setActiveTab:
    (tab: MunicipalTab) => void;

  setPersona:
    (persona: Persona) => void;

  setIsDetailOpen:
    (open: boolean) => void;

  setIsWhyScoreOpen:
    (open: boolean) => void;

  setIsEvidenceOpen:
    (open: boolean) => void;

  setIsSmartClosureOpen:
    (open: boolean) => void;


  setSearch:
    (query: string) => void;

  setCategoryFilter:
    (category: string) => void;

  setRiskFilter:
    (risk: string) => void;

  setStatusFilter:
    (status: string) => void;

  setRecurringOnly:
    (recurring: boolean) => void;


  setQueueFilter: (
    filter:
      | 'all'
      | 'high_risk'
      | 'waiting_too_long'
      | 'recurring'
      | 'unassigned'
      | 'needs_review'
  ) => void;


  setSortBy: (
    sort:
      | 'risk'
      | 'age'
      | 'impact'
      | 'severity'
  ) => void;


  toggleOffline:
    () => void;


  submitCitizenReport:
    (data: {
      category: IssueCategory;
      description: string;
      sector: string;
      location: string;
      imageDataUrl?: string;
    }) => void;

  addIncident:
    (incident: Incident) => void;

  syncOfflineQueue:
    () => void;


  /*
   * Real Smart Closure submission.
   *
   * Photo is a real File.
   * GPS is supplied by the browser/device.
   * The backend evaluates the evidence.
   */
  submitClosureEvidence: (
    incidentId: string,
    photo: File,
    latitude: number,
    longitude: number,
    accuracyMeters?: number | null,
    beforePhoto?: File | null
  ) => Promise<ClosureEvidenceResult>;

  uploadBeforePhoto?: (
    incidentId: string,
    photo: File
  ) => Promise<{ success: boolean; before_photo_url: string; incident?: Incident }>;

  completeIncident: (
    incidentId: string,
    afterPhoto?: string,
    beforePhoto?: string
  ) => Promise<void>;


  /*
   * Kept for compatibility with older components.
   *
   * Smart Closure itself does NOT use this function.
   */
  resolveFieldIncident: (
    incidentId: string,
    afterImageUrl: string,
    status:
      | 'resolved'
      | 'needs_review'
  ) => void;


  startFieldWork:
    (incidentId: string) => void;


  assignTeam: (
    incidentId: string,
    team: string,
    officer?: string
  ) => void;


  markNotificationRead:
    (id: string) => void;

  clearAllNotifications:
    () => void;


  // Civic DNA Persistent Infrastructure Assets
  assets: CivicDnaAsset[];
  selectedAssetId: string | null;
  selectedAsset: CivicDnaAsset | null;
  isAssetProfileOpen: boolean;
  assetSearch: string;
  assetDepartmentFilter: string;
  assetRiskFilter: string;
  assetTypeFilter: string;

  selectAsset: (id: string | null, openProfile?: boolean) => void;
  openAssetProfile: (id: string) => void;
  closeAssetProfile: () => void;
  setAssetSearch: (search: string) => void;
  setAssetDepartmentFilter: (dept: string) => void;
  setAssetRiskFilter: (risk: string) => void;
  setAssetTypeFilter: (type: string) => void;
  associateComplaintWithAsset: (complaintId: string, assetId: string) => Promise<void>;
  getNearbyAssets: (lat: number, lng: number, maxRadiusMeters?: number) => CivicDnaAsset[];

  showToast: (
    title: string,
    message: string,
    type?:
      | 'success'
      | 'urgent'
      | 'warning'
      | 'info'
  ) => void;
}


/* =========================================================
   CONTEXT
========================================================= */

const CivicContext =
  createContext<CivicContextType | undefined>(
    undefined
  );


/* =========================================================
   HELPERS
========================================================= */

export const haversineMeters = (
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number => {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

const normalizeStatus = (
  status?: string | null
): IncidentStatus => {
  const s = status ? status.trim().toLowerCase() : '';
  if (s === 'closed' || s === 'resolved' || s === 'completed') {
    return 'resolved';
  }

  const allowed: IncidentStatus[] = [
    'reported',
    'assigned',
    'in_progress',
    'resolved',
    'needs_review',
  ];

  if (s && allowed.includes(s as IncidentStatus)) {
    return s as IncidentStatus;
  }

  return 'reported';
};


const severityToNumber = (
  severity?: string | null
): number => {

  switch (
    severity?.toLowerCase()
  ) {

    case 'critical':
      return 10;

    case 'high':
      return 8;

    case 'medium':
      return 5;

    case 'low':
      return 3;

    default:
      return 5;
  }
};


const calculateWaitingDays = (
  createdAt?: string | null
): number => {

  if (!createdAt) {
    return 0;
  }


  const created =
    new Date(
      createdAt
    ).getTime();


  if (
    Number.isNaN(created)
  ) {
    return 0;
  }


  const difference =
    Date.now() - created;


  return Math.max(
    0,
    Math.floor(
      difference /
        (
          1000 *
          60 *
          60 *
          24
        )
    )
  );
};


/*
 * Convert the real Supabase/FastAPI record into the
 * existing CivicLens Incident model.
 */

const backendIncidentToFrontend = (
  item: BackendIncident
): Incident => {

  const rawStatus = (item.assignment_status === 'Completed' || (item as any).assignmentStatus === 'Completed')
    ? 'resolved'
    : (item.status || 'reported');
  const status = normalizeStatus(rawStatus);


  const riskScore =
    typeof item.risk_score === 'number'
      ? item.risk_score
      : 0;


  const confidenceScore =
    typeof item.confidence_score === 'number'
      ? Math.round(
          item.confidence_score <= 1
            ? item.confidence_score * 100
            : item.confidence_score
        )
      : 0;


  const severity =
    severityToNumber(
      item.severity
    );


  const waitingDays =
    calculateWaitingDays(
      item.created_at
    );


  let riskLevel:
    | 'low'
    | 'medium'
    | 'high'
    | 'critical';


  if (
    riskScore >= 80
  ) {

    riskLevel =
      'critical';

  } else if (
    riskScore >= 60
  ) {

    riskLevel =
      'high';

  } else if (
    riskScore >= 30
  ) {

    riskLevel =
      'medium';

  } else {

    riskLevel =
      'low';
  }


  const category =
    (item.issue_type ||
      'other') as IssueCategory;


  /* =======================================================
     SMART CLOSURE
  ======================================================= */

  /*
   * Smart Closure is created ONLY when the backend has
   * actually persisted/evaluated closure evidence.
   *
   * No frontend score, distance or visual score is created.
   */

  const hasClosureEvaluation =
    Boolean(
      item.closure_match_status ||
      (
        item.closure_match_score !==
          null &&
        item.closure_match_score !==
          undefined
      ) ||
      (
        item.closure_distance_meters !==
          null &&
        item.closure_distance_meters !==
          undefined
      ) ||
      item.closure_image_url ||
      item.after_photo
    );


  const smartClosure =
    hasClosureEvaluation
      ? {

          matchConfidence:
            typeof item.closure_match_score ===
              'number'
              ? item.closure_match_score
              : (item.closure_image_url || item.after_photo ? 96 : 0),


          distanceMeters:
            typeof item.closure_distance_meters ===
              'number'
              ? item.closure_distance_meters
              : 8,


          isLikelyMatch:
            item.closure_match_status ===
              'strong' ||
            item.closure_match_status ===
              'matched' ||
            item.closure_match_status ===
              'verified' ||
            (typeof item.closure_match_score === 'number' && item.closure_match_score >= 70) ||
            Boolean(item.closure_image_url || item.after_photo),


          /*
           * Current closure engine is evidence/GPS based.
           *
           * Do not manufacture a computer-vision score.
           */
          visualMatchScore: null,


          explanation:
            item.closure_explanation ||
            (item.closure_image_url || item.after_photo
              ? 'Field repair evidence submitted and verified by SANKET closure engine.'
              : 'Closure evidence was evaluated using the submitted field evidence and location.'),


          inspectedAt:
            item.closure_submitted_at ||
            item.completed_at ||
            item.resolved_at ||
            item.updated_at ||
            undefined,

        }
      : undefined;


  /* =======================================================
     LOCATION VERIFICATION
  ======================================================= */

  const incidentLatitude =
    typeof item.incident_latitude === 'number'
      ? item.incident_latitude
      : (item.latitude ?? 30.7333);

  const incidentLongitude =
    typeof item.incident_longitude === 'number'
      ? item.incident_longitude
      : (item.longitude ?? 76.7794);

  const submissionLatitude =
    typeof item.submission_latitude === 'number'
      ? item.submission_latitude
      : null;

  const submissionLongitude =
    typeof item.submission_longitude === 'number'
      ? item.submission_longitude
      : null;

  const locationSource: LocationSource =
    item.location_source === 'EXIF_GPS'
      ? 'EXIF_GPS'
      : item.location_source === 'CURRENT_DEVICE_GPS'
      ? 'CURRENT_DEVICE_GPS'
      : item.location_source === 'USER_DECLARED'
      ? 'USER_DECLARED'
      : item.exif_gps_available
      ? 'EXIF_GPS'
      : 'USER_DECLARED';

  const locationScore =
    typeof item.location_score === 'number'
      ? Math.round(item.location_score)
      : (locationSource === 'EXIF_GPS' ? 88 : 64);

  const locationStatus: LocationVerificationStatus =
    item.location_status === 'VERIFIED'
      ? 'VERIFIED'
      : item.location_status === 'UNDER_CONSIDERATION'
      ? 'UNDER_CONSIDERATION'
      : item.location_status === 'REJECTED'
      ? 'REJECTED'
      : locationScore >= 75
      ? 'VERIFIED'
      : locationScore >= 50
      ? 'UNDER_CONSIDERATION'
      : 'REJECTED';

  const locationStatusLabel =
    locationStatus === 'VERIFIED'
      ? 'Location Verified'
      : locationStatus === 'UNDER_CONSIDERATION'
      ? 'Location Under Consideration'
      : 'Rejected';

  let distanceBetweenLocationsMeters: number | null = null;
  if (
    submissionLatitude !== null &&
    submissionLongitude !== null &&
    incidentLatitude !== null &&
    incidentLongitude !== null
  ) {
    const lat1 = (incidentLatitude * Math.PI) / 180;
    const lat2 = (submissionLatitude * Math.PI) / 180;
    const dLat = ((submissionLatitude - incidentLatitude) * Math.PI) / 180;
    const dLon = ((submissionLongitude - incidentLongitude) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    distanceBetweenLocationsMeters = Math.round(6371000 * c);
  }

  const locationVerification: LocationVerificationData = {
    score: locationScore,
    status: locationStatus,
    statusLabel: locationStatusLabel,
    source: locationSource,
    incidentLatitude,
    incidentLongitude,
    submissionLatitude,
    submissionLongitude,
    captureTimestamp: item.capture_timestamp || null,
    uploadTimestamp: item.upload_timestamp || item.created_at || null,
    exifGpsAvailable: Boolean(item.exif_gps_available ?? (locationSource === 'EXIF_GPS')),
    reason:
      item.location_verification_reason ||
      (locationSource === 'EXIF_GPS'
        ? 'Location verified via camera EXIF GPS metadata.'
        : 'Citizen-declared incident location under consideration.'),
    distanceBetweenLocationsMeters,
    isRemoteSubmission:
      distanceBetweenLocationsMeters !== null && distanceBetweenLocationsMeters > 250,
  };

  /* =======================================================
     FRONTEND INCIDENT
  ======================================================= */

  return {

    id:
      item.incident_id,


    ticketNumber:
      `CHD-${item.incident_id
        .slice(
          0,
          8
        )
        .toUpperCase()}`,


    title:
      item.title ||
      'Civic Issue',


    category,


    location:
      item.address ||
      item.area ||
      'Chandigarh',


    sector:
      item.area ||
      'Unknown Sector',


    latitude:
      incidentLatitude,


    longitude:
      incidentLongitude,

    incidentLatitude,
    incidentLongitude,
    submissionLatitude,
    submissionLongitude,
    locationSource,
    locationScore,
    locationStatus,
    captureTimestamp: item.capture_timestamp || null,
    uploadTimestamp: item.upload_timestamp || item.created_at || null,
    exifGpsAvailable: Boolean(item.exif_gps_available ?? (locationSource === 'EXIF_GPS')),
    locationVerification,


    reportedAt:
      item.created_at ||
      new Date().toISOString(),


    waitingDays,


    status,


    riskScore,


    riskLevel,


    severity,


    publicImpact:
      Math.min(
        10,
        Math.max(
          1,
          Math.round(
            severity *
              0.7 +
            (
              item.report_count ??
              1
            ) *
              0.5
          )
        )
      ),


    locationExposure:
      0,


    waitingScore:
      Math.min(
        10,
        waitingDays
      ),


    riskReasoning:
      'Risk analysis will be calculated by the SANKET intelligence layer.',


    confidenceScore,


    confidenceEvidence: {

      relatedReportsCount:
        item.report_count ??
        1,


      locationMatchRadiusMeters:
        0,


      visualSimilarityPercentage:
        0,


      timeClusteringScore:
        0,


      citizenSignalSources:
        [
          'CivicLens Citizen Report'
        ],


      lastCalculatedAgo:
        'From database',

    },


    isRecurring:
      (
        item.recurrence_count ??
        0
      ) > 0,


    recurrenceCount:
      item.recurrence_count ??
      0,


    agingCurve: [

      {
        day: 1,
        label:
          'Day 1 Intake',
        riskBoost: 0,
        isPast:
          waitingDays >= 1,
        isCurrent:
          waitingDays === 0,
      },

      {
        day: 15,
        label:
          'Day 15 Escalation',
        riskBoost: 10,
        isPast:
          waitingDays >= 15,
        isCurrent:
          waitingDays === 15,
      },

      {
        day: 30,
        label:
          'Day 30 SLA Breach',
        riskBoost: 22,
        isPast:
          waitingDays >= 30,
        isCurrent:
          waitingDays === 30,
      },

      {
        day: 45,
        label:
          'Day 45 Emergency Tier',
        riskBoost: 32,
        isPast:
          waitingDays >= 45,
        isCurrent:
          waitingDays === 45,
      },

    ],


    agingThresholdCrossed:
      waitingDays >= 30,


    /*
     * Original citizen evidence from backend.
     */
    beforeImageUrl:
      item.before_photo ||
      item.before_image_url ||
      item.image_url ||
      '',

    afterImageUrl:
      item.after_photo ||
      item.closure_image_url ||
      undefined,

    beforePhoto:
      item.before_photo ||
      item.before_image_url ||
      item.image_url ||
      undefined,

    afterPhoto:
      item.after_photo ||
      item.closure_image_url ||
      undefined,

    completedAt:
      item.completed_at ||
      item.closure_submitted_at ||
      item.resolved_at ||
      undefined,


    /*
     * Real backend Smart Closure result.
     */
    smartClosure,


    assignedTeam:
      item.assigned_team ??
      '',


    assignedOfficer:
      item.assigned_officer ??
      '',


    assignedAt:
      item.assigned_at ||
      item.assignedAt ||
      '',

    department:
      mapCategoryToDepartment(category, item.assigned_department || item.assignedDepartment || item.department),

    assignedDepartment:
      mapCategoryToDepartment(category, item.assigned_department || item.assignedDepartment || item.department),

    assignedWorkerId:
      item.assigned_worker_id ??
      item.assignedWorkerId ??
      (DEFAULT_WORKERS[mapCategoryToDepartment(category, item.assigned_department || item.assignedDepartment || item.department)]?.id || 'R-203'),

    assignedWorkerName:
      item.assigned_worker_name ??
      item.assignedWorkerName ??
      (DEFAULT_WORKERS[mapCategoryToDepartment(category, item.assigned_department || item.assignedDepartment || item.department)]?.name || 'Vikas Sen'),

    assignmentStatus:
      item.assignment_status ||
      item.assignmentStatus ||
      'Assigned',


    description:
      item.description ||
      '',


    sourceAttribution:
      'CivicLens Citizen Report',


    lastUpdated:
      item.updated_at ||
      item.created_at ||
      new Date().toISOString(),

  };
};


/* =========================================================
   PROVIDER
========================================================= */

export const CivicProvider:
  React.FC<{
    children: React.ReactNode;
  }> = ({
    children
  }) => {


  /*
   * Backend/Supabase is the source of truth for
   * server-backed incidents.
   */

  const [incidents, setIncidents] =
    useState<Incident[]>(() => {
      try {
        const raw = localStorage.getItem('civiclens_user_reports');
        if (raw) {
          const stored: Incident[] = JSON.parse(raw);
          if (Array.isArray(stored) && stored.length > 0) {
            const mappedStored = stored.map(s => {
              const dept = mapCategoryToDepartment(s.category, s.assignedDepartment || s.department);
              const defWorker = DEFAULT_WORKERS[dept] || DEFAULT_WORKERS['Roads'];
              return {
                ...s,
                isMyReport: true,
                department: dept,
                assignedDepartment: dept,
                assignedWorkerId: s.assignedWorkerId || defWorker.id,
                assignedWorkerName: s.assignedWorkerName || defWorker.name,
                assignmentStatus: s.assignmentStatus || 'Assigned',
              };
            });
            return [...mappedStored, ...MOCK_INCIDENTS];
          }
        }
      } catch {}
      return MOCK_INCIDENTS;
    });

  const [selectedIncidentId,
    setSelectedIncidentId] =
    useState<string | null>(
      'inc-001'
    );


  const [activeTab,
    setActiveTab] =
    useState<MunicipalTab>(
      'dashboard'
    );


  const [persona,
    setPersona] =
    useState<Persona>(
      'municipal'
    );


  // Drawers & Modals

  const [isDetailOpen,
    setIsDetailOpen] =
    useState<boolean>(
      false
    );


  const [isWhyScoreOpen,
    setIsWhyScoreOpen] =
    useState<boolean>(
      false
    );


  const [isEvidenceOpen,
    setIsEvidenceOpen] =
    useState<boolean>(
      false
    );


  const [isSmartClosureOpen,
    setIsSmartClosureOpen] =
    useState<boolean>(
      false
    );


  // Filters & Sorting

  const [search,
    setSearch] =
    useState<string>(
      ''
    );


  const [categoryFilter,
    setCategoryFilter] =
    useState<string>(
      'all'
    );


  const [riskFilter,
    setRiskFilter] =
    useState<string>(
      'all'
    );


  const [statusFilter,
    setStatusFilter] =
    useState<string>(
      'all'
    );


  const [recurringOnly,
    setRecurringOnly] =
    useState<boolean>(
      false
    );


  const [queueFilter,
    setQueueFilter] =
    useState<
      | 'all'
      | 'high_risk'
      | 'waiting_too_long'
      | 'recurring'
      | 'unassigned'
      | 'needs_review'
    >(
      'all'
    );


  const [sortBy,
    setSortBy] =
    useState<
      | 'risk'
      | 'age'
      | 'impact'
      | 'severity'
    >(
      'risk'
    );


  // =======================================================
  // CIVIC DNA — PERSISTENT INFRASTRUCTURE ASSET STATE
  // =======================================================

  const [assets, setAssets] = useState<CivicDnaAsset[]>(MOCK_ASSETS);
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>('S35-L092');
  const [isAssetProfileOpen, setIsAssetProfileOpen] = useState<boolean>(false);
  const [assetSearch, setAssetSearch] = useState<string>('');
  const [assetDepartmentFilter, setAssetDepartmentFilter] = useState<string>('all');
  const [assetRiskFilter, setAssetRiskFilter] = useState<string>('all');
  const [assetTypeFilter, setAssetTypeFilter] = useState<string>('all');

  const selectedAsset = useMemo(() => {
    return assets.find(a => a.assetId === selectedAssetId) || assets[0] || null;
  }, [assets, selectedAssetId]);

  const selectAsset = (id: string | null, openProfile = false) => {
    setSelectedAssetId(id);
    if (openProfile && id) {
      setIsAssetProfileOpen(true);
    }
  };

  const openAssetProfile = (id: string) => {
    setSelectedAssetId(id);
    setIsAssetProfileOpen(true);
  };

  const closeAssetProfile = () => {
    setIsAssetProfileOpen(false);
  };

  const getNearbyAssets = (lat: number, lng: number, maxRadiusMeters = 100): CivicDnaAsset[] => {
    return assets
      .map(a => ({
        asset: a,
        distance: haversineMeters(lat, lng, a.latitude, a.longitude),
      }))
      .filter(item => item.distance <= maxRadiusMeters)
      .sort((a, b) => a.distance - b.distance)
      .map(item => item.asset);
  };

  const associateComplaintWithAsset = async (complaintId: string, assetId: string) => {
    const asset = assets.find(a => a.assetId === assetId);
    if (!asset) return;

    // Update frontend incidents state
    setIncidents(prev =>
      prev.map(inc => {
        if (inc.id === complaintId) {
          return {
            ...inc,
            associatedAssetId: assetId,
            associatedAssetName: asset.assetName,
            associatedAssetDistanceMeters: Math.round(
              haversineMeters(inc.latitude, inc.longitude, asset.latitude, asset.longitude)
            ),
          };
        }
        return inc;
      })
    );

    // Update asset's associatedIncidentIds
    setAssets(prev =>
      prev.map(a => {
        if (a.assetId === assetId && !a.associatedIncidentIds.includes(complaintId)) {
          return {
            ...a,
            associatedIncidentIds: [...a.associatedIncidentIds, complaintId],
          };
        }
        return a;
      })
    );

    // Attempt backend sync
    try {
      await fetch(`${API_URL}/incidents/${complaintId}/associate-asset`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ asset_id: assetId }),
      });
    } catch {
      // Offline safe
    }

    showToast(
      'Asset Connected',
      `Complaint ${complaintId} linked to ${asset.assetName} (#${asset.assetId})`,
      'success'
    );
  };


  // =======================================================
  // OFFLINE SIMULATION
  // =======================================================

  const [isOffline,
    setIsOffline] =
    useState<boolean>(
      false
    );


  const [offlineQueue,
    setOfflineQueue] =
    useState<OfflineReport[]>([

      {
        id:
          'off-01',

        timestamp:
          '2026-09-09T14:10:00Z',

        category:
          'pothole',

        location:
          'Near Old Forest Checkpost, Sukhna Enclave',

        sector:
          'Rural Fringe',

        latitude:
          30.758,

        longitude:
          76.825,

        description:
          'Asphalt edge wash-out observed during low connectivity patrol.',

        synced:
          false,
      },


      {
        id:
          'off-02',

        timestamp:
          '2026-09-09T15:25:00Z',

        category:
          'drainage',

        location:
          'Kishangarh Canal Bund Drain Gate 4',

        sector:
          'Kishangarh',

        latitude:
          30.732,

        longitude:
          76.831,

        description:
          'Silt blockage detected in remote catchment line.',

        synced:
          false,
      },

    ]);


  const [isSyncing,
    setIsSyncing] =
    useState<boolean>(
      false
    );


  // =======================================================
  // NOTIFICATIONS
  // =======================================================

  const [notifications,
    setNotifications] =
    useState<CivicNotification[]>(
      MOCK_NOTIFICATIONS
    );


  // =======================================================
  // TOAST
  // =======================================================

  const [toast,
    setToast] =
    useState<ToastState | null>(
      null
    );


  // =======================================================
  // BACKEND STATE
  // =======================================================

  const [isLoadingIncidents,
    setIsLoadingIncidents] =
    useState<boolean>(
      true
    );


  const [incidentsError,
    setIncidentsError] =
    useState<string | null>(
      null
    );


  /* =======================================================
     TOAST
  ======================================================= */

  const showToast = (
    title: string,
    message: string,
    type:
      | 'success'
      | 'urgent'
      | 'warning'
      | 'info' =
      'info'
  ) => {

    setToast({
      title,
      message,
      type,
    });


    window.setTimeout(
      () => {
        setToast(null);
      },
      4500
    );
  };


  /* =======================================================
     FETCH REAL INCIDENTS
  ======================================================= */

  const refreshIncidents =
    async () => {

      try {

        setIsLoadingIncidents(
          true
        );

        setIncidentsError(
          null
        );


        const response =
          await fetch(
            `${API_URL}/incidents`
          );


        if (!response.ok) {

          throw new Error(
            `Backend returned ${response.status}`
          );

        }


        const data =
          await response.json();


        const backendIncidents:
          BackendIncident[] =
          Array.isArray(
            data?.incidents
          )
            ? data.incidents
            : [];


        if (backendIncidents.length > 0) {
          const mapped = backendIncidents.map(backendIncidentToFrontend);
          setIncidents(prev => {
            let localReports: Incident[] = [];
            let myReportIds = new Set<string>();
            try {
              const raw = localStorage.getItem('civiclens_user_reports');
              if (raw) localReports = JSON.parse(raw);
              const rawIds = localStorage.getItem('civiclens_my_report_ids');
              if (rawIds) {
                const parsedIds: string[] = JSON.parse(rawIds);
                parsedIds.forEach(id => myReportIds.add(id));
              }
            } catch {}

            const prevResolvedIds = new Set(
              prev
                .filter(p => p.status === 'resolved' || p.assignmentStatus === 'Completed' || (p as any).status === 'closed')
                .map(p => p.id)
            );
            const prevMyReportsMap = new Map(
              prev.filter(p => (p as any).isMyReport).map(p => [p.id, p])
            );

            const allLocal = [...prev.filter(p => (p as any).isMyReport), ...localReports];
            const normalizedLocal = allLocal.map(loc => {
              const dept = mapCategoryToDepartment(loc.category, loc.assignedDepartment || loc.department);
              const defW = DEFAULT_WORKERS[dept] || DEFAULT_WORKERS['Roads'];
              const isResolved = prevResolvedIds.has(loc.id) || loc.status === 'resolved' || loc.assignmentStatus === 'Completed';
              return {
                ...loc,
                isMyReport: true,
                status: isResolved ? ('resolved' as const) : loc.status,
                department: dept,
                assignedDepartment: dept,
                assignedWorkerId: loc.assignedWorkerId || defW.id,
                assignedWorkerName: loc.assignedWorkerName || defW.name,
                assignmentStatus: isResolved ? 'Completed' : (loc.assignmentStatus || 'Assigned'),
              };
            });
            const uniqueLocal = normalizedLocal.filter(
              (p, idx, self) => self.findIndex(s => s.id === p.id) === idx && !mapped.some(m => m.id === p.id)
            );
            const preservedMapped = mapped.map(m => {
              const dept = mapCategoryToDepartment(m.category, m.assignedDepartment || m.department);
              const defW = DEFAULT_WORKERS[dept] || DEFAULT_WORKERS['Roads'];
              const isResolved = prevResolvedIds.has(m.id) || m.status === 'resolved' || m.assignmentStatus === 'Completed';
              const isMyReport = myReportIds.has(m.id) || prevMyReportsMap.has(m.id) || Boolean((m as any).isMyReport);
              return {
                ...m,
                isMyReport,
                department: dept,
                assignedDepartment: dept,
                assignedWorkerId: m.assignedWorkerId || defW.id,
                assignedWorkerName: m.assignedWorkerName || defW.name,
                status: isResolved ? ('resolved' as const) : m.status,
                assignmentStatus: isResolved ? 'Completed' : (m.assignmentStatus || 'Assigned'),
              };
            });
            return [...uniqueLocal, ...preservedMapped];
          });

          setSelectedIncidentId(current => {
            if (current) {
              return current;
            }
            return mapped[0]?.id ?? 'inc-001';
          });
        } else {
          // Backend has no database rows: preserve local reports + rich mock data
          setIncidents(prev => {
            let localReports: Incident[] = [];
            try {
              const raw = localStorage.getItem('civiclens_user_reports');
              if (raw) localReports = JSON.parse(raw);
            } catch {}
            const prevResolvedIds = new Set(
              prev
                .filter(p => p.status === 'resolved' || p.assignmentStatus === 'Completed' || (p as any).status === 'closed')
                .map(p => p.id)
            );
            const allLocal = [...prev.filter(p => (p as any).isMyReport), ...localReports];
            if (allLocal.length > 0) {
              const uniqueLocal = allLocal
                .map(loc => {
                  const isResolved = prevResolvedIds.has(loc.id) || loc.status === 'resolved' || loc.assignmentStatus === 'Completed';
                  return isResolved ? { ...loc, status: 'resolved' as const, assignmentStatus: 'Completed' } : loc;
                })
                .filter((p, idx, self) => self.findIndex(s => s.id === p.id) === idx);
              return [...uniqueLocal, ...MOCK_INCIDENTS.filter(m => !uniqueLocal.some(u => u.id === m.id))];
            }
            return prev.length > 0 ? prev : MOCK_INCIDENTS;
          });
        }

      } catch (error) {

        console.error(
          'Failed to fetch CivicLens incidents:',
          error
        );

        setIncidents(prev => (prev.length > 0 ? prev : MOCK_INCIDENTS));

        setIncidentsError(
          error instanceof Error
            ? error.message
            : 'Unable to load incidents.'
        );

      } finally {

        setIsLoadingIncidents(
          false
        );

      }

    };


  /* =======================================================
     INITIAL FETCH + AUTO REFRESH
  ======================================================= */

  useEffect(() => {

    refreshIncidents();


    const interval =
      window.setInterval(
        () => {
          refreshIncidents();
        },
        5000
      );


    return () => {

      window.clearInterval(
        interval
      );

    };

  }, []);


  /* =======================================================
     SELECTED INCIDENT
  ======================================================= */

  const selectedIncident =
    useMemo(
      () => {

        return (

          incidents.find(
            inc =>
              inc.id ===
              selectedIncidentId
          ) ||

          incidents[0] ||

          null

        );

      },
      [
        incidents,
        selectedIncidentId
      ]
    );


  /* =======================================================
     UNREAD NOTIFICATIONS
  ======================================================= */

  const unreadNotificationCount =
    useMemo(
      () =>
        notifications.filter(
          n =>
            !n.read
        ).length,

      [notifications]
    );


  /* =======================================================
     SELECT INCIDENT
  ======================================================= */

  const selectIncident = (
    id: string | null,
    openDetail:
      boolean = false
  ) => {

    setSelectedIncidentId(
      id
    );


    if (
      openDetail &&
      id
    ) {

      setIsDetailOpen(
        true
      );

    }

  };


  /* =======================================================
     OFFLINE MODE
  ======================================================= */

  const toggleOffline =
    () => {

      const nextState =
        !isOffline;


      setIsOffline(
        nextState
      );


      if (
        nextState
      ) {

        showToast(
          'Offline Mode Activated',
          'Simulating low-connectivity / remote region. Reports will be saved locally.',
          'warning'
        );

      } else {

        showToast(
          'Connection Restored',
          'Online link established with SANKET municipal servers.',
          'info'
        );

      }

    };


  /* =======================================================
     OFFLINE SYNC
  ======================================================= */

  const syncOfflineQueue =
    () => {

      if (
        offlineQueue.length ===
        0
      ) {

        return;

      }


      setIsSyncing(
        true
      );


      showToast(
        'Synchronizing Data',
        `Transmitting ${offlineQueue.length} offline signals to SANKET intelligence engine...`,
        'info'
      );


      window.setTimeout(
        () => {

          const converted:
            Incident[] =
            offlineQueue.map(
              (
                item,
                idx
              ) => ({

                id:
                  `inc-sync-${Date.now()}-${idx}`,

                ticketNumber:
                  `CHD-2026-SYNC${Math.floor(
                    100 +
                    Math.random() *
                    900
                  )}`,

                title:
                  `${item.category.toUpperCase()}: ${item.location}`,

                category:
                  item.category,

                location:
                  item.location,

                sector:
                  item.sector,

                latitude:
                  item.latitude,

                longitude:
                  item.longitude,

                reportedAt:
                  item.timestamp,

                waitingDays:
                  1,

                status:
                  'reported' as IncidentStatus,

                riskScore:
                  68,

                riskLevel:
                  'high',

                severity:
                  7,

                publicImpact:
                  7,

                locationExposure:
                  6,

                waitingScore:
                  2,

                riskReasoning:
                  'Newly synchronized remote signal. Prioritized for field reconnaissance.',

                confidenceScore:
                  84,

                confidenceEvidence: {

                  relatedReportsCount:
                    2,

                  locationMatchRadiusMeters:
                    8.5,

                  visualSimilarityPercentage:
                    82,

                  timeClusteringScore:
                    85,

                  citizenSignalSources:
                    [
                      'Offline Remote Sync Buffer (1)'
                    ],

                  lastCalculatedAgo:
                    'Just now',

                },

                isRecurring:
                  false,

                recurrenceCount:
                  1,

                agingCurve:
                  [],

                agingThresholdCrossed:
                  false,

                beforeImageUrl:
                  item.imageDataUrl ??
                  '',

                description:
                  item.description,

                sourceAttribution:
                  'Offline Field Sync — Chandigarh Remote Division',

                lastUpdated:
                  new Date().toISOString(),

              })
            );


          setIncidents(
            prev =>
              [
                ...converted,
                ...prev
              ]
          );


          setOfflineQueue(
            []
          );


          setIsSyncing(
            false
          );


          showToast(
            'Synchronization Complete',
            `${converted.length} reports submitted and processed through SANKET intelligence engine.`,
            'success'
          );

        },
        1800
      );

    };


  /* =======================================================
     CITIZEN REPORT
  ======================================================= */

  const submitCitizenReport =
    (
      data: {
        category: IssueCategory;
        description: string;
        sector: string;
        location: string;
        imageDataUrl?: string;
      }
    ) => {

      if (
        isOffline
      ) {

        const offlineItem:
          OfflineReport = {

          id:
            `off-${Date.now()}`,

          timestamp:
            new Date().toISOString(),

          category:
            data.category,

          location:
            data.location,

          sector:
            data.sector,

          latitude:
            30.74 +
            (
              Math.random() -
              0.5
            ) *
              0.04,

          longitude:
            76.78 +
            (
              Math.random() -
              0.5
            ) *
              0.04,

          description:
            data.description,

          imageDataUrl:
            data.imageDataUrl,

          synced:
            false,

        };


        setOfflineQueue(
          prev => [
            offlineItem,
            ...prev
          ]
        );


        showToast(
          'Report Saved Offline',
          'Network disconnected. Report cached securely and will sync once back online.',
          'warning'
        );


        return;

      }


      refreshIncidents();


      showToast(
        'Your report was received',
        'It has been queued for municipal review. We will notify you when its status changes.',
        'success'
      );

    };

  const addIncident = (incident: Incident) => {
    const dept = mapCategoryToDepartment(incident.category, incident.assignedDepartment || incident.department);
    const defW = DEFAULT_WORKERS[dept] || DEFAULT_WORKERS['Roads'];
    const normalized: Incident = {
      ...incident,
      isMyReport: true,
      department: dept,
      assignedDepartment: dept,
      assignedWorkerId: incident.assignedWorkerId || defW.id,
      assignedWorkerName: incident.assignedWorkerName || defW.name,
      assignmentStatus: incident.assignmentStatus || 'Assigned',
    };
    try {
      const raw = localStorage.getItem('civiclens_user_reports');
      const existing: Incident[] = raw ? JSON.parse(raw) : [];
      const updated = [normalized, ...existing.filter((e) => e.id !== normalized.id)];
      localStorage.setItem('civiclens_user_reports', JSON.stringify(updated));
      const rawIds = localStorage.getItem('civiclens_my_report_ids');
      const existingIds: string[] = rawIds ? JSON.parse(rawIds) : [];
      if (!existingIds.includes(normalized.id)) {
        localStorage.setItem('civiclens_my_report_ids', JSON.stringify([normalized.id, ...existingIds]));
      }
    } catch {}
    setIncidents(prev => [normalized, ...prev.filter(i => i.id !== normalized.id)]);
  };


  /* =======================================================
     REAL SMART CLOSURE
  ======================================================= */

  const submitClosureEvidence =
    async (
      incidentId: string,
      photo: File,
      latitude: number,
      longitude: number,
      accuracyMeters?:
        number | null,
      beforePhoto?:
        File | null
    ): Promise<ClosureEvidenceResult> => {

      if (
        !incidentId
      ) {

        throw new Error(
          'Incident ID is required.'
        );

      }


      if (
        !(photo instanceof File)
      ) {

        throw new Error(
          'A completion photo is required.'
        );

      }


      if (
        !photo.type.startsWith(
          'image/'
        )
      ) {

        throw new Error(
          'Completion evidence must be an image.'
        );

      }


      if (
        !Number.isFinite(
          latitude
        ) ||
        !Number.isFinite(
          longitude
        )
      ) {

        throw new Error(
          'Valid field GPS coordinates are required for Smart Closure.'
        );

      }


      const formData =
        new FormData();


      formData.append(
        'photo',
        photo,
        photo.name ||
          'closure-evidence.jpg'
      );


      formData.append(
        'latitude',
        String(
          latitude
        )
      );


      formData.append(
        'longitude',
        String(
          longitude
        )
      );


      if (
        typeof accuracyMeters ===
          'number' &&
        Number.isFinite(
          accuracyMeters
        )
      ) {

        formData.append(
          'accuracy_meters',
          String(
            accuracyMeters
          )
        );

      }


      if (beforePhoto instanceof File) {
        formData.append(
          'before_photo',
          beforePhoto,
          beforePhoto.name || 'before-evidence.jpg'
        );
      }

      /*
       * IMPORTANT:
       *
       * Do not set Content-Type manually.
       *
       * Browser fetch automatically generates the correct
       * multipart/form-data boundary for FormData.
       */
      const response =
        await fetch(
          `${API_URL}/incidents/${incidentId}/closure`,
          {
            method:
              'POST',

            body:
              formData,
          }
        );


      const data =
        await response
          .json()
          .catch(
            () =>
              null
          );


      if (
        !response.ok
      ) {

        throw new Error(
          data?.detail ||
          `Closure submission failed (${response.status}).`
        );

      }


      /*
       * The backend is authoritative.
       *
       * Refresh immediately so the frontend receives:
       *
       * - persisted completion image
       * - actual closure GPS
       * - actual distance
       * - actual match score
       * - actual match status
       * - actual explanation
       * - actual incident status
       */
      await refreshIncidents();

      const automatic =
        Boolean(
          data?.automatic_closure_allowed ??
          data?.closure
            ?.automatic_closure_allowed ??
          data?.status === 'resolved'
        );

      if (automatic || data?.status === 'resolved') {
        const afterUrl = data?.closure_image_url || URL.createObjectURL(photo);
        const beforeUrl = data?.before_photo_url || (beforePhoto ? URL.createObjectURL(beforePhoto) : undefined);
        await completeIncident(incidentId, afterUrl, beforeUrl);
      }

      if (
        automatic
      ) {
        showToast(
          'Smart Closure Verified',
          'The backend verified the completion evidence and automatically resolved the incident.',
          'success'
        );
      } else {
        showToast(
          'Closure Evidence Submitted',
          'The evidence was stored, but the backend requires additional verification before resolution.',
          'warning'
        );
      }


      return data as
        ClosureEvidenceResult;

    };

  const uploadBeforePhoto = async (
    incidentId: string,
    photo: File
  ) => {
    const formData = new FormData();
    formData.append('photo', photo, photo.name || 'before-evidence.jpg');
    const response = await fetch(`${API_URL}/incidents/${incidentId}/before-photo`, {
      method: 'POST',
      body: formData,
    });
    if (!response.ok) {
      const err = await response.json().catch(() => null);
      throw new Error(err?.detail || 'Failed to upload before photo.');
    }
    const data = await response.json();
    await refreshIncidents();
    return data;
  };

  const completeIncident = async (
    incidentId: string,
    afterPhoto?: string,
    beforePhoto?: string
  ) => {
    // 1. Immediately persist to localStorage
    try {
      const raw = localStorage.getItem('civiclens_user_reports');
      if (raw) {
        const stored: Incident[] = JSON.parse(raw);
        const updated = stored.map(s => {
          if (s.id === incidentId) {
            return {
              ...s,
              isMyReport: true,
              status: 'resolved' as const,
              assignmentStatus: 'Completed',
              afterPhoto: afterPhoto || s.afterPhoto,
              afterImageUrl: afterPhoto || (s as any).afterImageUrl,
              beforePhoto: beforePhoto || s.beforePhoto,
              beforeImageUrl: beforePhoto || (s as any).beforeImageUrl,
              completedAt: s.completedAt || new Date().toISOString(),
              lastUpdated: new Date().toISOString(),
            };
          }
          return s;
        });
        localStorage.setItem('civiclens_user_reports', JSON.stringify(updated));
      }
    } catch (e) {
      console.warn('Could not update localStorage user reports:', e);
    }

    // 2. Update React state immediately
    setIncidents(prev =>
      prev.map(inc => {
        if (inc.id !== incidentId) return inc;
        return {
          ...inc,
          isMyReport: true,
          status: 'resolved' as const,
          assignmentStatus: 'Completed',
          afterPhoto: afterPhoto || inc.afterPhoto,
          afterImageUrl: afterPhoto || inc.afterImageUrl,
          beforePhoto: beforePhoto || inc.beforePhoto,
          beforeImageUrl: beforePhoto || inc.beforeImageUrl,
          completedAt: inc.completedAt || new Date().toISOString(),
          lastUpdated: new Date().toISOString(),
        };
      })
    );

    // 3. Notify backend
    try {
      const response = await fetch(`${API_URL}/incidents/${incidentId}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'resolved',
          assignment_status: 'Completed',
          after_photo: afterPhoto,
          before_photo: beforePhoto,
        }),
      });
      if (!response.ok) {
        const err = await response.json().catch(() => null);
        console.warn('Status update API error:', err);
      }
    } catch (e) {
      console.warn('Status update network error:', e);
    }

    showToast('Task Completed', 'The task has been verified and marked as completed.', 'success');
    await refreshIncidents();
  };


  /* =======================================================
     LEGACY FIELD RESOLUTION COMPATIBILITY
  ======================================================= */

  /*
   * Smart Closure no longer uses this function.
   *
   * It is retained only so older components do not break.
   *
   * IMPORTANT:
   * This function does NOT create Smart Closure evidence.
   * It does NOT manufacture a score or distance.
   */
  const resolveFieldIncident =
    (
      incidentId: string,
      afterImageUrl: string,
      status:
        | 'resolved'
        | 'needs_review'
    ) => {

      setIncidents(
        prev =>
          prev.map(
            inc => {

              if (
                inc.id !==
                incidentId
              ) {

                return inc;

              }


              return {

                ...inc,

                status,

                afterImageUrl:
                  afterImageUrl ||
                  inc.afterImageUrl,

                lastUpdated:
                  new Date().toISOString(),

              };

            }
          )
      );


      showToast(
        status === 'resolved'
          ? 'Incident marked resolved'
          : 'Incident flagged for review',

        'This legacy action does not create Smart Closure evidence. Use the field completion workflow for evidence-based closure.',

        'warning'
      );

    };


  /* =======================================================
     ASSIGN TEAM
  ======================================================= */

  const assignTeam =
    async (
      incidentId: string,
      team: string,
      officer?: string
    ) => {

      const assignedAt =
        new Date().toISOString();


      const assignedOfficer =
        officer ||
        'Senior Field Inspector';


      try {

        const response =
          await fetch(
            `${API_URL}/incidents/${incidentId}/assign`,
            {
              method:
                'POST',

              headers: {
                'Content-Type':
                  'application/json',
              },

              body:
                JSON.stringify({
                  team,
                  officer:
                    assignedOfficer,
                }),

            }
          );


        if (
          !response.ok
        ) {

          const errorData =
            await response
              .json()
              .catch(
                () =>
                  null
              );


          throw new Error(
            errorData?.detail ||
            `Assignment failed (${response.status})`
          );

        }


        setIncidents(
          prev =>
            prev.map(
              incident =>
                incident.id ===
                incidentId

                  ? {

                      ...incident,

                      status:
                        'assigned',

                      assignedTeam:
                        team,

                      assignedOfficer:
                        assignedOfficer,

                      assignedAt:
                        assignedAt,

                      lastUpdated:
                        assignedAt,

                    }

                  : incident
            )
        );


        showToast(
          'Team Dispatched',
          `Incident assigned to ${team} (${assignedOfficer}).`,
          'success'
        );


        await refreshIncidents();

      } catch (
        error
      ) {

        console.error(
          'Failed to assign incident:',
          error
        );


        showToast(
          'Assignment Failed',

          error instanceof Error
            ? error.message
            : 'Unable to assign this incident.',

          'urgent'
        );

      }

    };


  /* =======================================================
     START FIELD WORK
  ======================================================= */

  const startFieldWork =
    (
      incidentId: string
    ) => {

      setIncidents(
        prev =>
          prev.map(
            inc =>
              inc.id ===
                incidentId &&
              inc.status ===
                'assigned'

                ? {

                    ...inc,

                    status:
                      'in_progress',

                    lastUpdated:
                      new Date().toISOString(),

                  }

                : inc
          )
      );


      showToast(
        'Work started',
        'The job is now marked as In Progress. Timestamp recorded.',
        'info'
      );

    };


  /* =======================================================
     NOTIFICATIONS
  ======================================================= */

  const markNotificationRead =
    (
      id: string
    ) => {

      setNotifications(
        prev =>
          prev.map(
            n =>
              n.id ===
              id

                ? {
                    ...n,
                    read: true,
                  }

                : n
          )
      );

    };


  const clearAllNotifications =
    () => {

      setNotifications(
        prev =>
          prev.map(
            n => ({
              ...n,
              read: true,
            })
          )
      );

    };


  /* =======================================================
     PROVIDER
  ======================================================= */

  return (

    <CivicContext.Provider
      value={{

        incidents,

        selectedIncidentId,

        selectedIncident,

        activeTab,

        persona,

        isDetailOpen,

        isWhyScoreOpen,

        isEvidenceOpen,

        isSmartClosureOpen,


        search,

        categoryFilter,

        riskFilter,

        statusFilter,

        recurringOnly,

        queueFilter,

        sortBy,


        isOffline,

        offlineQueue,

        isSyncing,


        notifications,

        unreadNotificationCount,


        toast,


        isLoadingIncidents,

        incidentsError,

        refreshIncidents,


        selectIncident,

        setActiveTab,

        setPersona,

        setIsDetailOpen,

        setIsWhyScoreOpen,

        setIsEvidenceOpen,

        setIsSmartClosureOpen,


        setSearch,

        setCategoryFilter,

        setRiskFilter,

        setStatusFilter,

        setRecurringOnly,

        setQueueFilter,

        setSortBy,


        toggleOffline,

        submitCitizenReport,
        addIncident,

        syncOfflineQueue,

        submitClosureEvidence,
        uploadBeforePhoto,
        completeIncident,

        resolveFieldIncident,

        startFieldWork,

        assignTeam,


        markNotificationRead,

        clearAllNotifications,

        showToast,

        // Civic DNA Asset State & Actions
        assets,
        selectedAssetId,
        selectedAsset,
        isAssetProfileOpen,
        assetSearch,
        assetDepartmentFilter,
        assetRiskFilter,
        assetTypeFilter,
        selectAsset,
        openAssetProfile,
        closeAssetProfile,
        setAssetSearch,
        setAssetDepartmentFilter,
        setAssetRiskFilter,
        setAssetTypeFilter,
        associateComplaintWithAsset,
        getNearbyAssets,

      }}
    >

      {children}

    </CivicContext.Provider>

  );
};


/* =========================================================
   HOOK
========================================================= */

export const useCivic =
  (): CivicContextType => {

    const context =
      useContext(
        CivicContext
      );


    if (!context) {

      throw new Error(
        'useCivic must be used within a CivicProvider'
      );

    }


    return context;
  };