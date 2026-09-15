/**
 * Field Worker — Job Detail (/field/jobs/:id)
 *
 * Real field completion flow:
 *
 * ASSIGNED
 *   ↓
 * NAVIGATE
 *   ↓
 * START WORK
 *   ↓
 * FIELD CHECK
 *   ↓
 * REAL COMPLETION PHOTO
 *   ↓
 * REAL DEVICE GPS
 *   ↓
 * BACKEND SMART CLOSURE
 *   ↓
 * AUTOMATIC RESOLUTION or NEEDS REVIEW
 *
 * Smart Closure values are never manufactured in the frontend.
 * The backend is the source of truth.
 */

import React, {
  useEffect,
  useRef,
  useState,
} from 'react';

import {
  Camera,
  Check,
  CheckCircle2,
  ChevronLeft,
  ClipboardCheck,
  Clock,
  HardHat,
  ImageUp,
  Info,
  MapPin,
  Navigation,
  Send,
  ShieldCheck,
  Sparkles,
  WifiOff,
  AlertTriangle,
  MapPinOff,
} from 'lucide-react';

import { CivicMap } from '../common/CivicMap';
import { useCivic, haversineMeters } from '../../context/CivicContext';
import { useCitizenLocation } from '../citizen/useCitizenLocation';
import { readExifFromBlob } from '../../utils/exifReader';

import {
  categoryTitle,
  FIELD_STATUS,
  jobPriority,
  navigateTo,
} from './fieldData';

import {
  JobStatusPill,
  SectionHeading,
} from './FieldPages';


type Phase =
  | 'overview'
  | 'in_progress'
  | 'analysis'
  | 'verification'
  | 'submitted';


export const FieldJobDetail:
  React.FC<{
    incidentId: string;
  }> = ({
    incidentId
  }) => {

  const {
    incidents,
    startFieldWork,
    submitClosureEvidence,
    uploadBeforePhoto,
    isOffline,
    showToast,
  } = useCivic();


  const incident =
    incidents.find(
      i =>
        i.id === incidentId
    ) ?? null;


  const {
    coords,
    request,
  } = useCitizenLocation();


  /* =======================================================
     PHASE
  ======================================================= */

  const [phase, setPhase] =
    useState<Phase>(() => {

      const status =
        incidents.find(
          i =>
            i.id === incidentId
        )?.status;

      return status === 'resolved' ||
        status === 'needs_review'
        ? 'submitted'
        : status === 'in_progress'
          ? 'in_progress'
          : 'overview';
    });


  /* =======================================================
     COMPLETION EVIDENCE (BEFORE & AFTER PHOTOS)
  ======================================================= */

  const [beforePhotoFile, setBeforePhotoFile] =
    useState<File | null>(null);

  const [beforePhotoPreview, setBeforePhotoPreview] =
    useState<string | null>(() => incident?.beforePhoto || incident?.beforeImageUrl || null);

  const [afterPhotoFile, setAfterPhotoFile] =
    useState<File | null>(null);

  const [afterPhotoPreview, setAfterPhotoPreview] =
    useState<string | null>(() => incident?.afterPhoto || incident?.afterImageUrl || null);

  useEffect(() => {
    if (!beforePhotoFile && (incident?.beforePhoto || incident?.beforeImageUrl)) {
      setBeforePhotoPreview(incident.beforePhoto || incident.beforeImageUrl || null);
    }
    if (!afterPhotoFile && (incident?.afterPhoto || incident?.afterImageUrl)) {
      setAfterPhotoPreview(incident.afterPhoto || incident.afterImageUrl || null);
    }
  }, [incident?.beforePhoto, incident?.beforeImageUrl, incident?.afterPhoto, incident?.afterImageUrl, beforePhotoFile, afterPhotoFile]);

  const beforeObjectUrlRef = useRef<string | null>(null);
  const afterObjectUrlRef = useRef<string | null>(null);

  const [note, setNote] =
    useState('');

  const [submitting, setSubmitting] =
    useState(false);

  /* =======================================================
     EXIF METADATA VERIFICATION
  ======================================================= */

  const MAX_PHOTO_DISTANCE_METERS = 500;

  const [beforeExifStatus, setBeforeExifStatus] = useState<
    'pending' | 'verified' | 'no_gps' | 'too_far'
  >('pending');
  const [afterExifStatus, setAfterExifStatus] = useState<
    'pending' | 'verified' | 'no_gps' | 'too_far'
  >('pending');
  const [beforeExifDistance, setBeforeExifDistance] = useState<number | null>(null);
  const [afterExifDistance, setAfterExifDistance] = useState<number | null>(null);

  const metadataBlocked =
    beforeExifStatus === 'too_far' ||
    afterExifStatus === 'too_far' ||
    beforeExifStatus === 'no_gps' ||
    afterExifStatus === 'no_gps';

  const verifyPhotoExif = async (
    file: File,
    which: 'before' | 'after'
  ) => {
    const setStatus = which === 'before' ? setBeforeExifStatus : setAfterExifStatus;
    const setDistance = which === 'before' ? setBeforeExifDistance : setAfterExifDistance;

    try {
      const exif = await readExifFromBlob(file);
      if (!exif.exifGpsAvailable || exif.incidentLatitude === null || exif.incidentLongitude === null) {
        setStatus('no_gps');
        setDistance(null);
        showToast(
          'GPS Metadata Required',
          `The ${which} photo has no identified GPS metadata. Submission disabled — please upload a photo captured with location/GPS enabled.`,
          'urgent'
        );
        return;
      }

      const incLat = incident?.latitude ?? 30.7333;
      const incLng = incident?.longitude ?? 76.7794;
      const dist = haversineMeters(incLat, incLng, exif.incidentLatitude, exif.incidentLongitude);
      setDistance(Math.round(dist));

      if (dist > MAX_PHOTO_DISTANCE_METERS) {
        setStatus('too_far');
        showToast(
          'Location Mismatch',
          `Photo was taken ${Math.round(dist)}m from the incident. Maximum allowed: ${MAX_PHOTO_DISTANCE_METERS}m. Submission disabled.`,
          'urgent'
        );
      } else {
        setStatus('verified');
      }
    } catch (err) {
      console.warn('EXIF read error:', err);
      setStatus('no_gps');
      setDistance(null);
      showToast(
        'GPS Metadata Error',
        `Could not identify EXIF location metadata in the ${which} photo. Submission disabled.`,
        'urgent'
      );
    }
  };

  const headingRef =
    useRef<HTMLHeadingElement>(null);


  /* =======================================================
     FOCUS
  ======================================================= */

  useEffect(() => {

    headingRef.current?.focus();

  }, [phase]);


  /* =======================================================
     PREVIEW CLEANUP
  ======================================================= */

  useEffect(() => {
    return () => {
      if (beforeObjectUrlRef.current) {
        URL.revokeObjectURL(beforeObjectUrlRef.current);
      }
      if (afterObjectUrlRef.current) {
        URL.revokeObjectURL(afterObjectUrlRef.current);
      }
    };
  }, []);


  /* =======================================================
     INCIDENT NOT FOUND
  ======================================================= */

  if (!incident) {

    return (
      <div className="fw-page">

        <button
          className="fw-text-action"
          onClick={() =>
            navigateTo('/field/jobs')
          }
        >

          <ChevronLeft
            className="h-4 w-4"
            aria-hidden="true"
          />

          Back to jobs

        </button>

        <p className="mt-4 text-sm text-[#565C68]">
          This job could not be found. It may have been reassigned.
        </p>

      </div>
    );
  }


  /* =======================================================
     DERIVED DATA
  ======================================================= */

  const priority =
    jobPriority(incident);

  const statusInfo =
    FIELD_STATUS[incident.status];

  const smartClosure =
    incident.smartClosure;

  /*
   * IncidentStatus in CivicLens uses "resolved" as the
   * frontend terminal state. Backend "closed" is normalized
   * to resolved by CivicContext.
   */
  const automaticallyResolved =
    incident.status === 'resolved';


  /* =======================================================
     ACTIONS
  ======================================================= */

  const startWork = () => {

    startFieldWork(
      incident.id
    );

    setPhase(
      'in_progress'
    );
  };


  /*
   * Get a fresh browser location at the exact moment
   * completion evidence is submitted.
   *
   * We deliberately do not rely only on cached map
   * coordinates.
   */
  const getFreshLocation =
    async (): Promise<{
      latitude: number;
      longitude: number;
      accuracyMeters: number | null;
    }> => {

      if (
        !('geolocation' in navigator)
      ) {

        throw new Error(
          'This browser does not provide GPS location. Smart Closure requires field location evidence.'
        );
      }


      return new Promise(
        (
          resolve,
          reject
        ) => {

          navigator.geolocation.getCurrentPosition(

            position => {

              resolve({
                latitude:
                  position.coords.latitude,

                longitude:
                  position.coords.longitude,

                accuracyMeters:
                  Number.isFinite(
                    position.coords.accuracy
                  )
                    ? position.coords.accuracy
                    : null,
              });

            },

            error => {

              let message =
                'Unable to capture your current field location.';


              if (
                error.code ===
                error.PERMISSION_DENIED
              ) {

                message =
                  'Location permission was denied. Smart Closure requires GPS evidence.';

              } else if (
                error.code ===
                error.POSITION_UNAVAILABLE
              ) {

                message =
                  'Your current GPS location is unavailable. Move to an area with location access and try again.';

              } else if (
                error.code ===
                error.TIMEOUT
              ) {

                message =
                  'GPS location timed out. Please try the completion submission again.';
              }


              reject(
                new Error(
                  message
                )
              );

            },

            {
              enableHighAccuracy: true,
              timeout: 15000,
              maximumAge: 0,
            }

          );

        }
      );
    };


  const handleBeforePhotoChange = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      showToast('Invalid image', 'Please select an image for the before repair photo.', 'warning');
      return;
    }
    if (beforeObjectUrlRef.current) {
      URL.revokeObjectURL(beforeObjectUrlRef.current);
    }
    const url = URL.createObjectURL(file);
    beforeObjectUrlRef.current = url;
    setBeforePhotoFile(file);
    setBeforePhotoPreview(url);

    // Verify EXIF GPS metadata
    await verifyPhotoExif(file, 'before');

    if (uploadBeforePhoto && !isOffline) {
      try {
        await uploadBeforePhoto(incident.id, file);
        showToast('Before Photo Uploaded', 'Initial site damage evidence recorded.', 'info');
      } catch (err) {
        console.warn('Auto-upload before photo notice:', err);
      }
    }
  };

  const handleAfterPhotoChange = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      showToast('Invalid image', 'Please select an image for the after repair completion photo.', 'warning');
      return;
    }
    if (afterObjectUrlRef.current) {
      URL.revokeObjectURL(afterObjectUrlRef.current);
    }
    const url = URL.createObjectURL(file);
    afterObjectUrlRef.current = url;
    setAfterPhotoFile(file);
    setAfterPhotoPreview(url);

    // Verify EXIF GPS metadata
    await verifyPhotoExif(file, 'after');
  };

  const hasBefore = Boolean(beforePhotoFile || beforePhotoPreview || incident?.beforePhoto || incident?.beforeImageUrl);
  const hasAfter = Boolean(afterPhotoFile || afterPhotoPreview || incident?.afterPhoto || incident?.afterImageUrl);

  const workStatus: 'In Progress' | 'Ready for Completion' | 'Completed' =
    incident?.status === 'resolved' || incident?.status === 'closed'
      ? 'Completed'
      : hasBefore && hasAfter
      ? 'Ready for Completion'
      : 'In Progress';

  const submitCompletion =
    async () => {

      if (!hasBefore || !hasAfter) {
        showToast(
          'Both photos required',
          'Upload both Before Repair and After Repair photos to complete the task.',
          'warning'
        );
        return;
      }

      if (metadataBlocked) {
        showToast(
          'Location Mismatch',
          'One or more photos were taken too far from the incident location. Replace the flagged photo(s) to proceed.',
          'urgent'
        );
        return;
      }

      if (isOffline) {
        showToast(
          'Connection required',
          'Smart Closure needs to send the completion evidence to the SANKET backend. Reconnect before submitting.',
          'warning'
        );
        return;
      }

      setSubmitting(true);
      setPhase('analysis');

      try {
        const location = await getFreshLocation();

        if (afterPhotoFile) {
          await submitClosureEvidence(
            incident.id,
            afterPhotoFile,
            location.latitude,
            location.longitude,
            location.accuracyMeters,
            beforePhotoFile
          );
        }

        setPhase('submitted');
      } catch (error) {
        console.error('Smart Closure submission failed:', error);
        setPhase('in_progress');
        showToast(
          'Closure submission failed',
          error instanceof Error ? error.message : 'Unable to submit completion evidence.',
          'urgent'
        );
      } finally {
        setSubmitting(false);
      }
    };


  const navigate = () => {

    request();

    if (
      !('geolocation' in navigator)
    ) {

      showToast(
        'Navigation ready',
        'Route to the incident is highlighted on the map. No external navigation service is connected.',
        'info'
      );

    }

  };


  /* =======================================================
     RENDER
  ======================================================= */

  return (

    <div className="fw-page">

      <button
        className="fw-text-action mb-2"
        onClick={() =>
          navigateTo('/field/jobs')
        }
      >

        <ChevronLeft
          className="h-4 w-4"
          aria-hidden="true"
        />

        Back to jobs

      </button>


      {/* ===================================================
          JOB HEADER
      =================================================== */}

      <header className="fw-job-detail-head">

        <span
          className={`fw-priority-flag tone-${priority.tone}`}
        >
          {priority.label}
        </span>


        <h1
          ref={headingRef}
          tabIndex={-1}
          className="mt-2 text-xl font-extrabold tracking-[-.03em]"
        >
          {categoryTitle(incident)}
        </h1>


        <p className="mt-1 text-xs font-mono text-[#7E8592]">
          {incident.ticketNumber}
        </p>


        <p className="mt-1 flex items-center gap-1.5 text-sm text-[#565C68]">

          <MapPin
            className="h-4 w-4"
            aria-hidden="true"
          />

          {incident.sector} · {incident.location}

        </p>


        <div className="mt-2 flex flex-wrap items-center gap-2">

          <JobStatusPill
            status={incident.status}
          />

          <span
            className="fw-text-action"
            aria-hidden="true"
          >
            Assigned to you
          </span>

        </div>

      </header>


      {/* ===================================================
          OFFLINE
      =================================================== */}

      {isOffline && (

        <div
          className="citizen-location-note"
          role="status"
        >

          <WifiOff
            className="h-3.5 w-3.5"
            aria-hidden="true"
          />

          Offline — Smart Closure submission requires
          connectivity to send the real completion evidence.

        </div>

      )}


      {/* ===================================================
          ISSUE
      =================================================== */}

      <section className="mt-5">

        <SectionHeading
          eyebrow="ISSUE"
          title="What needs fixing"
        />

        <p className="mt-2 text-sm leading-relaxed text-[#565C68]">
          {incident.description}
        </p>

      </section>


      {/* ===================================================
          WHY
      =================================================== */}

      <section className="mt-5">

        <SectionHeading
          eyebrow="WHY THIS JOB?"
          title="Operational context"
        />

        <ul className="fw-check-list mt-3">

          {priority.reasons.map(
            reason => (

              <li key={reason}>

                <Check
                  className="h-4 w-4"
                  aria-hidden="true"
                />

                {reason}

              </li>

            )
          )}

        </ul>

      </section>


      {/* ===================================================
          LOCATION
      =================================================== */}

      <section className="mt-5">

        <SectionHeading
          eyebrow="LOCATION"
          title="Incident site"
        />


        <div className="citizen-map-wrapper">

          <CivicMap
            variant="citizen"
            incidents={[incident]}
            height="100%"
            selectedIncidentId={incident.id}
            userLocation={coords}
            onIssueClick={() => undefined}
          />

        </div>


        <div className="mt-3 flex flex-col gap-2 sm:flex-row">

          <button
            className="fw-primary-button"
            onClick={navigate}
          >

            <Navigation
              className="h-4 w-4"
              aria-hidden="true"
            />

            NAVIGATE TO INCIDENT

          </button>

        </div>


        <p className="mt-2 text-xs text-[#7E8592]">
          The map shows the incident location. No external
          turn-by-turn navigation service is connected.
        </p>

      </section>


      {/* ===================================================
          OVERVIEW
      =================================================== */}

      {phase === 'overview' && (

        <section className="mt-6">

          <button
            className="fw-primary-button"
            onClick={startWork}
          >

            <HardHat
              className="h-4 w-4"
              aria-hidden="true"
            />

            START WORK

          </button>


          <p className="mt-2 text-xs text-[#7E8592]">
            Starting work moves this job to{' '}
            <strong>In Progress</strong>.
          </p>

        </section>

      )}


      {/* ===================================================
          IN PROGRESS
      =================================================== */}

      {phase === 'in_progress' && (

        <section className="mt-6">

          <SectionHeading
            eyebrow="FIELD CHECK"
            title="Confirm and capture"
          />


          <ul className="fw-check-list mt-3">

            <li>

              <Check
                className="h-4 w-4"
                aria-hidden="true"
              />

              Issue type:{' '}
              {categoryTitle(incident)}

            </li>


            <li>

              <Check
                className="h-4 w-4"
                aria-hidden="true"
              />

              Incident coordinates available

            </li>


            <li>

              <Check
                className="h-4 w-4"
                aria-hidden="true"
              />

              Current condition: needs repair

            </li>

          </ul>


          <label className="citizen-description-label">

            Field note (optional)

            <textarea
              value={note}
              onChange={e =>
                setNote(
                  e.target.value
                )
              }
              rows={3}
              placeholder="e.g. Excavated failed sub-base, re-compacted and laid hot-mix."
            />

          </label>


          {/* STATUS OVERVIEW & INDICATORS */}
          <div className="bg-white border border-[#E5E3DC] rounded-xl p-4 mt-5 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase text-[#565C68] tracking-wider">
                Work Status
              </span>
              <span
                className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                  workStatus === 'Completed'
                    ? 'bg-[#EBF7EF] text-[#1E6B42] border border-[#C8EAD4]'
                    : workStatus === 'Ready for Completion'
                    ? 'bg-[#EBF3FF] text-[#2563EB] border border-[#BFDBFE]'
                    : 'bg-[#FFFBEB] text-[#B45309] border border-[#FDE68A]'
                }`}
              >
                {workStatus}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3 mt-3 pt-3 border-t border-[#F4F3EF]">
              <div className="flex items-center justify-between text-xs">
                <span className="text-[#565C68] font-medium">Before Photo:</span>
                <span className={`font-bold ${hasBefore ? 'text-[#1E6B42]' : 'text-[#C54E38]'}`}>
                  {hasBefore ? '✓ Uploaded' : '○ Pending'}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-[#565C68] font-medium">After Photo:</span>
                <span className={`font-bold ${hasAfter ? 'text-[#1E6B42]' : 'text-[#C54E38]'}`}>
                  {hasAfter ? '✓ Uploaded' : '○ Pending'}
                </span>
              </div>
            </div>
          </div>

          {/* SECTION 1: BEFORE REPAIR */}
          <div className="mt-6 bg-white border border-[#E5E3DC] rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <SectionHeading
                eyebrow="INTAKE EVIDENCE"
                title="Before Repair"
              />
              <span className={`text-xs font-bold px-2 py-0.5 rounded ${
                hasBefore
                  ? 'bg-[#EBF7EF] text-[#1E6B42] border border-[#C8EAD4]'
                  : 'bg-[#FAF9F5] text-[#7E8592] border border-[#E5E3DC]'
              }`}>
                {hasBefore ? 'Uploaded' : 'Pending'}
              </span>
            </div>
            <p className="text-xs text-[#7E8592] mb-3">
              Capture or inspect the initial damage at the site before starting work.
            </p>

            {beforePhotoPreview ? (
              <div className="rounded-xl overflow-hidden border border-[#E5E3DC] bg-[#FAF9F5]">
                <img
                  src={beforePhotoPreview}
                  alt="Before repair damage condition"
                  className="w-full h-48 sm:h-56 object-cover"
                />
                <div className="p-3 bg-white border-t border-[#E5E3DC] flex items-center justify-between">
                  <span className="text-xs text-[#565C68] font-medium flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-[#1E6B42]" />
                    Before photo active
                  </span>
                  <label className="text-xs font-bold text-[#2C5E48] hover:underline cursor-pointer flex items-center gap-1">
                    <Camera className="w-3.5 h-3.5" />
                    Replace Photo
                    <input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      className="hidden"
                      onChange={e => {
                        const f = e.target.files?.[0];
                        if (f) handleBeforePhotoChange(f);
                      }}
                    />
                  </label>
                </div>
              </div>
            ) : (
              <label className="fw-upload-zone cursor-pointer">
                <ImageUp className="h-8 w-8 text-[#7E8592]" aria-hidden="true" />
                <b>Upload / Capture Before Photo</b>
                <span>Initial condition before commencing repair</span>
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  aria-label="Attach before-repair photo"
                  onChange={e => {
                    const f = e.target.files?.[0];
                    if (f) handleBeforePhotoChange(f);
                  }}
                />
              </label>
            )}
          </div>

          {/* SECTION 2: AFTER REPAIR */}
          <div className="mt-6 bg-white border border-[#E5E3DC] rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <SectionHeading
                eyebrow="COMPLETION EVIDENCE"
                title="After Repair"
              />
              <span className={`text-xs font-bold px-2 py-0.5 rounded ${
                hasAfter
                  ? 'bg-[#EBF7EF] text-[#1E6B42] border border-[#C8EAD4]'
                  : 'bg-[#FAF9F5] text-[#7E8592] border border-[#E5E3DC]'
              }`}>
                {hasAfter ? 'Uploaded' : 'Pending'}
              </span>
            </div>
            <p className="text-xs text-[#7E8592] mb-3">
              Capture or upload the resolved site condition after work is finished.
            </p>

            {afterPhotoPreview ? (
              <div className="rounded-xl overflow-hidden border border-[#C8EAD4] bg-[#EBF7EF]/30">
                <img
                  src={afterPhotoPreview}
                  alt="After repair completion condition"
                  className="w-full h-48 sm:h-56 object-cover"
                />
                <div className="p-3 bg-white border-t border-[#C8EAD4] flex items-center justify-between">
                  <span className="text-xs text-[#1E6B42] font-medium flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-[#1E6B42]" />
                    After photo active
                  </span>
                  <label className="text-xs font-bold text-[#2C5E48] hover:underline cursor-pointer flex items-center gap-1">
                    <Camera className="w-3.5 h-3.5" />
                    Replace Photo
                    <input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      className="hidden"
                      onChange={e => {
                        const f = e.target.files?.[0];
                        if (f) handleAfterPhotoChange(f);
                      }}
                    />
                  </label>
                </div>
              </div>
            ) : (
              <label className="fw-upload-zone cursor-pointer">
                <ImageUp className="h-8 w-8 text-[#7E8592]" aria-hidden="true" />
                <b>Upload / Capture After Photo</b>
                <span>Required for Smart Closure verification</span>
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  aria-label="Attach after-repair photo"
                  onChange={e => {
                    const f = e.target.files?.[0];
                    if (f) handleAfterPhotoChange(f);
                  }}
                />
              </label>
            )}
          </div>

          {/* METADATA VERIFICATION STATUS */}
          {(beforeExifStatus !== 'pending' || afterExifStatus !== 'pending') && (
            <div className={`mt-4 rounded-xl border p-3 ${
              metadataBlocked
                ? 'bg-red-50 border-red-300'
                : 'bg-[#EBF7EF] border-[#C8EAD4]'
            }`}>
              <div className="flex items-center gap-2 mb-2">
                {metadataBlocked ? (
                  <MapPinOff className="h-4 w-4 text-red-600" />
                ) : (
                  <MapPin className="h-4 w-4 text-[#1E6B42]" />
                )}
                <span className={`text-xs font-bold uppercase tracking-wider ${
                  metadataBlocked ? 'text-red-700' : 'text-[#1E6B42]'
                }`}>
                  {metadataBlocked
                    ? (beforeExifStatus === 'no_gps' || afterExifStatus === 'no_gps'
                        ? 'GPS Metadata Missing — Submission Disabled'
                        : 'Location Mismatch Detected — Submission Disabled')
                    : 'Metadata Verified'}
                </span>
              </div>
              <div className="space-y-1">
                {beforeExifStatus !== 'pending' && (
                  <p className="text-xs text-[#565C68]">
                    <strong>Before Photo:</strong>{' '}
                    {beforeExifStatus === 'verified'
                      ? `✓ GPS verified (${beforeExifDistance}m from incident)`
                      : beforeExifStatus === 'too_far'
                      ? `✗ Too far — ${beforeExifDistance}m from incident (max ${MAX_PHOTO_DISTANCE_METERS}m)`
                      : '✗ No GPS metadata in image (Submission disabled)'}
                  </p>
                )}
                {afterExifStatus !== 'pending' && (
                  <p className="text-xs text-[#565C68]">
                    <strong>After Photo:</strong>{' '}
                    {afterExifStatus === 'verified'
                      ? `✓ GPS verified (${afterExifDistance}m from incident)`
                      : afterExifStatus === 'too_far'
                      ? `✗ Too far — ${afterExifDistance}m from incident (max ${MAX_PHOTO_DISTANCE_METERS}m)`
                      : '✗ No GPS metadata in image (Submission disabled)'}
                  </p>
                )}
              </div>
              {metadataBlocked && (
                <p className="mt-2 text-xs font-medium text-red-700">
                  {beforeExifStatus === 'no_gps' || afterExifStatus === 'no_gps'
                    ? 'Upload photos taken with device location/GPS enabled to identify metadata and enable submission.'
                    : 'Replace the flagged photo(s) with images taken at the incident site to enable submission.'}
                </p>
              )}
            </div>
          )}

          <button
            className="fw-primary-button mt-6 w-full"
            onClick={submitCompletion}
            disabled={
              !hasBefore ||
              !hasAfter ||
              submitting ||
              isOffline ||
              metadataBlocked
            }
          >
            <Send className="h-4 w-4" aria-hidden="true" />
            {submitting
              ? 'SUBMITTING EVIDENCE…'
              : metadataBlocked
              ? (beforeExifStatus === 'no_gps' || afterExifStatus === 'no_gps'
                  ? 'SUBMISSION BLOCKED — MISSING GPS METADATA'
                  : 'SUBMISSION BLOCKED — LOCATION MISMATCH')
              : 'COMPLETE TASK'}
          </button>

          {(!hasBefore || !hasAfter) && (
            <p className="mt-2 text-center text-xs text-[#7E8592]">
              {!hasBefore && !hasAfter
                ? 'Upload both Before and After photos to enable task completion.'
                : !hasBefore
                ? 'Before photo is required to enable task completion.'
                : 'After photo is required to enable task completion.'}
            </p>
          )}

          {isOffline && (
            <p className="mt-2 text-xs text-[#C54E38] text-center">
              Reconnect before submitting Smart Closure evidence.
            </p>
          )}

        </section>

      )}


      {/* ===================================================
          REAL BACKEND ANALYSIS
      =================================================== */}

      {phase === 'analysis' && (

        <section
          className="citizen-analysis mt-6"
          role="status"
          aria-live="polite"
        >

          <Sparkles
            className="h-7 w-7"
            aria-hidden="true"
          />


          <h2>
            Verifying completion evidence…
          </h2>


          <p>
            Sending the completion photo and current field
            GPS to the SANKET Smart Closure engine.
          </p>


          <p className="citizen-analysis-note">
            The backend calculates the actual location
            distance and closure decision.
          </p>

        </section>

      )}


      {/* ===================================================
          VERIFICATION RESULT
      =================================================== */}

      {phase === 'verification' && (

        <section className="mt-6">

          <SectionHeading
            eyebrow="SMART CLOSURE"
            title="Evidence analysis"
          />


          <div className="fw-closure">

            {smartClosure ? (

              <>

                <div className="fw-closure-score">

                  <div
                    className="fw-closure-ring"
                    aria-label={`Smart Closure match score ${Math.round(
                      smartClosure.matchConfidence
                    )}%`}
                  >

                    {Math.round(
                      smartClosure.matchConfidence
                    )}%

                  </div>


                  <div>

                    <p className="text-sm font-extrabold text-[#1e6b42]">

                      {smartClosure.isLikelyMatch
                        ? 'Likely location match'
                        : 'Additional verification required'}

                    </p>


                    <p className="mt-1 text-xs text-[#565C68]">

                      Actual field distance:{' '}

                      <strong>

                        {Math.round(
                          smartClosure.distanceMeters
                        )}{' '}
                        m

                      </strong>

                    </p>

                  </div>

                </div>


                <ul className="fw-check-list mt-4">

                  <li>

                    <Check
                      className="h-4 w-4"
                      aria-hidden="true"
                    />

                    Completion photo submitted

                  </li>


                  <li>

                    <Check
                      className="h-4 w-4"
                      aria-hidden="true"
                    />

                    Field GPS captured

                  </li>


                  <li>

                    {smartClosure.isLikelyMatch ? (

                      <Check
                        className="h-4 w-4"
                        aria-hidden="true"
                      />

                    ) : (

                      <AlertTriangle
                        className="h-4 w-4"
                        aria-hidden="true"
                      />

                    )}

                    Actual incident-to-field distance:{' '}

                    {Math.round(
                      smartClosure.distanceMeters
                    )}{' '}

                    m

                  </li>

                </ul>


                <div className="fw-closure-compare">

                  <figure className="fw-closure-figure">

                    {incident.beforeImageUrl ? (

                      <img
                        src={
                          incident.beforeImageUrl
                        }
                        alt="Original reported condition"
                      />

                    ) : (

                      <div className="flex h-full min-h-[180px] items-center justify-center p-4 text-center text-xs text-[#7E8592]">
                        No original report image available
                      </div>

                    )}

                    <figcaption>
                      Before
                    </figcaption>

                  </figure>


                  <figure className="fw-closure-figure">

                    {incident.afterImageUrl ? (

                      <img
                        src={
                          incident.afterImageUrl
                        }
                        alt="Actual submitted completion evidence"
                      />

                    ) : (

                      <div className="flex h-full min-h-[180px] items-center justify-center p-4 text-center text-xs text-[#7E8592]">
                        No completion image available
                      </div>

                    )}

                    <figcaption>
                      After
                    </figcaption>

                  </figure>

                </div>


                <div className="mt-4 rounded-lg border border-[#E5E3DC] bg-[#FAF9F5] p-3">

                  <p className="text-xs leading-relaxed text-[#565C68]">

                    {smartClosure.explanation}

                  </p>

                </div>

              </>

            ) : (

              <div className="p-4 text-sm text-[#565C68]">

                Smart Closure result is not available yet.
                Refresh the incident before taking another action.

              </div>

            )}

          </div>


          <p className="mt-3 flex items-center gap-1.5 text-xs text-[#7E8592]">

            <Info
              className="h-3.5 w-3.5"
              aria-hidden="true"
            />

            Closure decisions are calculated by the
            server-side evidence engine.

          </p>

        </section>

      )}


      {/* ===================================================
          SUBMITTED
      =================================================== */}

      {phase === 'submitted' && (

        <section className="mt-6">

          <div
            className="fw-closeout"
            role="status"
          >

            {automaticallyResolved ? (

              <CheckCircle2
                className="h-9 w-9"
                aria-hidden="true"
              />

            ) : (

              <Clock
                className="h-9 w-9"
                aria-hidden="true"
              />

            )}


            <p className="fw-eyebrow">

              {automaticallyResolved
                ? 'SMART CLOSURE VERIFIED'
                : 'COMPLETION SUBMITTED'}

            </p>


            <h2 className="text-lg font-extrabold">

              {automaticallyResolved
                ? 'Incident automatically resolved'
                : 'Awaiting municipal verification'}

            </h2>


            <div className="fw-verify-steps">

              <span className="is-done">

                <Check
                  className="h-4 w-4"
                  aria-hidden="true"
                />

                Work completed

              </span>


              <span className="is-done">

                <Check
                  className="h-4 w-4"
                  aria-hidden="true"
                />

                Evidence submitted

              </span>


              {automaticallyResolved ? (

                <span className="is-done">

                  <CheckCircle2
                    className="h-4 w-4"
                    aria-hidden="true"
                  />

                  Smart Closure verified

                </span>

              ) : (

                <span className="is-active">

                  <Clock
                    className="h-4 w-4"
                    aria-hidden="true"
                  />

                  Awaiting municipal verification

                </span>

              )}

            </div>


            <p className="mt-3 text-xs text-[#565C68]">

              {smartClosure?.explanation ||
                statusInfo?.explanation ||
                'Completion evidence has been submitted to SANKET.'}

            </p>


            {smartClosure && (

              <p className="mt-2 text-xs font-medium text-[#565C68]">

                Verified field distance:{' '}

                <strong>

                  {Math.round(
                    smartClosure.distanceMeters
                  )}{' '}
                  m

                </strong>

              </p>

            )}

          </div>


          <div className="mt-4 flex flex-col gap-2 sm:flex-row">

            <button
              className="fw-secondary-button"
              onClick={() =>
                navigateTo(
                  '/field/history'
                )
              }
            >

              <ClipboardCheck
                className="h-4 w-4"
                aria-hidden="true"
              />

              View job history

            </button>


            <button
              className="fw-secondary-button"
              onClick={() =>
                navigateTo(
                  '/field/jobs'
                )
              }
            >

              <Camera
                className="h-4 w-4"
                aria-hidden="true"
              />

              Back to work queue

            </button>

          </div>

        </section>

      )}


      {/* ===================================================
          FOOTER
      =================================================== */}

      <p className="citizen-confirm-fineprint mt-6">

        <ShieldCheck
          className="h-3.5 w-3.5"
          aria-hidden="true"
        />

        Reports shown to field workers never include a
        citizen's private contact details or exact personal
        location.

      </p>

    </div>
  );
};