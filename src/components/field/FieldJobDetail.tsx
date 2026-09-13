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
} from 'lucide-react';

import { CivicMap } from '../common/CivicMap';
import { useCivic } from '../../context/CivicContext';
import { useCitizenLocation } from '../citizen/useCitizenLocation';

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
     COMPLETION EVIDENCE
  ======================================================= */

  const [afterPhotoFile, setAfterPhotoFile] =
    useState<File | null>(null);

  const [afterPhotoPreview, setAfterPhotoPreview] =
    useState<string | null>(null);

  const [note, setNote] =
    useState('');

  const [submitting, setSubmitting] =
    useState(false);

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

      if (afterPhotoPreview) {

        URL.revokeObjectURL(
          afterPhotoPreview
        );

      }

    };

  }, [afterPhotoPreview]);


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


  const submitCompletion =
    async () => {

      if (!afterPhotoFile) {

        showToast(
          'Photo required',
          'Take a completion photo before submitting the job.',
          'warning'
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
      setPhase(
        'analysis'
      );


      try {

        const location =
          await getFreshLocation();


        /*
         * Real completion photo + real device GPS
         * are sent to the backend.
         */
        await submitClosureEvidence(
          incident.id,
          afterPhotoFile,
          location.latitude,
          location.longitude,
          location.accuracyMeters
        );


        /*
         * CivicContext refreshes the incident list after
         * the backend response.
         *
         * The refreshed incident therefore contains only
         * backend-persisted closure information.
         */
        setPhase(
          'submitted'
        );

      } catch (error) {

        console.error(
          'Smart Closure submission failed:',
          error
        );


        setPhase(
          'in_progress'
        );


        showToast(
          'Closure submission failed',
          error instanceof Error
            ? error.message
            : 'Unable to submit completion evidence.',
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


          {/* COMPLETION PHOTO */}

          <div className="mt-5">

            <SectionHeading
              eyebrow="COMPLETION EVIDENCE"
              title="After-repair photo"
            />

          </div>


          <label className="fw-upload-zone">

            {afterPhotoPreview ? (

              <img
                src={afterPhotoPreview}
                alt="After-repair completion evidence"
              />

            ) : (

              <>

                <ImageUp
                  className="h-8 w-8"
                  aria-hidden="true"
                />

                <b>
                  Take completion photo
                </b>

                <span>
                  Required for Smart Closure verification
                </span>

              </>

            )}


            <input
              type="file"
              accept="image/*"
              capture="environment"
              aria-label="Attach after-repair photo"
              onChange={e => {

                const file =
                  e.target.files?.[0];


                if (!file) {
                  return;
                }


                if (
                  !file.type.startsWith(
                    'image/'
                  )
                ) {

                  showToast(
                    'Invalid evidence',
                    'Please select an image for the completion photo.',
                    'warning'
                  );

                  return;
                }


                if (
                  afterPhotoPreview
                ) {

                  URL.revokeObjectURL(
                    afterPhotoPreview
                  );

                }


                setAfterPhotoFile(
                  file
                );


                setAfterPhotoPreview(
                  URL.createObjectURL(
                    file
                  )
                );

              }}
            />

          </label>


          <button
            className="fw-primary-button mt-4"
            onClick={
              submitCompletion
            }
            disabled={
              !afterPhotoFile ||
              submitting ||
              isOffline
            }
          >

            <Send
              className="h-4 w-4"
              aria-hidden="true"
            />


            {submitting
              ? 'SUBMITTING EVIDENCE…'
              : 'SUBMIT COMPLETION'}

          </button>


          {!afterPhotoFile && (

            <p className="mt-2 text-xs text-[#7E8592]">
              Add an after-repair photo to continue.
            </p>

          )}


          {isOffline && (

            <p className="mt-2 text-xs text-[#C54E38]">
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