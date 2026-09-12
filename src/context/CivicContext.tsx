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
} from '../types/civic';

import { MOCK_INCIDENTS, MOCK_NOTIFICATIONS } from '../data/mockIncidents';


/* =========================================================
   CONFIG
   ========================================================= */

const API_URL = 'http://127.0.0.1:8000';


/* =========================================================
   TYPES
   ========================================================= */

interface ToastState {
  title: string;
  message: string;
  type: 'success' | 'urgent' | 'warning' | 'info';
}


/*
 * This is the shape returned by FastAPI /incidents.
 *
 * It represents the real database record rather than the
 * larger frontend Incident object.
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
}


interface CivicContextType {
  incidents: Incident[];
  selectedIncidentId: string | null;
  selectedIncident: Incident | null;
  activeTab: MunicipalTab;
  persona: Persona;
  isDetailOpen: boolean;
  isWhyScoreOpen: boolean;
  isEvidenceOpen: boolean;
  isSmartClosureOpen: boolean;

  // Filters & Sorting
  search: string;
  categoryFilter: string;
  riskFilter: string;
  statusFilter: string;
  recurringOnly: boolean;
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
  isOffline: boolean;
  offlineQueue: OfflineReport[];
  isSyncing: boolean;

  // Notifications
  notifications: CivicNotification[];
  unreadNotificationCount: number;

  // Toast
  toast: ToastState | null;

  // Backend state
  isLoadingIncidents: boolean;
  incidentsError: string | null;
  refreshIncidents: () => Promise<void>;

  // Actions
  selectIncident: (
    id: string | null,
    openDetail?: boolean
  ) => void;

  setActiveTab: (tab: MunicipalTab) => void;
  setPersona: (persona: Persona) => void;
  setIsDetailOpen: (open: boolean) => void;
  setIsWhyScoreOpen: (open: boolean) => void;
  setIsEvidenceOpen: (open: boolean) => void;
  setIsSmartClosureOpen: (open: boolean) => void;

  setSearch: (query: string) => void;
  setCategoryFilter: (category: string) => void;
  setRiskFilter: (risk: string) => void;
  setStatusFilter: (status: string) => void;
  setRecurringOnly: (recurring: boolean) => void;

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

  toggleOffline: () => void;

  submitCitizenReport: (data: {
    category: IssueCategory;
    description: string;
    sector: string;
    location: string;
    imageDataUrl?: string;
  }) => void;

  syncOfflineQueue: () => void;

  resolveFieldIncident: (
    incidentId: string,
    afterImageUrl: string,
    status: 'resolved' | 'needs_review'
  ) => void;

  startFieldWork: (incidentId: string) => void;

  assignTeam: (
    incidentId: string,
    team: string,
    officer?: string
  ) => void;

  markNotificationRead: (id: string) => void;
  clearAllNotifications: () => void;

  showToast: (
    title: string,
    message: string,
    type?: 'success' | 'urgent' | 'warning' | 'info'
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


/*
 * Convert backend status into a valid frontend status.
 */

const normalizeStatus = (
  status?: string | null
): IncidentStatus => {

  const allowed: IncidentStatus[] = [
    'reported',
    'assigned',
    'in_progress',
    'resolved',
    'needs_review',
  ];

  if (
    status &&
    allowed.includes(status as IncidentStatus)
  ) {
    return status as IncidentStatus;
  }

  return 'reported';
};


/*
 * Convert database severity into the numeric value
 * expected by the existing CivicLens frontend.
 */

const severityToNumber = (
  severity?: string | null
): number => {

  switch (severity?.toLowerCase()) {

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


/*
 * Calculate how many days the incident has been waiting.
 */

const calculateWaitingDays = (
  createdAt?: string | null
): number => {

  if (!createdAt) {
    return 0;
  }

  const created = new Date(createdAt).getTime();

  if (Number.isNaN(created)) {
    return 0;
  }

  const difference =
    Date.now() - created;

  return Math.max(
    0,
    Math.floor(
      difference / (1000 * 60 * 60 * 24)
    )
  );
};


/*
 * Convert the real Supabase/FastAPI record into
 * the existing CivicLens Incident model.
 */

const backendIncidentToFrontend = (
  item: BackendIncident
): Incident => {

  const status =
    normalizeStatus(item.status);

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
    severityToNumber(item.severity);

  const waitingDays =
    calculateWaitingDays(
      item.created_at
    );

  let riskLevel:
    | 'low'
    | 'medium'
    | 'high'
    | 'critical';

  if (riskScore >= 80) {
    riskLevel = 'critical';
  } else if (riskScore >= 60) {
    riskLevel = 'high';
  } else if (riskScore >= 30) {
    riskLevel = 'medium';
  } else {
    riskLevel = 'low';
  }


  const category =
    (item.issue_type || 'other') as IssueCategory;


  return {
    id: item.incident_id,

    ticketNumber:
      `CHD-${item.incident_id.slice(0, 8).toUpperCase()}`,

    title:
      item.title || 'Civic Issue',

    category,

    location:
      item.address ||
      item.area ||
      'Chandigarh',

    sector:
      item.area ||
      'Unknown Sector',

    latitude:
      item.latitude ?? 30.7333,

    longitude:
      item.longitude ?? 76.7794,

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
            severity * 0.7 +
            (item.report_count ?? 1) * 0.5
          )
        )
      ),

    locationExposure: 0,

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
        item.report_count ?? 1,

      locationMatchRadiusMeters: 0,

      visualSimilarityPercentage: 0,

      timeClusteringScore: 0,

      citizenSignalSources: [
        'CivicLens Citizen Report'
      ],

      lastCalculatedAgo:
        'From database',
    },

    isRecurring:
      (item.recurrence_count ?? 0) > 0,

    recurrenceCount:
      item.recurrence_count ?? 0,

    agingCurve: [
      {
        day: 1,
        label: 'Day 1 Intake',
        riskBoost: 0,
        isPast: waitingDays >= 1,
        isCurrent: waitingDays === 0,
      },
      {
        day: 15,
        label: 'Day 15 Escalation',
        riskBoost: 10,
        isPast: waitingDays >= 15,
        isCurrent: waitingDays === 15,
      },
      {
        day: 30,
        label: 'Day 30 SLA Breach',
        riskBoost: 22,
        isPast: waitingDays >= 30,
        isCurrent: waitingDays === 30,
      },
      {
        day: 45,
        label: 'Day 45 Emergency Tier',
        riskBoost: 32,
        isPast: waitingDays >= 45,
        isCurrent: waitingDays === 45,
      },
    ],

    agingThresholdCrossed:
      waitingDays >= 30,

    beforeImageUrl: '',

    assignedTeam:
      item.assigned_team ?? '',

    assignedOfficer:
      item.assigned_officer ?? '',

    assignedAt:
      item.assigned_at ?? '',

    description:
      item.description || '',

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
  }> = ({ children }) => {

  /*
   * IMPORTANT:
   *
   * Start empty instead of MOCK_INCIDENTS.
   *
   * The backend/Supabase database is now the source
   * of truth.
   */

  const [incidents, setIncidents] =
    useState<Incident[]>([]);


  const [selectedIncidentId, setSelectedIncidentId] =
    useState<string | null>(null);


  const [activeTab, setActiveTab] =
    useState<MunicipalTab>('dashboard');


  const [persona, setPersona] =
    useState<Persona>('municipal');


  // Drawers & Modals

  const [isDetailOpen, setIsDetailOpen] =
    useState<boolean>(false);

  const [isWhyScoreOpen, setIsWhyScoreOpen] =
    useState<boolean>(false);

  const [isEvidenceOpen, setIsEvidenceOpen] =
    useState<boolean>(false);

  const [isSmartClosureOpen, setIsSmartClosureOpen] =
    useState<boolean>(false);


  // Filters & Sorting

  const [search, setSearch] =
    useState<string>('');

  const [categoryFilter, setCategoryFilter] =
    useState<string>('all');

  const [riskFilter, setRiskFilter] =
    useState<string>('all');

  const [statusFilter, setStatusFilter] =
    useState<string>('all');

  const [recurringOnly, setRecurringOnly] =
    useState<boolean>(false);

  const [queueFilter, setQueueFilter] =
    useState<
      | 'all'
      | 'high_risk'
      | 'waiting_too_long'
      | 'recurring'
      | 'unassigned'
      | 'needs_review'
    >('all');

  const [sortBy, setSortBy] =
    useState<
      | 'risk'
      | 'age'
      | 'impact'
      | 'severity'
    >('risk');


  // =======================================================
  // OFFLINE SIMULATION
  // =======================================================

  const [isOffline, setIsOffline] =
    useState<boolean>(false);


  const [offlineQueue, setOfflineQueue] =
    useState<OfflineReport[]>([
      {
        id: 'off-01',
        timestamp: '2026-09-09T14:10:00Z',
        category: 'pothole',
        location:
          'Near Old Forest Checkpost, Sukhna Enclave',
        sector: 'Rural Fringe',
        latitude: 30.758,
        longitude: 76.825,
        description:
          'Asphalt edge wash-out observed during low connectivity patrol.',
        synced: false,
      },
      {
        id: 'off-02',
        timestamp: '2026-09-09T15:25:00Z',
        category: 'drainage',
        location:
          'Kishangarh Canal Bund Drain Gate 4',
        sector: 'Kishangarh',
        latitude: 30.732,
        longitude: 76.831,
        description:
          'Silt blockage detected in remote catchment line.',
        synced: false,
      },
    ]);


  const [isSyncing, setIsSyncing] =
    useState<boolean>(false);


  // =======================================================
  // NOTIFICATIONS
  // =======================================================

  const [notifications, setNotifications] =
    useState<CivicNotification[]>(
      MOCK_NOTIFICATIONS
    );


  // =======================================================
  // TOAST
  // =======================================================

  const [toast, setToast] =
    useState<ToastState | null>(null);


  // =======================================================
  // BACKEND STATE
  // =======================================================

  const [isLoadingIncidents, setIsLoadingIncidents] =
    useState<boolean>(true);

  const [incidentsError, setIncidentsError] =
    useState<string | null>(null);


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
      | 'info' = 'info'
  ) => {

    setToast({
      title,
      message,
      type
    });

    setTimeout(() => {
      setToast(null);
    }, 4500);
  };


  /* =======================================================
     FETCH REAL INCIDENTS
     ======================================================= */

  const refreshIncidents = async () => {

    try {

      setIsLoadingIncidents(true);

      setIncidentsError(null);


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
        Array.isArray(data?.incidents)
          ? data.incidents
          : [];


      const mapped =
        backendIncidents.map(
          backendIncidentToFrontend
        );


      setIncidents(mapped);


      /*
       * Select the first real incident if nothing
       * is currently selected.
       */

      setSelectedIncidentId(
        current => {

          if (
            current &&
            mapped.some(
              incident =>
                incident.id === current
            )
          ) {
            return current;
          }

          return mapped[0]?.id ?? null;
        }
      );

    } catch (error) {

      console.error(
        'Failed to fetch CivicLens incidents:',
        error
      );

      setIncidentsError(
        error instanceof Error
          ? error.message
          : 'Unable to load incidents.'
      );

    } finally {

      setIsLoadingIncidents(false);
    }
  };


  /* =======================================================
     INITIAL FETCH + AUTO REFRESH
     ======================================================= */

  useEffect(() => {

    refreshIncidents();


    /*
     * Development refresh:
     * check for new citizen submissions every 5 seconds.
     */

    const interval =
      window.setInterval(
        () => {
          refreshIncidents();
        },
        5000
      );


    return () => {
      window.clearInterval(interval);
    };

  }, []);


  /* =======================================================
     SELECTED INCIDENT
     ======================================================= */

  const selectedIncident =
    useMemo(() => {

      return (
        incidents.find(
          inc =>
            inc.id === selectedIncidentId
        ) ||
        incidents[0] ||
        null
      );

    }, [
      incidents,
      selectedIncidentId
    ]);


  /* =======================================================
     UNREAD NOTIFICATIONS
     ======================================================= */

  const unreadNotificationCount =
    useMemo(
      () =>
        notifications.filter(
          n => !n.read
        ).length,
      [notifications]
    );


  /* =======================================================
     SELECT INCIDENT
     ======================================================= */

  const selectIncident = (
    id: string | null,
    openDetail: boolean = false
  ) => {

    setSelectedIncidentId(id);

    if (
      openDetail &&
      id
    ) {
      setIsDetailOpen(true);
    }
  };


  /* =======================================================
     OFFLINE MODE
     ======================================================= */

  const toggleOffline = () => {

    const nextState =
      !isOffline;

    setIsOffline(nextState);


    if (nextState) {

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

  const syncOfflineQueue = () => {

    if (
      offlineQueue.length === 0
    ) {
      return;
    }


    setIsSyncing(true);


    showToast(
      'Synchronizing Data',
      `Transmitting ${offlineQueue.length} offline signals to SANKET intelligence engine...`,
      'info'
    );


    setTimeout(() => {

      const converted:
        Incident[] =
        offlineQueue.map(
          (item, idx) => ({

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

            agingCurve: [],

            agingThresholdCrossed:
              false,

            beforeImageUrl:
             item.imageDataUrl ?? '',

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


      setOfflineQueue([]);

      setIsSyncing(false);


      showToast(
        'Synchronization Complete',
        `${converted.length} reports submitted and processed through SANKET intelligence engine.`,
        'success'
      );

    }, 1800);
  };


  /* =======================================================
     CITIZEN REPORT
     ======================================================= */

  /*
   * IMPORTANT:
   *
   * The CitizenReportFlow now submits directly to the
   * FastAPI /reports endpoint.
   *
   * Therefore this function should NOT create another
   * fake frontend incident.
   *
   * We keep this function only for compatibility with
   * existing components / offline mode.
   */

  const submitCitizenReport = (
    data: {
      category: IssueCategory;
      description: string;
      sector: string;
      location: string;
      imageDataUrl?: string;
    }
  ) => {

    if (isOffline) {

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
            (Math.random() - 0.5) *
            0.04,

          longitude:
            76.78 +
            (Math.random() - 0.5) *
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


    /*
     * Online submissions are now handled by:
     *
     * CitizenReportFlow
     *       ↓
     * POST /reports
     *       ↓
     * FastAPI
     *       ↓
     * Supabase
     *
     * Refresh the database after submission instead
     * of creating a fake frontend record.
     */

    refreshIncidents();


    showToast(
      'Your report was received',
      'It has been queued for municipal review. We will notify you when its status changes.',
      'success'
    );
  };


  /* =======================================================
     FIELD RESOLUTION
     ======================================================= */

  const resolveFieldIncident = (
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
              inc.id !== incidentId
            ) {
              return inc;
            }


            return {

              ...inc,

              status,

              afterImageUrl,

              smartClosure: {

                matchConfidence:
                  status === 'resolved'
                    ? 96
                    : 58,

                distanceMeters:
                  8,

                isLikelyMatch:
                  status === 'resolved',

                visualMatchScore:
                  status === 'resolved'
                    ? 94
                    : 52,

                explanation:
                  status === 'resolved'
                    ? 'Location coordinates match within 8 metres. Structural perimeter landmarks and asphalt aggregate texture align with 94% visual confidence.'
                    : 'Visual match score below threshold (52%). Secondary supervisory inspection required.',

                inspectedAt:
                  new Date().toISOString(),
              },

              lastUpdated:
                new Date().toISOString(),
            };
          }
        )
    );


    if (
      status === 'resolved'
    ) {

      showToast(
        'SANKET Smart Closure Match: 96% Verified',
        'Before & after repair photos matched within 8m GPS radius. Incident marked as RESOLVED.',
        'success'
      );

    } else {

      showToast(
        'Flagged for Secondary Review',
        'Closure evidence inconclusive. Dispatched to Quality Supervisor for on-site audit.',
        'warning'
      );
    }
  };


  /* =======================================================
     ASSIGN TEAM
     ======================================================= */

  const assignTeam = async (
    incidentId: string,
    team: string,
    officer?: string
  ) => {
    const assignedAt = new Date().toISOString();

    const assignedOfficer =
      officer || 'Senior Field Inspector';

    try {
      const response = await fetch(
        `${API_URL}/incidents/${incidentId}/assign`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            team,
            officer: assignedOfficer,
          }),
        }
      );

      if (!response.ok) {
        const errorData =
          await response.json().catch(() => null);

        throw new Error(
          errorData?.detail ||
          `Assignment failed (${response.status})`
        );
      }

      setIncidents(prev =>
        prev.map(incident =>
          incident.id === incidentId
            ? {
                ...incident,
                status: 'assigned',
                assignedTeam: team,
                assignedOfficer,
                assignedAt,
                lastUpdated: assignedAt,
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

    } catch (error) {

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

  const startFieldWork = (
    incidentId: string
  ) => {

    setIncidents(
      prev =>
        prev.map(
          inc =>

            inc.id === incidentId &&
            inc.status === 'assigned'

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

  const markNotificationRead = (
    id: string
  ) => {

    setNotifications(
      prev =>
        prev.map(
          n =>
            n.id === id
              ? {
                  ...n,
                  read: true
                }
              : n
        )
    );
  };


  const clearAllNotifications = () => {

    setNotifications(
      prev =>
        prev.map(
          n => ({
            ...n,
            read: true
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

        syncOfflineQueue,

        resolveFieldIncident,

        startFieldWork,

        assignTeam,

        markNotificationRead,

        clearAllNotifications,

        showToast,
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