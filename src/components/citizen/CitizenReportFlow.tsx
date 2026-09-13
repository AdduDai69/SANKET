/**
 * CivicLens — Citizen Reporting Flow
 *
 * REAL AI VERSION
 *
 * STEP 1 — Capture evidence
 * STEP 2 — Real multimodal image analysis through FastAPI
 * STEP 3 — Citizen confirms detected issue / location / description
 * DONE   — Confirmation
 *
 * Flow:
 *
 * Citizen
 *   ↓
 * React
 *   ↓
 * FastAPI /analyze-image
 *   ↓
 * OpenRouter free vision model
 *   ↓
 * AI result stored in React state
 *   ↓
 * Citizen confirmation
 *   ↓
 * FastAPI /reports
 *   ↓
 * Existing AI result + Supabase
 *
 * IMPORTANT:
 * The image is analyzed ONLY ONCE.
 * /reports receives the already-generated AI analysis.
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
  ChevronRight,
  ImageUp,
  Info,
  Loader2,
  MapPin,
  Mic,
  Pencil,
  Send,
  ShieldCheck,
  Upload,
} from 'lucide-react';

import type { IssueCategory } from '../../types/civic';

import { useCivic } from '../../context/CivicContext';

import {
  categoryLabel,
  REPORT_CATEGORIES,
  REPORT_SECTORS,
} from './citizenData';

import { SectionHeading } from './CitizenPrimitives';


/* =========================================================
   TYPES
   ========================================================= */

type Step =
  | 'capture'
  | 'analysis'
  | 'confirm'
  | 'done';


type VisionAnalysis = {
  issue_type: string;
  confidence: number;
  severity: string;
  description: string;
  recommended_department: string;
  visible_evidence: string[];

  /*
   * These fields are returned by the new
   * OpenRouter backend.
   *
   * They are optional so the frontend remains
   * compatible if the backend does not return them.
   */
  ai_provider?: string;
  model_used?: string;
  model_router?: string;
};

type GPSLocation = {
  latitude: number;
  longitude: number;
  accuracy: number;
};


/* =========================================================
   STEP NUMBERS
   ========================================================= */

const STEP_NUMBER: Record<
  Exclude<Step, 'done'>,
  number
> = {
  capture: 1,
  analysis: 2,
  confirm: 3,
};


/* =========================================================
   BACKEND
   ========================================================= */

const API_URL =
  import.meta.env.VITE_API_URL ||
  'http://127.0.0.1:8000';


/* =========================================================
   COMPONENT
   ========================================================= */

export const CitizenReportFlow: React.FC<{
  onComplete: () => void;
  onCancel: () => void;
}> = ({
  onComplete,
  onCancel,
}) => {

  /*
   * CivicContext is currently used for:
   *
   * - toast notifications
   * - existing offline compatibility
   *
   * Online submission itself is handled directly
   * through the FastAPI endpoints.
   */
  const {
    showToast,
  } = useCivic();


  /* =======================================================
     STATE
     ======================================================= */

  const [step, setStep] =
    useState<Step>('capture');


  /*
   * Browser preview URL.
   */
  const [photo, setPhoto] =
    useState<string | null>(null);


  /*
   * Actual File object.
   *
   * This is the image sent to FastAPI.
   */
  const [photoFile, setPhotoFile] =
    useState<File | null>(null);


  /*
   * Citizen's description.
   */
  const [description, setDescription] =
    useState('');


  /*
   * Selected Chandigarh sector.
   */
  const [sector, setSector] =
    useState<string>(
      REPORT_SECTORS[0]
    );

  /*
   * Browser GPS location.
   * Coordinates come from the device/browser, never from AI.
   */
  const [gpsLocation, setGpsLocation] =
    useState<GPSLocation | null>(null);

  const [isLocating, setIsLocating] =
    useState(false);

  const [locationError, setLocationError] =
    useState<string | null>(null);


  /*
   * Category detected by AI.
   *
   * The citizen can change it during confirmation.
   */
  const [detectedCategory, setDetectedCategory] =
    useState<IssueCategory>(
      'pothole'
    );


  /*
   * IMPORTANT:
   *
   * This stores the result of the ONE and ONLY
   * image-analysis request.
   *
   * The exact same object is sent to /reports.
   */
  const [aiAnalysis, setAiAnalysis] =
    useState<VisionAnalysis | null>(
      null
    );


  /*
   * Error produced during AI analysis.
   */
  const [analysisError, setAnalysisError] =
    useState<string | null>(null);


  /*
   * Error produced during final submission.
   */
  const [submitError, setSubmitError] =
    useState<string | null>(null);


  /*
   * Prevent duplicate submissions.
   */
  const [isSubmitting, setIsSubmitting] =
    useState(false);


  /*
   * Prevent duplicate AI requests.
   */
  const [isAnalyzing, setIsAnalyzing] =
    useState(false);


  const headingRef =
    useRef<HTMLDivElement>(null);


  /* =======================================================
     BROWSER GPS LOCATION
     ======================================================= */

  /*
   * Capture the device/browser location.
   * This is independent of AI image analysis.
   */
  const detectLocation = () => {

    if (!('geolocation' in navigator)) {
      setLocationError(
        'Location services are not supported by this browser.'
      );
      return;
    }

    setIsLocating(true);
    setLocationError(null);

    navigator.geolocation.getCurrentPosition(
      (position) => {

        const { latitude, longitude, accuracy } =
          position.coords;

        setGpsLocation({
          latitude,
          longitude,
          accuracy,
        });

        setIsLocating(false);

        showToast(
          'Location captured',
          `GPS accuracy: ${Math.round(accuracy)} m.`,
          'success'
        );
      },
      (error) => {

        setIsLocating(false);

        let message =
          'Unable to determine your location.';

        if (error.code === 1) {
          message =
            'Location permission was denied. Allow location access and try again.';
        } else if (error.code === 2) {
          message =
            'Your location is currently unavailable. Try again outdoors or with location services enabled.';
        } else if (error.code === 3) {
          message =
            'Location detection timed out. Please try again.';
        }

        setLocationError(message);

        showToast(
          'Location unavailable',
          message,
          'info'
        );
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 30000,
      }
    );
  };

  /*
   * Try to capture GPS when the reporting flow opens.
   * The user can retry with the button if permission/location
   * is unavailable.
   */
  useEffect(() => {
    detectLocation();
  }, []);


  /* =======================================================
     FILE → DATA URL
     ======================================================= */

  /*
   * Kept for compatibility with the existing project.
   *
   * The actual online submission uses the File object
   * directly.
   */
  const fileToDataUrl = (
    file: File
  ): Promise<string> => {

    return new Promise(
      (resolve, reject) => {

        const reader =
          new FileReader();


        reader.onload = () => {

          if (
            typeof reader.result ===
            'string'
          ) {

            resolve(
              reader.result
            );

          } else {

            reject(
              new Error(
                'Could not read image.'
              )
            );
          }
        };


        reader.onerror = () => {

          reject(
            new Error(
              'Could not read image.'
            )
          );

        };


        reader.readAsDataURL(file);
      }
    );
  };


  /* =======================================================
     OPENROUTER IMAGE ANALYSIS
     ======================================================= */

  /*
   * Sends the actual image File to:
   *
   * POST /analyze-image
   *
   * FastAPI sends the image to the configured
   * OpenRouter multimodal vision model.
   *
   * IMPORTANT:
   * This function is called ONLY from startAnalysis().
   */
  const analyzeImage = async (
    file: File
  ): Promise<VisionAnalysis> => {

    const formData =
      new FormData();


    formData.append(
      'file',
      file
    );


    const response =
      await fetch(
        `${API_URL}/analyze-image`,
        {
          method: 'POST',
          body: formData,
        }
      );


    /*
     * Try to read backend response.
     */
    const data =
      await response
        .json()
        .catch(
          () => null
        );


    /*
     * Handle backend errors.
     */
    if (!response.ok) {

      const message =
        data?.detail ||
        `Image analysis failed (${response.status}).`;


      throw new Error(
        message
      );
    }


    /*
     * Basic validation.
     */
    if (
      !data ||
      typeof data !== 'object'
    ) {

      throw new Error(
        'The AI returned an invalid response.'
      );
    }


    /*
     * Validate the important AI fields.
     */
    if (
      typeof data.issue_type !== 'string' ||
      typeof data.confidence !== 'number' ||
      typeof data.severity !== 'string' ||
      typeof data.description !== 'string' ||
      typeof data.recommended_department !== 'string'
    ) {

      throw new Error(
        'The AI response is missing required analysis fields.'
      );
    }


    /*
     * Normalize visible_evidence.
     *
     * This protects the UI if the backend returns
     * an unexpected value.
     */
    const visibleEvidence =
      Array.isArray(data.visible_evidence)
        ? data.visible_evidence
            .filter(
              (item: unknown) =>
                typeof item === 'string'
            )
        : [];


    /*
     * Return the already-generated analysis.
     *
     * It will later be sent to /reports.
     */
    return {
      issue_type:
        data.issue_type,

      confidence:
        Number(data.confidence),

      severity:
        data.severity,

      description:
        data.description,

      recommended_department:
        data.recommended_department,

      visible_evidence:
        visibleEvidence,

      ai_provider:
        typeof data.ai_provider === 'string'
          ? data.ai_provider
          : undefined,

      model_used:
        typeof data.model_used === 'string'
          ? data.model_used
          : undefined,

      model_router:
        typeof data.model_router === 'string'
          ? data.model_router
          : undefined,
    };
  };


  /* =======================================================
     MAP AI ISSUE TYPE → CIVIC CATEGORY
     ======================================================= */

  const mapIssueTypeToCategory = (
    issueType: string
  ): IssueCategory => {

    const normalized =
      String(issueType || '')
        .toLowerCase()
        .trim();


    const validCategories =
      REPORT_CATEGORIES as string[];


    /*
     * Direct match.
     */
    if (
      validCategories.includes(
        normalized
      )
    ) {

      return normalized as IssueCategory;
    }


    /*
     * Common AI variations.
     */

    if (
      normalized === 'road_damage'
    ) {

      if (
        validCategories.includes(
          'road_damage'
        )
      ) {

        return 'road_damage' as IssueCategory;
      }
    }


    if (
      normalized === 'pothole'
    ) {

      if (
        validCategories.includes(
          'pothole'
        )
      ) {

        return 'pothole' as IssueCategory;
      }
    }


    if (
      normalized === 'drainage'
    ) {

      if (
        validCategories.includes(
          'drainage'
        )
      ) {

        return 'drainage' as IssueCategory;
      }
    }


    if (
      normalized === 'streetlight'
    ) {

      if (
        validCategories.includes(
          'streetlight'
        )
      ) {

        return 'streetlight' as IssueCategory;
      }
    }


    if (
      normalized === 'waste'
    ) {

      if (
        validCategories.includes(
          'waste'
        )
      ) {

        return 'waste' as IssueCategory;
      }
    }


    /*
     * Safe fallback.
     */
    if (
      validCategories.includes(
        'other'
      )
    ) {

      return 'other' as IssueCategory;
    }


    return REPORT_CATEGORIES[0] as IssueCategory;
  };


  /* =======================================================
     HANDLE IMAGE
     ======================================================= */

  const handleImageSelected = (
    file: File
  ) => {

    /*
     * Basic validation.
     */
    if (
      !file.type.startsWith(
        'image/'
      )
    ) {

      showToast(
        'Invalid file',
        'Please select an image file.',
        'urgent'
      );

      return;
    }


    /*
     * 10 MB maximum.
     */
    const MAX_SIZE =
      10 * 1024 * 1024;


    if (
      file.size > MAX_SIZE
    ) {

      showToast(
        'Image too large',
        'Please choose an image smaller than 10 MB.',
        'urgent'
      );

      return;
    }


    /*
     * Store actual File.
     */
    setPhotoFile(file);


    /*
     * Reset previous AI result.
     *
     * A new image must always receive a new analysis.
     */
    setAnalysisError(null);

    setSubmitError(null);

    setAiAnalysis(null);


    /*
     * Create browser preview.
     */
    try {

      const previewUrl =
        URL.createObjectURL(
          file
        );

      setPhoto(
        previewUrl
      );

    } catch {

      setPhoto(null);
    }
  };


  /* =======================================================
     START AI ANALYSIS
     ======================================================= */

  const startAnalysis =
    async () => {

      if (!photoFile) {

        showToast(
          'Add a photo first',
          'Take a photo or upload an image of the civic issue.',
          'info'
        );

        return;
      }


      if (
        !description.trim()
      ) {

        showToast(
          'Add a short description',
          'A sentence or two helps the municipal team understand the problem.',
          'info'
        );

        return;
      }


      /*
       * Prevent another analysis request if one
       * is already running.
       */
      if (isAnalyzing) {
        return;
      }


      /*
       * Reset errors.
       */
      setSubmitError(null);

      setAnalysisError(null);

      setAiAnalysis(null);


      setIsAnalyzing(true);

      setStep('analysis');


      try {

        console.log(
          'Starting CivicLens AI analysis...'
        );


        /*
         * ONE AI CALL.
         */
        const result =
          await analyzeImage(
            photoFile
          );


        console.log(
          'AI analysis result:',
          result
        );


        /*
         * Store the result.
         *
         * This object will be reused during
         * final submission.
         */
        setAiAnalysis(
          result
        );


        /*
         * Convert AI issue type into the
         * frontend civic category.
         */
        const mappedCategory =
          mapIssueTypeToCategory(
            result.issue_type
          );


        setDetectedCategory(
          mappedCategory
        );


        /*
         * Move to confirmation.
         */
        setStep(
          'confirm'
        );

      } catch (
        error
      ) {

        console.error(
          'Vision analysis failed:',
          error
        );


        const message =
          error instanceof Error
            ? error.message
            : 'Unable to analyze the image.';


        setAnalysisError(
          message
        );

      } finally {

        setIsAnalyzing(
          false
        );
      }
    };


  /* =======================================================
     FINAL REPORT SUBMISSION
     ======================================================= */

  /*
   * IMPORTANT:
   *
   * This function DOES NOT analyze the image.
   *
   * The image has already been analyzed by
   * /analyze-image.
   *
   * We send the saved `aiAnalysis` object to
   * /reports.
   *
   * Therefore:
   *
   *     Analyze button = 1 AI request
   *     Confirm button = 0 AI requests
   *
   * This prevents unnecessary OpenRouter usage
   * and prevents the second invalid-JSON failure.
   */
  const submit =
    async () => {

      /*
       * Don't submit without an image.
       */
      if (!photoFile) {

        setSubmitError(
          'No photo is attached to this report.'
        );

        return;
      }


      /*
       * AI analysis is mandatory.
       *
       * The citizen should never be able to reach
       * the final backend without an analysis result.
       */
      if (!aiAnalysis) {

        setSubmitError(
          'AI analysis is missing. Please analyze the photo again.'
        );

        return;
      }


      /*
       * Don't submit twice.
       */
      if (isSubmitting) {
        return;
      }


      setSubmitError(null);

      setIsSubmitting(true);


      try {

        console.log(
          'Submitting CivicLens report using existing AI analysis...'
        );


        /*
         * Create multipart form data.
         */
        const formData =
          new FormData();


        /*
         * Actual image file.
         */
        formData.append(
          'file',
          photoFile
        );


        /*
         * Citizen description.
         */
        formData.append(
          'description',
          description.trim()
        );


        /*
         * Selected sector.
         */
        formData.append(
          'sector',
          sector
        );

        /*
         * Device GPS coordinates.
         * These are captured by the browser, not generated by AI.
         * If GPS is unavailable, the backend accepts null values.
         */
        if (gpsLocation) {
          formData.append(
            'latitude',
            String(gpsLocation.latitude)
          );

          formData.append(
            'longitude',
            String(gpsLocation.longitude)
          );
        }


        /*
         * Authentication is not wired into
         * this prototype yet.
         */
        formData.append(
          'citizen_id',
          ''
        );


        /*
         * ==================================================
         * CRITICAL FIX
         * ==================================================
         *
         * Send the result that was already generated
         * by /analyze-image.
         *
         * /reports MUST NOT call the vision model again.
         */
        formData.append(
          'ai_analysis',
          JSON.stringify({
            ...aiAnalysis,

            /*
             * If the citizen changed the detected category
             * during confirmation, preserve that confirmed
             * category for the backend.
             *
             * The original AI issue_type is still retained
             * in `issue_type`.
             */
            confirmed_category:
              detectedCategory,
          })
        );


        /*
         * Send report to FastAPI.
         *
         * Do NOT manually set Content-Type.
         *
         * The browser automatically creates:
         *
         * multipart/form-data;
         * boundary=...
         */
        const response =
          await fetch(
            `${API_URL}/reports`,
            {
              method: 'POST',
              body: formData,
            }
          );


        /*
         * Backend returns JSON.
         */
        const data =
          await response
            .json()
            .catch(
              () => null
            );


        console.log(
          'Report submission response:',
          data
        );


        /*
         * Handle backend errors.
         */
        if (
          !response.ok
        ) {

          const message =
            data?.detail ||
            `Report submission failed (${response.status}).`;


          throw new Error(
            message
          );
        }


        /*
         * Successful submission.
         */
        console.log(
          'Report submitted successfully.',
          {
            incidentId:
              data?.incident_id,

            report:
              data?.report,

            incident:
              data?.incident,
          }
        );


        /*
         * Tell the user.
         */
        showToast(
          'Report submitted',
          'Your civic issue has been received by the municipal system.',
          'success'
        );


        /*
         * Show completion screen.
         */
        setStep(
          'done'
        );

      } catch (
        error
      ) {

        console.error(
          'Report submission failed:',
          error
        );


        const message =
          error instanceof Error
            ? error.message
            : 'Your report could not be submitted.';


        setSubmitError(
          message
        );

      } finally {

        setIsSubmitting(
          false
        );
      }
    };


  /* =======================================================
     ACCESSIBILITY
     ======================================================= */

  useEffect(() => {

    if (
      step !== 'done'
    ) {

      headingRef.current?.focus();
    }

  }, [step]);


  /* =======================================================
     CLEANUP PHOTO PREVIEW
     ======================================================= */

  useEffect(() => {

    return () => {

      if (photo) {

        URL.revokeObjectURL(
          photo
        );
      }

    };

  }, [photo]);


  /* =======================================================
     DONE SCREEN
     ======================================================= */

  if (
    step === 'done'
  ) {

    return (
      <div className="citizen-page">

        <div
          className="citizen-complete"
          role="status"
        >

          <CheckCircle2
            className="h-11 w-11"
            aria-hidden="true"
          />


          <p className="citizen-eyebrow">
            REPORT RECEIVED
          </p>


          <h1>
            Thank you for speaking up.
          </h1>


          <p>
            Your report has been received.
            CivicLens will share updates here
            as the issue moves forward —
            you'll also get a notification
            when its status changes.
          </p>


          <button
            className="citizen-primary-button"
            onClick={
              onComplete
            }
          >
            View my reports
          </button>


          <button
            className="citizen-secondary-button"
            onClick={
              onCancel
            }
          >
            Back to home
          </button>

        </div>

      </div>
    );
  }


  /* =======================================================
     MAIN UI
     ======================================================= */

  return (
    <div className="citizen-page citizen-report-page">

      {/* BACK */}

      <button
        className="citizen-back"
        onClick={
          onCancel
        }
      >
        ← Back
      </button>


      {/* HEADING */}

      <div
        ref={headingRef}
        tabIndex={-1}
      >

        <SectionHeading
          eyebrow={
            `REPORT AN ISSUE · STEP ${
              STEP_NUMBER[
                step as Exclude<
                  Step,
                  'done'
                >
              ]
            } OF 3`
          }

          title={
            step === 'capture'
              ? 'Capture what needs attention'
              : step === 'analysis'
                ? 'Analyzing your photo…'
                : 'Review your report'
          }
        />

      </div>


      {/* ===================================================
         STEP 1 — CAPTURE
         =================================================== */}

      {step === 'capture' && (
        <>

          <p className="citizen-hint">
            Add a photo or describe the problem.
            CivicLens will analyze the photo
            before you confirm the report.
          </p>


          {/* PHOTO UPLOAD */}

          <label className="citizen-upload-zone">

            {photo ? (

              <img
                src={photo}
                alt="Photo you attached as report evidence"
              />

            ) : (

              <>

                <ImageUp
                  className="h-8 w-8"
                  aria-hidden="true"
                />

                <b>
                  Add a photo
                </b>

                <span>
                  Take a photo or upload one
                  from your device
                </span>

              </>

            )}


            <input
              type="file"
              accept="image/*"
              capture="environment"
              aria-label="Attach a photo of the issue"
              onChange={(e) => {

                const file =
                  e.target.files?.[0];

                if (file) {

                  handleImageSelected(
                    file
                  );
                }

              }}
            />

          </label>


          {/* CAPTURE OPTIONS */}

          <div className="citizen-capture-options">

            <button
              type="button"
              onClick={() =>
                document
                  .getElementById(
                    'citizen-photo-input'
                  )
                  ?.click()
              }
            >

              <Camera
                className="h-4 w-4"
                aria-hidden="true"
              />

              Take photo

            </button>


            <button
              type="button"
              onClick={() =>
                document
                  .getElementById(
                    'citizen-photo-input'
                  )
                  ?.click()
              }
            >

              <Upload
                className="h-4 w-4"
                aria-hidden="true"
              />

              Upload photo

            </button>


            <button
              type="button"
              disabled
              title="Voice description is not available yet"
              onClick={() => {

                showToast(
                  'Coming soon',
                  'Voice description is not available yet.',
                  'info'
                );

              }}
            >

              <Mic
                className="h-4 w-4"
                aria-hidden="true"
              />

              Describe by voice

            </button>

          </div>


          {/* HIDDEN PHOTO INPUT */}

          <input
            id="citizen-photo-input"
            type="file"
            accept="image/*"
            className="citizen-sr-only"
            tabIndex={-1}
            aria-hidden="true"
            onChange={(e) => {

              const file =
                e.target.files?.[0];

              if (file) {

                handleImageSelected(
                  file
                );
              }

            }}
          />


          {/* DESCRIPTION */}

          <label className="citizen-description-label">

            Describe the issue


            <textarea
              value={
                description
              }
              onChange={(e) =>
                setDescription(
                  e.target.value
                )
              }
              rows={4}
              placeholder="e.g. Large pothole near the bus stop; two-wheelers are swerving around it."
            />

          </label>


          {/* LOCATION */}

          <div className="citizen-location-row">

            <span>

              <MapPin
                className="h-4 w-4"
                aria-hidden="true"
              />

              Where is it?

            </span>


            <select
              value={sector}
              onChange={(e) =>
                setSector(
                  e.target.value
                )
              }
              aria-label="Choose the area"
            >

              {REPORT_SECTORS.map(
                (s) => (

                  <option
                    key={s}
                    value={s}
                  >
                    {s}
                  </option>

                )
              )}

            </select>


            <button
              type="button"
              className="citizen-location-button"
              onClick={detectLocation}
              disabled={isLocating}
            >

              {isLocating ? (
                <Loader2
                  className="h-3.5 w-3.5 animate-spin"
                  aria-hidden="true"
                />
              ) : (
                <MapPin
                  className="h-3.5 w-3.5"
                  aria-hidden="true"
                />
              )}

              {isLocating
                ? 'Detecting…'
                : gpsLocation
                  ? 'Detect again'
                  : 'Detect automatically'}

            </button>

          </div>


          {/* GPS STATUS */}

          <div
            className="citizen-location-status"
            role="status"
            aria-live="polite"
          >

            {gpsLocation ? (
              <>
                <CheckCircle2
                  className="h-4 w-4"
                  aria-hidden="true"
                />

                <span>
                  GPS location captured · accuracy ±{Math.round(gpsLocation.accuracy)} m
                </span>
              </>
            ) : locationError ? (
              <>
                <Info
                  className="h-4 w-4"
                  aria-hidden="true"
                />

                <span>{locationError}</span>
              </>
            ) : (
              <>
                <MapPin
                  className="h-4 w-4"
                  aria-hidden="true"
                />

                <span>Detecting device location…</span>
              </>
            )}

          </div>


          {/* ANALYZE */}

          <button
            className="citizen-primary-button mt-5"
            onClick={
              startAnalysis
            }
            disabled={
              isAnalyzing
            }
          >

            {isAnalyzing
              ? 'Analyzing…'
              : 'Analyze with CivicLens AI'
            }


            {isAnalyzing ? (

              <Loader2
                className="h-4 w-4 animate-spin"
                aria-hidden="true"
              />

            ) : (

              <ChevronRight
                className="h-4 w-4"
                aria-hidden="true"
              />

            )}

          </button>

        </>
      )}


      {/* ===================================================
         STEP 2 — ANALYSIS
         =================================================== */}

      {step === 'analysis' && (
        <>

          <div
            className="citizen-analysis"
            role="status"
            aria-live="polite"
          >

            <Loader2
              className="h-7 w-7 animate-spin"
              aria-hidden="true"
            />


            <h2>
              Analyzing your photo…
            </h2>


            <p>
              CivicLens is using multimodal AI
              to understand the issue visible
              in your image.
            </p>


            <div className="citizen-analysis-checks">

              <span>

                <Check
                  className="h-4 w-4"
                  aria-hidden="true"
                />

                Analyzing image

              </span>


              <span>

                <Check
                  className="h-4 w-4"
                  aria-hidden="true"
                />

                Identifying issue type

              </span>


              <span>

                <Check
                  className="h-4 w-4"
                  aria-hidden="true"
                />

                Assessing severity

              </span>

            </div>


            <p className="citizen-analysis-note">
              AI-assisted analysis. Please review
              the result before submitting your report.
            </p>

          </div>


          {/* AI ERROR */}

          {analysisError && (

            <div
              className="citizen-error"
              role="alert"
            >

              <b>
                AI analysis failed.
              </b>


              <p>
                {analysisError}
              </p>


              <button
                className="citizen-secondary-button"
                onClick={() =>
                  setStep(
                    'capture'
                  )
                }
              >
                Go back and try again
              </button>

            </div>

          )}

        </>
      )}


      {/* ===================================================
         STEP 3 — CONFIRM
         =================================================== */}

      {step === 'confirm' && (
        <>

          <p className="citizen-hint">
            CivicLens analyzed your photo.
            Review the result and make any
            changes before submitting.
          </p>


          <div className="citizen-confirm-card">

            <div className="citizen-confirm-head">

              <b>
                AI detected details
              </b>

              <span>
                AI ANALYSIS
              </span>

            </div>


            <dl>

              {/* PHOTO */}

              {photo && (

                <div>

                  <dt>
                    Your photo
                  </dt>


                  <dd>

                    <img
                      className="citizen-confirm-photo"
                      src={photo}
                      alt="Attached report evidence"
                    />

                  </dd>

                </div>

              )}


              {/* ISSUE */}

              <div>

                <dt>
                  Issue
                </dt>


                <dd>

                  <label
                    className="citizen-sr-only"
                    htmlFor="citizen-confirm-category"
                  >
                    Issue type
                  </label>


                  <select
                    id="citizen-confirm-category"
                    value={
                      detectedCategory
                    }
                    onChange={(e) =>
                      setDetectedCategory(
                        e.target.value as IssueCategory
                      )
                    }
                  >

                    {REPORT_CATEGORIES.map(
                      (c) => (

                        <option
                          key={c}
                          value={c}
                        >
                          {categoryLabel(c)}
                        </option>

                      )
                    )}

                  </select>

                </dd>

              </div>


              {/* AI CONFIDENCE */}

              {aiAnalysis && (

                <div>

                  <dt>
                    AI confidence
                  </dt>


                  <dd>

                    {Math.round(
                      Number(
                        aiAnalysis.confidence
                      ) * 100
                    )}

                    %

                  </dd>

                </div>

              )}


              {/* AI PROVIDER */}

              {aiAnalysis?.ai_provider && (

                <div>

                  <dt>
                    AI provider
                  </dt>


                  <dd>
                    {aiAnalysis.ai_provider}
                  </dd>

                </div>

              )}


              {/* MODEL */}

              {aiAnalysis?.model_used && (

                <div>

                  <dt>
                    Model
                  </dt>


                  <dd>
                    {aiAnalysis.model_used}
                  </dd>

                </div>

              )}


              {/* SEVERITY */}

              {aiAnalysis && (

                <div>

                  <dt>
                    Severity
                  </dt>


                  <dd>
                    {aiAnalysis.severity}
                  </dd>

                </div>

              )}


              {/* LOCATION */}

              <div>

                <dt>
                  Location
                </dt>


                <dd>

                  <MapPin
                    className="h-4 w-4"
                    aria-hidden="true"
                  />

                  <span>
                    {sector}, Chandigarh
                  </span>

                </dd>

              </div>


              {/* GPS COORDINATES */}

              <div>

                <dt>
                  GPS coordinates
                </dt>


                <dd>

                  {gpsLocation ? (
                    <>
                      <span>
                        {gpsLocation.latitude.toFixed(6)}, {gpsLocation.longitude.toFixed(6)}
                      </span>

                      <span>
                        · ±{Math.round(gpsLocation.accuracy)} m accuracy
                      </span>
                    </>
                  ) : (
                    'GPS location unavailable — location-based fusion will be limited.'
                  )}

                </dd>

              </div>


              {/* CITIZEN DESCRIPTION */}

              <div>

                <dt>
                  Your description
                </dt>


                <dd>
                  {description.trim()}
                </dd>

              </div>


              {/* AI DESCRIPTION */}

              {aiAnalysis && (

                <div>

                  <dt>
                    AI-generated assessment
                  </dt>


                  <dd>
                    {aiAnalysis.description}
                  </dd>

                </div>

              )}


              {/* DEPARTMENT */}

              {aiAnalysis && (

                <div>

                  <dt>
                    Recommended department
                  </dt>


                  <dd>
                    {
                      aiAnalysis
                        .recommended_department
                    }
                  </dd>

                </div>

              )}

            </dl>


            {/* VISIBLE EVIDENCE */}

            {aiAnalysis?.visible_evidence?.length ? (

              <div className="citizen-ai-evidence">

                <b>
                  Visible evidence
                </b>


                <ul>

                  {aiAnalysis.visible_evidence.map(
                    (
                      evidence,
                      index
                    ) => (

                      <li
                        key={index}
                      >
                        {evidence}
                      </li>

                    )
                  )}

                </ul>

              </div>

            ) : null}


            {/* SUBMISSION ERROR */}

            {submitError && (

              <div
                className="citizen-error"
                role="alert"
              >

                <b>
                  Something went wrong.
                </b>


                <p>
                  {submitError}
                </p>

              </div>

            )}


            {/* ACTIONS */}

            <div className="citizen-confirm-actions">

              <button
                className="citizen-secondary-button"
                onClick={() => {

                  if (!isSubmitting) {

                    setSubmitError(null);

                    setStep(
                      'capture'
                    );

                  }

                }}
                disabled={
                  isSubmitting
                }
                aria-label="Edit your report details"
              >

                <Pencil
                  className="h-4 w-4"
                  aria-hidden="true"
                />

                Edit

              </button>


              <button
                className="citizen-primary-button"
                onClick={
                  submit
                }
                disabled={
                  isSubmitting ||
                  !aiAnalysis
                }
              >

                {isSubmitting ? (

                  <>

                    <Loader2
                      className="h-4 w-4 animate-spin"
                      aria-hidden="true"
                    />

                    Submitting…

                  </>

                ) : (

                  <>

                    <Send
                      className="h-4 w-4"
                      aria-hidden="true"
                    />

                    Confirm & submit

                  </>

                )}

              </button>

            </div>


            {/* PRIVACY */}

            <p className="citizen-confirm-fineprint">

              <ShieldCheck
                className="h-3.5 w-3.5"
                aria-hidden="true"
              />

              Your report is shared with the
              municipal team as public civic
              information. Your name and contact
              details are never shown publicly.

            </p>

          </div>


          <p className="citizen-confirm-fineprint">

            <Info
              className="h-3.5 w-3.5"
              aria-hidden="true"
            />

            AI-assisted result — please review
            the detected information before submitting.

          </p>

        </>
      )}

    </div>
  );
};