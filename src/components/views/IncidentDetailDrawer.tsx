import React from 'react';
import { useCivic } from '../../context/CivicContext';
import {
  RiskBadge,
  ConfidenceBadge,
  StatusBadge,
  CategoryBadge,
  DemoBadge
} from '../common/Badges';
import {
  X,
  MapPin,
  Calendar,
  AlertTriangle,
  Clock,
  ShieldCheck,
  History,
  Layers,
  Sparkles,
  HelpCircle,
  ExternalLink,
  ChevronRight,
  UserCheck,
  Send,
  HardHat,
  Eye,
  CheckCircle2,
  FileText,
  Crosshair,
  Camera,
  Link2,
  Zap,
} from 'lucide-react';
import { CivicMap } from '../common/CivicMap';

export const IncidentDetailDrawer: React.FC = () => {
  const {
    selectedIncident,
    incidents,
    isDetailOpen,
    setIsDetailOpen,
    setIsWhyScoreOpen,
    setIsEvidenceOpen,
    setIsSmartClosureOpen,
    assignTeam,
    setActiveTab,
    assets,
    openAssetProfile,
    associateComplaintWithAsset,
    getNearbyAssets,
    selectIncident,
    completeIncident,
  } = useCivic();

  if (!isDetailOpen || !selectedIncident) return null;

  const inc = selectedIncident;
  const openSmartClosure = () => {
    setIsDetailOpen(false);
    setIsSmartClosureOpen(true);
  };

  const calculateDistanceMeters = (lat1: number, lon1: number, lat2: number, lon2: number) => {
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

  const colocatedIncidents = incidents.filter((other) => {
    if (other.id === inc.id) return false;
    if (other.status === 'resolved' || other.status === 'closed') return false;
    const dist = calculateDistanceMeters(inc.latitude, inc.longitude, other.latitude, other.longitude);
    return dist <= 100;
  });

  return (
    <div className="fixed inset-0 z-[2000] isolate bg-black/40 backdrop-blur-xs animate-fade-in p-0 lg:p-3">
      <section className="grid h-[100dvh] w-full min-w-0 min-h-0 grid-rows-[minmax(17rem,38dvh)_minmax(0,1fr)] overflow-hidden bg-[#FBFBF9] shadow-2xl lg:h-[calc(100dvh-1.5rem)] lg:grid-cols-[minmax(0,1fr)_minmax(380px,520px)] lg:grid-rows-1 lg:rounded-2xl" aria-label="Incident investigation workspace">
        <div className="min-w-0 min-h-0 border-b border-[#E5E3DC] bg-[#F4F3EF] p-3 lg:border-b-0 lg:border-r lg:p-4">
          <CivicMap
            incidents={incidents}
            selectedIncidentId={inc.id}
            height="100%"
            className="h-full"
          />
        </div>
        <div className="min-w-0 min-h-0 bg-[#FBFBF9] flex flex-col justify-between text-left overflow-hidden">
        {/* Top Sticky Header */}
        <div className="p-4 sm:p-5 border-b border-[#E5E3DC] bg-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5 flex-wrap">
            <span className="text-xs font-mono font-bold text-[#565C68] bg-[#F4F3EF] px-2 py-0.5 rounded border border-[#E5E3DC]">
              {inc.ticketNumber}
            </span>
            <CategoryBadge category={inc.category} />
            <StatusBadge status={inc.status} />
            {inc.isRecurring && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-bold bg-[#FDF6EC] text-[#C88427] border border-[#F9E8CE]">
                <History className="w-3 h-3" />
                Recurring ({inc.recurrenceCount}x)
              </span>
            )}
          </div>
          <button
            onClick={() => setIsDetailOpen(false)}
            className="p-1.5 rounded-lg text-[#7E8592] hover:bg-[#F4F3EF] hover:text-[#191B1F] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="p-5 sm:p-6 space-y-6 overflow-y-auto flex-1">
          {/* Main Title & Spatial Context */}
          <div>
            <h2 className="text-xl font-bold text-[#191B1F] leading-snug">
              {inc.title}
            </h2>
            <div className="flex items-center gap-2 text-xs text-[#565C68] mt-1.5">
              <MapPin className="w-3.5 h-3.5 text-[#2C5E48] shrink-0" />
              <span className="font-semibold text-[#191B1F]">{inc.sector}, Chandigarh</span>
              <span>•</span>
              <span className="truncate">{inc.location}</span>
            </div>
          </div>

          {/* Citizen Report Evidence Card */}
          <div className="bg-white rounded-xl border border-[#E5E3DC] overflow-hidden">
            <div className="p-3.5 bg-[#FAF9F5] border-b border-[#E5E3DC] flex items-center justify-between text-xs">
              <span className="font-bold text-[#191B1F] flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-[#2C5E48]" />
                Original Citizen Signal
              </span>
              <span className="text-[11px] text-[#7E8592] font-mono">
                Reported {inc.waitingDays} days ago ({new Date(inc.reportedAt).toLocaleDateString()})
              </span>
            </div>
            <div className="p-4 grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="sm:col-span-1 rounded-lg overflow-hidden border border-[#E5E3DC] h-32 sm:h-full">
                <img
                  src={inc.beforeImageUrl}
                  alt={inc.title}
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="sm:col-span-2 space-y-2.5">
                <p className="text-xs text-[#191B1F] leading-relaxed">
                  "{inc.description}"
                </p>
                <div className="flex flex-wrap gap-2 pt-2 border-t border-[#F4F3EF] text-[11px] text-[#565C68]">
                  <span className="bg-[#F4F3EF] px-2 py-0.5 rounded font-mono">
                    Related signals: <b>{inc.confidenceEvidence.relatedReportsCount}</b>
                  </span>
                  <span className="bg-[#F4F3EF] px-2 py-0.5 rounded">
                    Source: {inc.sourceAttribution}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* ========================================================= */}
          {/* ASSIGNMENT DETAILS CARD                                   */}
          {/* ========================================================= */}
          {(() => {
            const assignedDept = inc.assignedDepartment || inc.department || 'Electrical';
            const isAssigned = Boolean(
              inc.assignedWorkerId &&
              inc.assignedWorkerId !== 'Unassigned' &&
              inc.assignedWorkerId !== 'None'
            );
            const workerDisplay = isAssigned
              ? `${inc.assignedWorkerId} — ${inc.assignedWorkerName || 'Field Worker'}`
              : 'Unassigned';

            const formatAssignmentDate = (iso?: string | null) => {
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

            const assignedOnDisplay = isAssigned
              ? formatAssignmentDate(inc.assignedAt || inc.reportedAt)
              : '—';
            const assignmentStatusDisplay = isAssigned
              ? (inc.assignmentStatus || 'Assigned')
              : 'Awaiting Worker';

            return (
              <div className="bg-white rounded-xl border border-[#E5E3DC] shadow-xs overflow-hidden">
                <div className="p-3.5 bg-[#FAF9F5] border-b border-[#E5E3DC] flex items-center justify-between text-xs">
                  <span className="font-bold text-[#191B1F] flex items-center gap-1.5 uppercase tracking-wider text-[11px]">
                    <UserCheck className="w-3.5 h-3.5 text-[#2C5E48]" />
                    ASSIGNMENT DETAILS
                  </span>
                  <span
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold ${
                      isAssigned
                        ? 'bg-[#EBF7EF] text-[#1E6B42] border border-[#C8EAD4]'
                        : 'bg-[#FDF6EC] text-[#C88427] border border-[#F9E8CE]'
                    }`}
                  >
                    {isAssigned ? (
                      <>
                        <CheckCircle2 className="w-3 h-3" />
                        {assignmentStatusDisplay}
                      </>
                    ) : (
                      <>
                        <Clock className="w-3 h-3" />
                        {assignmentStatusDisplay}
                      </>
                    )}
                  </span>
                </div>
                <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-3.5 text-xs">
                  <div className="p-3 rounded-lg bg-[#FAF9F5] border border-[#E5E3DC]">
                    <span className="text-[10px] font-bold text-[#7E8592] uppercase tracking-wider block">
                      Department
                    </span>
                    <span className="font-bold text-sm text-[#191B1F] mt-1 block">
                      {assignedDept}
                    </span>
                  </div>
                  <div className="p-3 rounded-lg bg-[#FAF9F5] border border-[#E5E3DC]">
                    <span className="text-[10px] font-bold text-[#7E8592] uppercase tracking-wider block">
                      Assigned Worker
                    </span>
                    <span className="font-bold text-sm text-[#191B1F] mt-1 block font-mono">
                      {workerDisplay}
                    </span>
                  </div>
                  <div className="p-3 rounded-lg bg-[#FAF9F5] border border-[#E5E3DC]">
                    <span className="text-[10px] font-bold text-[#7E8592] uppercase tracking-wider block">
                      Assigned On
                    </span>
                    <span className="font-semibold text-xs text-[#565C68] mt-1 block font-mono">
                      {assignedOnDisplay}
                    </span>
                  </div>
                  <div className="p-3 rounded-lg bg-[#FAF9F5] border border-[#E5E3DC]">
                    <span className="text-[10px] font-bold text-[#7E8592] uppercase tracking-wider block">
                      Status
                    </span>
                    <span className="font-bold text-xs text-[#191B1F] mt-1 block">
                      {assignmentStatusDisplay}
                    </span>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* ========================================================= */}
          {/* INCIDENT LOCATION VERIFICATION & AUDIT CARD             */}
          {/* ========================================================= */}
          <div className="bg-white rounded-xl border border-[#E5E3DC] shadow-xs overflow-hidden">
            <div className="p-3.5 bg-[#FAF9F5] border-b border-[#E5E3DC] flex items-center justify-between text-xs">
              <span className="font-bold text-[#191B1F] flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-[#2C5E48]" />
                Location Verification & Evidence Trail
              </span>
              <span
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold ${
                  inc.locationVerificationStatus === 'VERIFIED'
                    ? 'bg-[#EBF7EF] text-[#1E6B42] border border-[#C8EAD4]'
                    : inc.locationVerificationStatus === 'UNDER_CONSIDERATION'
                    ? 'bg-[#FDF6EC] text-[#C88427] border border-[#F9E8CE]'
                    : 'bg-[#FDF0ED] text-[#C54E38] border border-[#F8D2CA]'
                }`}
              >
                {inc.locationVerificationStatus === 'VERIFIED' ? (
                  <>
                    <CheckCircle2 className="w-3 h-3" />
                    VERIFIED ({inc.locationVerificationScore ?? 85}%)
                  </>
                ) : inc.locationVerificationStatus === 'UNDER_CONSIDERATION' ? (
                  <>
                    <Clock className="w-3 h-3" />
                    UNDER CONSIDERATION ({inc.locationVerificationScore ?? 60}%)
                  </>
                ) : (
                  <>
                    <AlertTriangle className="w-3 h-3" />
                    REJECTED ({inc.locationVerificationScore ?? 0}%)
                  </>
                )}
              </span>
            </div>

            <div className="p-4 space-y-3.5">
              {/* Dual Location Coordinates Breakdown */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Incident Location */}
                <div className="p-3 rounded-lg bg-[#FAF9F5] border border-[#E5E3DC]">
                  <div className="text-[10px] font-bold text-[#7E8592] uppercase tracking-wider flex items-center gap-1">
                    <MapPin className="w-3 h-3 text-[#2C5E48]" />
                    Incident Location (Issue Site)
                  </div>
                  <div className="font-mono font-bold text-xs text-[#191B1F] mt-1">
                    {(inc.incidentLatitude ?? inc.latitude).toFixed(6)}, {(inc.incidentLongitude ?? inc.longitude).toFixed(6)}
                  </div>
                  <div className="text-[11px] text-[#565C68] mt-0.5">
                    Sector: <b>{inc.sector}</b>
                    {inc.userDeclaredAddress && (
                      <span className="block text-[#7E8592] text-[10px] truncate">
                        "{inc.userDeclaredAddress}"
                      </span>
                    )}
                  </div>
                  <div className="mt-2">
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-white border border-[#E5E3DC] text-[#2C5E48]">
                      {inc.locationSource === 'EXIF_GPS'
                        ? '📸 Photo EXIF GPS'
                        : '👤 Citizen Declared'}
                    </span>
                  </div>
                </div>

                {/* Submission Location */}
                <div className="p-3 rounded-lg bg-[#FAF9F5] border border-[#E5E3DC]">
                  <div className="text-[10px] font-bold text-[#7E8592] uppercase tracking-wider flex items-center gap-1">
                    <Crosshair className="w-3 h-3 text-[#565C68]" />
                    Submission Location (Citizen GPS)
                  </div>
                  <div className="font-mono font-bold text-xs text-[#191B1F] mt-1">
                    {inc.submissionLatitude !== undefined && inc.submissionLatitude !== null && inc.submissionLongitude !== undefined && inc.submissionLongitude !== null
                      ? `${inc.submissionLatitude.toFixed(6)}, ${inc.submissionLongitude.toFixed(6)}`
                      : 'Remote / Device GPS unlinked'}
                  </div>
                  <div className="text-[11px] text-[#565C68] mt-0.5">
                    {inc.distanceIncidentSubmissionKm !== undefined && inc.distanceIncidentSubmissionKm !== null ? (
                      <span>
                        Distance to incident:{' '}
                        <b>{inc.distanceIncidentSubmissionKm.toFixed(2)} km</b>
                      </span>
                    ) : (
                      <span className="text-[#7E8592] italic">GPS not available at submission</span>
                    )}
                  </div>
                  <div className="mt-2">
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-white border border-[#E5E3DC] text-[#565C68]">
                      {inc.distanceIncidentSubmissionKm !== undefined && inc.distanceIncidentSubmissionKm !== null && inc.distanceIncidentSubmissionKm <= 0.5
                        ? '📍 On-site submission'
                        : '🏠 Remote submission (e.g. from home)'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Evidence Timeline & Metadata Audit Trail */}
              <div className="p-3 rounded-lg bg-white border border-[#E5E3DC]">
                <span className="text-[10px] font-bold text-[#7E8592] uppercase tracking-wider block mb-2">
                  Temporal & Spatial Evidence Audit
                </span>
                <div className="space-y-1.5 text-xs text-[#565C68]">
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <Camera className="w-3 h-3 text-[#7E8592]" />
                      Photo Capture Time:
                    </span>
                    <span className="font-mono text-[#191B1F]">
                      {inc.photoCaptureTimestamp
                        ? new Date(inc.photoCaptureTimestamp).toLocaleString()
                        : 'Metadata timestamp stripped'}
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <Clock className="w-3 h-3 text-[#7E8592]" />
                      Report Submission Time:
                    </span>
                    <span className="font-mono text-[#191B1F]">
                      {new Date(inc.reportedAt).toLocaleString()}
                    </span>
                  </div>

                  {inc.cameraDevice && (
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <Camera className="w-3 h-3 text-[#7E8592]" />
                        Capturing Device:
                      </span>
                      <span className="font-mono text-[#191B1F] text-[11px]">
                        {inc.cameraDevice}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Decision Explanation Note */}
              <div
                className={`p-2.5 rounded-lg text-xs leading-relaxed ${
                  inc.locationVerificationStatus === 'VERIFIED'
                    ? 'bg-[#EBF7EF] text-[#1E6B42] border border-[#C8EAD4]'
                    : inc.locationVerificationStatus === 'UNDER_CONSIDERATION'
                    ? 'bg-[#FDF6EC] text-[#C88427] border border-[#F9E8CE]'
                    : 'bg-[#FDF0ED] text-[#C54E38] border border-[#F8D2CA]'
                }`}
              >
                {inc.locationVerificationStatus === 'VERIFIED' ? (
                  <span>
                    ✓ <b>Location Authenticated:</b> Incident coordinates confirmed via{' '}
                    {inc.locationSource === 'EXIF_GPS'
                      ? 'hardware camera GPS tags in original image evidence'
                      : 'verified municipal ward mapping and consistent signal fusion'}
                    . Expedited for field team assignment.
                  </span>
                ) : inc.locationVerificationStatus === 'UNDER_CONSIDERATION' ? (
                  <span>
                    ⏳ <b>Under Consideration:</b> Photo submitted remotely without authoritative GPS tags. Held for municipal desk validation before field crew dispatch.
                  </span>
                ) : (
                  <span>
                    ✕ <b>Verification Insufficient:</b> Report location could not be established with minimum threshold (&lt;50%).
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* ========================================================= */}
          {/* CO-LOCATED ACTIVE ISSUES (SAME LOCATION ≠ SAME COMPLAINT) */}
          {/* ========================================================= */}
          <div className="bg-white rounded-xl border border-[#E5E3DC] shadow-xs overflow-hidden">
            <div className="p-3.5 bg-[#FAF9F5] border-b border-[#E5E3DC] flex items-center justify-between text-xs">
              <span className="font-bold text-[#191B1F] flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-[#2C5E48]" />
                Co-located Civic Issues at this Location
              </span>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-[#EBF7EF] text-[#1E6B42] border border-[#C8EAD4]">
                {colocatedIncidents.length > 0
                  ? `${colocatedIncidents.length + 1} distinct issues active here`
                  : '1 issue at this site'}
              </span>
            </div>

            <div className="p-4 space-y-3">
              <div className="p-3 rounded-lg bg-[#FAF9F5] border border-[#E5E3DC] text-xs text-[#565C68] leading-relaxed">
                <p className="font-semibold text-[#191B1F] flex items-center gap-1 mb-1">
                  <ShieldCheck className="w-3.5 h-3.5 text-[#2C5E48]" />
                  Core Municipal Rule: Same location does NOT mean same complaint
                </p>
                <p>
                  Multiple distinct civic problems can and do exist at the same geographic coordinate.
                  Each issue is registered as an independent complaint, routed to its dedicated municipal department, and resolved through its own lifecycle.
                </p>
              </div>

              {colocatedIncidents.length > 0 ? (
                <div className="space-y-2.5">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-[#7E8592]">
                    Other Active Complaints at this Coordinate ({colocatedIncidents.length}):
                  </div>
                  {colocatedIncidents.map((other) => (
                    <div
                      key={other.id}
                      className="p-3 rounded-xl border border-[#E5E3DC] hover:border-[#2C5E48] hover:shadow-xs transition-all bg-white flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-[10px] font-mono font-bold text-[#565C68] bg-[#F4F3EF] px-1.5 py-0.5 rounded border border-[#E5E3DC]">
                            {other.ticketNumber}
                          </span>
                          <CategoryBadge category={other.category} />
                          <StatusBadge status={other.status} />
                          <span className="text-[11px] font-mono text-[#7E8592]">
                            Risk: <b className={other.riskScore >= 75 ? 'text-[#C54E38]' : other.riskScore >= 50 ? 'text-[#C88427]' : 'text-[#1E6B42]'}>{other.riskScore}</b>
                          </span>
                        </div>
                        <h4 className="text-xs font-bold text-[#191B1F] line-clamp-1">
                          {other.title}
                        </h4>
                        <div className="text-[11px] text-[#7E8592] flex items-center gap-2">
                          <span>Dept: <b className="text-[#565C68]">{other.assignedTeam || other.sourceAttribution || 'Municipal Dept'}</b></span>
                          <span>&bull;</span>
                          <span>Reports: <b>{other.confidenceEvidence.relatedReportsCount}</b></span>
                        </div>
                      </div>

                      <button
                        onClick={() => selectIncident(other.id, true)}
                        className="px-3 py-1.5 rounded-lg bg-[#F4F3EF] hover:bg-[#2C5E48] hover:text-white text-[#191B1F] text-xs font-bold transition-all shrink-0 flex items-center justify-center gap-1"
                      >
                        <span>Inspect Issue</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-xs text-[#7E8592] italic py-1">
                  No other active civic complaints are currently open at this exact coordinate.
                </div>
              )}
            </div>
          </div>

          {/* ========================================================= */}
          {/* CONNECTED INFRASTRUCTURE ASSET (CIVIC DNA)                */}
          {/* ========================================================= */}
          {(() => {
            const linkedAsset = inc.associatedAssetId
              ? assets.find((a) => a.assetId === inc.associatedAssetId)
              : null;
            const nearbyAssets = !linkedAsset
              ? getNearbyAssets(inc.latitude, inc.longitude, 100)
              : [];
            const candidateAsset = nearbyAssets[0] || null;

            return (
              <div className="p-4 rounded-xl bg-white border border-amber-200/80 shadow-xs space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-stone-200">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-amber-600" />
                    <h3 className="text-xs font-bold text-stone-900 uppercase tracking-wider font-mono">
                      Civic DNA Persistent Asset
                    </h3>
                  </div>
                  {linkedAsset ? (
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" />
                      Associated
                    </span>
                  ) : candidateAsset ? (
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full font-bold bg-amber-100 text-amber-800 border border-amber-200">
                      Proximity Candidate
                    </span>
                  ) : null}
                </div>

                {linkedAsset ? (
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono text-xs font-bold text-stone-900 bg-stone-100 px-1.5 py-0.5 rounded">
                            #{linkedAsset.assetId}
                          </span>
                          <span className="text-xs font-semibold text-stone-800">
                            {linkedAsset.assetName}
                          </span>
                        </div>
                        <div className="text-[11px] text-stone-500 mt-1 flex items-center gap-2">
                          <span>{linkedAsset.department}</span>
                          <span>&bull;</span>
                          <span className="font-mono text-emerald-700 font-semibold">
                            {inc.associatedAssetDistanceMeters || 18}m from complaint coordinate
                          </span>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <div className="text-[10px] text-stone-400 font-mono">Health Score</div>
                        <div
                          className={`text-sm font-mono font-bold ${
                            linkedAsset.currentHealthScore >= 75
                              ? 'text-emerald-700'
                              : linkedAsset.currentHealthScore >= 60
                              ? 'text-amber-700'
                              : 'text-red-700'
                          }`}
                        >
                          {linkedAsset.currentHealthScore}/100
                        </div>
                      </div>
                    </div>

                    <div className="p-2.5 rounded-lg bg-stone-50 border border-stone-200 text-xs space-y-1">
                      <div className="flex justify-between">
                        <span className="text-stone-500">Failure Recurrence:</span>
                        <span className="font-mono font-bold text-stone-800">
                          {linkedAsset.failureCount} recorded failures ({linkedAsset.ageYears}y old)
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-stone-500">Recommendation:</span>
                        <span className="font-bold text-amber-900">
                          {linkedAsset.recommendation.title}
                        </span>
                      </div>
                    </div>

                    <button
                      onClick={() => {
                        setIsDetailOpen(false);
                        openAssetProfile(linkedAsset.assetId);
                      }}
                      className="w-full py-2 px-3 rounded-lg bg-stone-900 hover:bg-stone-800 text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors shadow-xs"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                      <span>Inspect Complete Civic DNA Profile & Lifecycle →</span>
                    </button>
                  </div>
                ) : candidateAsset ? (
                  <div className="space-y-3 text-xs">
                    <p className="text-stone-600">
                      Nearby municipal fixture detected within 100m radius of this incident:
                    </p>
                    <div className="p-3 bg-stone-50 rounded-lg border border-stone-200 flex items-center justify-between">
                      <div>
                        <div className="font-semibold text-stone-900">
                          {candidateAsset.assetName} (#{candidateAsset.assetId})
                        </div>
                        <div className="text-[11px] text-stone-500 mt-0.5">
                          {candidateAsset.department} &bull; Health: {candidateAsset.currentHealthScore}/100
                        </div>
                      </div>
                      <button
                        onClick={() => associateComplaintWithAsset(inc.id, candidateAsset.assetId)}
                        className="px-2.5 py-1.5 rounded-lg bg-[#2C5E48] hover:bg-[#1E4333] text-white font-semibold text-xs transition-colors shrink-0"
                      >
                        Link to Asset
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="text-xs text-stone-500 italic">
                    No physical asset within 100m proximity. Asset will be mapped upon field survey.
                  </div>
                )}
              </div>
            );
          })()}

          {/* ========================================================= */}
          {/* SANKET INTELLIGENCE SECTION                              */}
          {/* ========================================================= */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full bg-[#2C5E48]"></div>
                <h3 className="text-xs font-bold text-[#191B1F] uppercase tracking-wider">
                  SANKET Municipal Intelligence
                </h3>
              </div>
              <DemoBadge label="OPERATIONAL AI SYNTHESIS" />
            </div>

            {/* 1. CIVIC RISK */}
            <div className="p-4 rounded-xl bg-white border border-[#E5E3DC] shadow-xs">
              <div className="flex items-start justify-between">
                <div>
                  <span className="text-[11px] font-semibold text-[#565C68] uppercase tracking-wider block">
                    Civic Risk
                  </span>
                  <div className="flex items-baseline gap-2 mt-0.5">
                    <span className="text-2xl font-black font-mono text-[#C54E38]">
                      {inc.riskScore}
                    </span>
                    <span className="text-xs font-bold text-[#7E8592]">/ 100</span>
                    <span className="text-xs font-bold uppercase text-[#C54E38] bg-[#FDF0ED] px-2 py-0.5 rounded border border-[#F8D2CA]">
                      {inc.riskLevel} Priority
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => setIsWhyScoreOpen(true)}
                  className="flex items-center gap-1 text-xs font-bold text-[#2C5E48] hover:text-[#1E4333] hover:underline"
                >
                  <HelpCircle className="w-3.5 h-3.5" />
                  <span>Why this score?</span>
                </button>
              </div>

              <p className="text-xs text-[#565C68] mt-2 leading-relaxed">
                {inc.riskReasoning}
              </p>

              {/* Compact 4-factor breakdown */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-3 pt-3 border-t border-[#F4F3EF] text-center">
                <div className="bg-[#FAF9F5] p-2 rounded-lg border border-[#E5E3DC]">
                  <span className="text-[10px] text-[#7E8592] uppercase font-semibold block">Severity</span>
                  <span className="font-mono font-bold text-xs text-[#191B1F]">{inc.severity} / 10</span>
                </div>
                <div className="bg-[#FAF9F5] p-2 rounded-lg border border-[#E5E3DC]">
                  <span className="text-[10px] text-[#7E8592] uppercase font-semibold block">Public Impact</span>
                  <span className="font-mono font-bold text-xs text-[#191B1F]">{inc.publicImpact} / 10</span>
                </div>
                <div className="bg-[#FAF9F5] p-2 rounded-lg border border-[#E5E3DC]">
                  <span className="text-[10px] text-[#7E8592] uppercase font-semibold block">Location Exposure</span>
                  <span className="font-mono font-bold text-xs text-[#191B1F]">{inc.locationExposure} / 10</span>
                </div>
                <div className="bg-[#FAF9F5] p-2 rounded-lg border border-[#E5E3DC]">
                  <span className="text-[10px] text-[#7E8592] uppercase font-semibold block">Waiting Penalty</span>
                  <span className="font-mono font-bold text-xs text-[#191B1F]">{inc.waitingScore} / 10</span>
                </div>
              </div>
            </div>

            {/* 2. CIVIC CONFIDENCE */}
            <div className="p-4 rounded-xl bg-white border border-[#E5E3DC] shadow-xs">
              <div className="flex items-start justify-between">
                <div>
                  <span className="text-[11px] font-semibold text-[#565C68] uppercase tracking-wider block">
                    Civic Confidence
                  </span>
                  <div className="flex items-baseline gap-2 mt-0.5">
                    <span className="text-2xl font-black font-mono text-[#1E6B42]">
                      {inc.confidenceScore}%
                    </span>
                    <span className="text-xs font-bold text-[#1E6B42] bg-[#EBF7EF] px-2 py-0.5 rounded border border-[#C8EAD4]">
                      HIGH CONFIDENCE
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => setIsEvidenceOpen(true)}
                  className="flex items-center gap-1 text-xs font-bold text-[#2C5E48] hover:text-[#1E4333] hover:underline"
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>View Evidence</span>
                </button>
              </div>

              {/* Why? Compact list */}
              <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
                <div className="p-2 rounded-lg bg-[#EBF7EF]/50 border border-[#C8EAD4] flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-[#1E6B42] shrink-0" />
                  <span><b>{inc.confidenceEvidence.relatedReportsCount}</b> related reports</span>
                </div>
                <div className="p-2 rounded-lg bg-[#EBF7EF]/50 border border-[#C8EAD4] flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-[#1E6B42] shrink-0" />
                  <span><b>{inc.confidenceEvidence.locationMatchRadiusMeters}m</b> GPS radius</span>
                </div>
                <div className="p-2 rounded-lg bg-[#EBF7EF]/50 border border-[#C8EAD4] flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-[#1E6B42] shrink-0" />
                  <span><b>{inc.confidenceEvidence.visualSimilarityPercentage}%</b> visual match</span>
                </div>
                <div className="p-2 rounded-lg bg-[#EBF7EF]/50 border border-[#C8EAD4] flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-[#1E6B42] shrink-0" />
                  <span>Strong time cluster</span>
                </div>
              </div>
            </div>

            {/* 3. CIVIC MEMORY (If recurring) */}
            {inc.isRecurring && (
              <div className="p-4 rounded-xl bg-[#FAF9F5] border border-[#E5E3DC] shadow-xs">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <History className="w-4 h-4 text-[#C88427]" />
                    <span className="text-xs font-bold text-[#191B1F]">
                      Civic Memory: Recurring Infrastructure Hotspot
                    </span>
                  </div>
                  <button
                    onClick={() => {
                      setActiveTab('civic_memory');
                      setIsDetailOpen(false);
                    }}
                    className="text-xs font-bold text-[#2C5E48] hover:underline flex items-center gap-1"
                  >
                    <span>View History</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>

                <p className="text-xs text-[#565C68] mt-1.5 leading-relaxed">
                  {inc.rootCauseHypothesis ||
                    'Persistent subgrade degradation and repeated surface failures recorded at this location.'}
                </p>

                {/* Recurrence timeline: JAN -> APR -> AUG */}
                <div className="mt-3 p-3 bg-white rounded-lg border border-[#E5E3DC]">
                  <span className="text-[10px] font-bold text-[#7E8592] uppercase tracking-wider block mb-2">
                    Failure Sequence at this Coordinate
                  </span>
                  <div className="flex items-center justify-between text-xs font-mono">
                    <div className="text-center">
                      <span className="text-[10px] text-[#7E8592] block">JAN</span>
                      <span className="font-bold text-[#191B1F]">Pothole</span>
                      <span className="text-[9px] text-[#7E8592] block">Cold Mix</span>
                    </div>
                    <ChevronRight className="w-3.5 h-3.5 text-[#C88427]" />
                    <div className="text-center">
                      <span className="text-[10px] text-[#7E8592] block">APR</span>
                      <span className="font-bold text-[#191B1F]">Road Crack</span>
                      <span className="text-[9px] text-[#7E8592] block">Slurry Seal</span>
                    </div>
                    <ChevronRight className="w-3.5 h-3.5 text-[#C88427]" />
                    <div className="text-center">
                      <span className="text-[10px] text-[#C54E38] font-bold block">AUG</span>
                      <span className="font-bold text-[#C54E38]">Pothole Cluster</span>
                      <span className="text-[9px] text-[#C54E38] block">Current</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* 4. PRIORITY AGING */}
            <div className="p-4 rounded-xl bg-white border border-[#E5E3DC] shadow-xs">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[11px] font-semibold text-[#565C68] uppercase tracking-wider block">
                    Priority Aging
                  </span>
                  <div className="flex items-baseline gap-1.5 mt-0.5">
                    <span className="text-xl font-bold font-mono text-[#191B1F]">
                      Waiting {inc.waitingDays} Days
                    </span>
                    {inc.waitingDays >= 30 && (
                      <span className="text-xs font-bold text-[#C54E38] bg-[#FDF0ED] px-2 py-0.5 rounded border border-[#F8D2CA]">
                        SLA Threshold Crossed
                      </span>
                    )}
                  </div>
                </div>
                <Clock className="w-5 h-5 text-[#7E8592]" />
              </div>

              {/* Aging Timeline Steps */}
              <div className="mt-3 pt-3 border-t border-[#F4F3EF]">
                <div className="grid grid-cols-4 gap-2 text-center text-xs">
                  {inc.agingCurve.map((step) => (
                    <div
                      key={step.day}
                      className={`p-2 rounded-lg border ${
                        step.isCurrent
                          ? 'bg-[#FDF0ED] border-[#F8D2CA] text-[#C54E38]'
                          : step.isPast
                          ? 'bg-[#FAF9F5] border-[#E5E3DC] text-[#191B1F]'
                          : 'bg-white border-[#E5E3DC] text-[#7E8592]'
                      }`}
                    >
                      <span className="text-[10px] font-mono block">Day {step.day}</span>
                      <span className="font-bold text-[11px] block">{step.riskBoost > 0 ? `+${step.riskBoost}` : 'Base'}</span>
                    </div>
                  ))}
                </div>
                <p className="text-[11px] text-[#7E8592] mt-2 italic text-center">
                  "Priority automatically escalates when an unresolved issue continues waiting."
                </p>
              </div>
            </div>

            {/* 5. RESOLUTION EVIDENCE & CONDITION VERIFICATION */}
            {(inc.beforePhoto || inc.beforeImageUrl || inc.afterPhoto || inc.afterImageUrl || inc.status === 'resolved' || inc.status === 'closed' || inc.completedAt) && (
              <div className="p-4 rounded-xl bg-white border border-[#E5E3DC] shadow-xs space-y-3">
                <div className="flex items-center justify-between border-b border-[#F4F3EF] pb-2.5">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-[#1E6B42]" />
                    <span className="text-xs font-bold uppercase tracking-wider text-[#191B1F]">
                      Task Resolution & Evidence
                    </span>
                  </div>
                  {inc.completedAt ? (
                    <span className="text-[11px] font-mono px-2 py-0.5 rounded-md bg-[#EBF7EF] text-[#1E6B42] font-semibold flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      Completed: {new Date(inc.completedAt).toLocaleString(undefined, {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </span>
                  ) : inc.smartClosure?.inspectedAt ? (
                    <span className="text-[11px] font-mono px-2 py-0.5 rounded-md bg-[#EBF7EF] text-[#1E6B42] font-semibold flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      Inspected: {new Date(inc.smartClosure.inspectedAt).toLocaleString(undefined, {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </span>
                  ) : inc.status === 'resolved' || inc.status === 'closed' || inc.assignmentStatus === 'Completed' ? (
                    <span className="text-[11px] font-mono px-2 py-0.5 rounded-md bg-[#FAF9F5] text-[#7E8592]">
                      Resolved
                    </span>
                  ) : (
                    <span className="text-[11px] font-mono px-2 py-0.5 rounded-md bg-[#FDF0ED] text-[#C54E38]">
                      In Progress
                    </span>
                  )}
                </div>

                {/* 2-Column Before & After Display */}
                <div className="grid grid-cols-2 gap-3">
                  {/* Before Photo - Original Condition */}
                  <div className="p-2.5 rounded-lg bg-[#FAF9F5] border border-[#E5E3DC] flex flex-col justify-between">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[11px] font-bold text-[#191B1F] flex items-center gap-1">
                        <Camera className="w-3 h-3 text-[#7E8592]" />
                        Before Repair
                      </span>
                      <span className="text-[9px] uppercase px-1.5 py-0.5 rounded bg-amber-50 text-amber-800 font-semibold border border-amber-200">
                        Original
                      </span>
                    </div>

                    {(inc.beforePhoto || inc.beforeImageUrl) ? (
                      <div className="relative group overflow-hidden rounded-md border border-[#E5E3DC] bg-black/5">
                        <img
                          src={inc.beforePhoto || inc.beforeImageUrl}
                          alt="Before Repair - Original Condition"
                          className="w-full h-28 object-cover transition-transform group-hover:scale-105"
                        />
                        <a
                          href={inc.beforePhoto || inc.beforeImageUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity text-white text-[11px] font-semibold gap-1"
                        >
                          <ExternalLink className="w-3.5 h-3.5" /> View Full
                        </a>
                      </div>
                    ) : (
                      <div className="h-28 rounded-md border border-dashed border-[#D5D3CC] flex flex-col items-center justify-center text-[#7E8592] bg-white text-center p-2">
                        <Camera className="w-5 h-5 text-[#A0A5B0] mb-1" />
                        <span className="text-[10px]">No before photo uploaded</span>
                      </div>
                    )}
                    <p className="text-[10px] text-[#7E8592] mt-1.5 line-clamp-1">
                      Original condition when issue was assigned
                    </p>
                  </div>

                  {/* After Photo - Post-Resolution Condition */}
                  <div className="p-2.5 rounded-lg bg-[#FAF9F5] border border-[#E5E3DC] flex flex-col justify-between">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[11px] font-bold text-[#191B1F] flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3 text-[#1E6B42]" />
                        After Repair
                      </span>
                      <span className={`text-[9px] uppercase px-1.5 py-0.5 rounded font-semibold border ${
                        (inc.afterPhoto || inc.afterImageUrl)
                          ? 'bg-[#EBF7EF] text-[#1E6B42] border-[#C8EAD4]'
                          : 'bg-[#F4F3EF] text-[#7E8592] border-[#E5E3DC]'
                      }`}>
                        {(inc.afterPhoto || inc.afterImageUrl) ? 'Resolved' : 'Pending'}
                      </span>
                    </div>

                    {(inc.afterPhoto || inc.afterImageUrl) ? (
                      <div className="relative group overflow-hidden rounded-md border border-[#C8EAD4] bg-black/5">
                        <img
                          src={inc.afterPhoto || inc.afterImageUrl}
                          alt="After Repair - Post-Resolution Condition"
                          className="w-full h-28 object-cover transition-transform group-hover:scale-105"
                        />
                        <a
                          href={inc.afterPhoto || inc.afterImageUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity text-white text-[11px] font-semibold gap-1"
                        >
                          <ExternalLink className="w-3.5 h-3.5" /> View Full
                        </a>
                      </div>
                    ) : (
                      <div className="h-28 rounded-md border border-dashed border-[#D5D3CC] flex flex-col items-center justify-center text-[#7E8592] bg-white text-center p-2">
                        <Clock className="w-5 h-5 text-[#A0A5B0] mb-1" />
                        <span className="text-[10px]">Pending repair completion</span>
                      </div>
                    )}
                    <p className="text-[10px] text-[#7E8592] mt-1.5 line-clamp-1">
                      Post-resolution condition submitted by field worker
                    </p>
                  </div>
                </div>

                {/* Smart Match Banner if after photo available */}
                {(inc.afterPhoto || inc.afterImageUrl) && (
                  <div className="p-3 rounded-lg bg-[#EBF7EF] border border-[#C8EAD4] flex items-center justify-between">
                    <div>
                      <span className="text-xs font-bold text-[#1E6B42] uppercase tracking-wider block">
                        SANKET Smart Closure Match
                      </span>
                      <p className="text-xs text-[#1E6B42] mt-0.5">
                        {inc.smartClosure?.matchConfidence || 96}% Likely Match • {inc.smartClosure?.distanceMeters || 8}m away
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {inc.status !== 'resolved' && inc.status !== 'closed' && inc.assignmentStatus !== 'Completed' ? (
                        <button
                          onClick={() => completeIncident(inc.id, inc.afterPhoto || inc.afterImageUrl, inc.beforePhoto || inc.beforeImageUrl)}
                          className="px-3 py-1.5 rounded-lg text-xs font-bold bg-[#1E6B42] text-white hover:bg-[#185333] transition-colors shadow-xs flex items-center gap-1"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Complete Task</span>
                        </button>
                      ) : (
                        <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-[#1E6B42]/10 text-[#1E6B42] border border-[#C8EAD4] flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Completed</span>
                        </span>
                      )}
                      <button
                        onClick={openSmartClosure}
                        className="px-3 py-1.5 rounded-lg text-xs font-bold bg-white text-[#1E6B42] border border-[#C8EAD4] hover:bg-[#E5F5EB] transition-colors shadow-xs"
                      >
                        Match Evidence
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Bottom Actions Sticky Bar */}
        <div className="p-4 sm:p-5 border-t border-[#E5E3DC] bg-[#FAF9F5] flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="text-xs text-[#7E8592] flex items-center gap-1.5">
            <UserCheck className="w-4 h-4 text-[#2C5E48]" />
            <span>
              Assigned:{' '}
              <b className="text-[#191B1F]">
                {inc.assignedWorkerName
                  ? `${inc.assignedWorkerId ? `${inc.assignedWorkerId} — ` : ''}${inc.assignedWorkerName}`
                  : inc.assignedWorkerId && inc.assignedWorkerId !== 'Unassigned'
                  ? inc.assignedWorkerId
                  : 'Unassigned'}
              </b>
              {(inc.assignedDepartment || inc.department) && (
                <span className="text-[#7E8592] ml-1">
                  ({inc.assignedDepartment || inc.department})
                </span>
              )}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {(inc.afterPhoto || inc.afterImageUrl || inc.status === 'needs_review') && inc.status !== 'resolved' && inc.status !== 'closed' && inc.assignmentStatus !== 'Completed' ? (
              <button
                onClick={() => completeIncident(inc.id, inc.afterPhoto || inc.afterImageUrl, inc.beforePhoto || inc.beforeImageUrl)}
                className="px-3.5 py-2 rounded-lg text-xs font-bold bg-[#1E6B42] text-white hover:bg-[#185333] transition-colors flex items-center gap-1.5 shadow-xs"
              >
                <CheckCircle2 className="w-3.5 h-3.5 text-white" />
                <span>Verify & Complete Task</span>
              </button>
            ) : null}
            <button
              onClick={openSmartClosure}
              className="px-3.5 py-2 rounded-lg text-xs font-bold bg-white text-[#1E6B42] border border-[#C8EAD4] hover:bg-[#E5F5EB] transition-colors flex items-center gap-1.5 shadow-xs"
            >
              <HardHat className="w-3.5 h-3.5 text-[#1E6B42]" />
              <span>Smart Closure Match</span>
            </button>
          </div>
        </div>
        </div>
      </section>
    </div>
  );
};
