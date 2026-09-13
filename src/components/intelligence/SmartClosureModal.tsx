import React from 'react';

import { useCivic } from '../../context/CivicContext';

import {
  X,
  CheckCircle2,
  AlertTriangle,
  MapPin,
  Sparkles,
  ShieldCheck,
  Clock,
  ImageOff,
} from 'lucide-react';


export const SmartClosureModal:
  React.FC = () => {

  const {
    selectedIncident,
    isSmartClosureOpen,
    setIsSmartClosureOpen,
  } = useCivic();


  if (
    !isSmartClosureOpen ||
    !selectedIncident
  ) {
    return null;
  }


  const inc =
    selectedIncident;

  const closure =
    inc.smartClosure;


  /*
   * Smart Closure is considered verified only when:
   *
   * 1. The backend has produced a closure evaluation.
   * 2. The backend marked the incident as resolved.
   * 3. The backend reported a valid location/evidence match.
   *
   * No frontend-generated score or decision is used.
   */
  const isVerified =
    inc.status === 'resolved' &&
    Boolean(
      closure?.isLikelyMatch
    );


  const hasClosureEvidence =
    Boolean(
      inc.afterImageUrl ||
      closure
    );


  const formatDate = (
    value?: string
  ) => {

    if (!value) {
      return 'Recorded';
    }

    const date =
      new Date(value);

    if (
      Number.isNaN(
        date.getTime()
      )
    ) {
      return 'Recorded';
    }

    return date.toLocaleDateString();
  };


  const formatDateTime = (
    value?: string
  ) => {

    if (!value) {
      return 'Evaluation recorded';
    }

    const date =
      new Date(value);

    if (
      Number.isNaN(
        date.getTime()
      )
    ) {
      return 'Evaluation recorded';
    }

    return date.toLocaleString();
  };


  const statusLabel =
    inc.status.replace(
      /_/g,
      ' '
    );


  return (

    <div
      className="fixed inset-0 z-[3000] isolate flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby="smart-closure-title"
    >

      <div className="bg-white rounded-2xl shadow-2xl border border-[#E5E3DC] w-full max-w-2xl overflow-hidden text-left">


        {/* =================================================
            HEADER
        ================================================= */}

        <div className="p-5 border-b border-[#E5E3DC] bg-[#FAF9F5] flex items-center justify-between">

          <div className="flex items-center gap-2.5">

            <div
              className={`w-8 h-8 rounded-lg border flex items-center justify-center ${
                isVerified
                  ? 'bg-[#EBF7EF] border-[#C8EAD4] text-[#1E6B42]'
                  : 'bg-[#FDF0ED] border-[#F8D2CA] text-[#C54E38]'
              }`}
            >

              {isVerified ? (

                <CheckCircle2
                  className="w-4 h-4"
                  aria-hidden="true"
                />

              ) : (

                <AlertTriangle
                  className="w-4 h-4"
                  aria-hidden="true"
                />

              )}

            </div>


            <div>

              <h3
                id="smart-closure-title"
                className="text-sm font-bold text-[#191B1F]"
              >
                SANKET Smart Closure
              </h3>

              <p className="text-xs text-[#7E8592]">
                Evidence and spatial validation from the backend
              </p>

            </div>

          </div>


          <button
            onClick={() =>
              setIsSmartClosureOpen(
                false
              )
            }
            className="p-1.5 rounded-lg text-[#7E8592] hover:bg-[#F4F3EF] hover:text-[#191B1F] transition-colors"
            aria-label="Close Smart Closure"
          >

            <X
              className="w-4 h-4"
              aria-hidden="true"
            />

          </button>

        </div>


        {/* =================================================
            CONTENT
        ================================================= */}

        <div className="p-6 space-y-5 max-h-[80vh] overflow-y-auto">


          {/* =================================================
              RESULT
          ================================================= */}

          {closure ? (

            <div
              className={`p-4 rounded-xl border flex items-center justify-between ${
                closure.isLikelyMatch
                  ? 'bg-[#EBF7EF] border-[#C8EAD4]'
                  : 'bg-[#FDF0ED] border-[#F8D2CA]'
              }`}
            >

              <div className="flex items-center gap-3">

                <div
                  className={`w-12 h-12 rounded-xl bg-white border flex items-center justify-center font-black font-mono text-xl shadow-xs ${
                    closure.isLikelyMatch
                      ? 'border-[#C8EAD4] text-[#1E6B42]'
                      : 'border-[#F8D2CA] text-[#C54E38]'
                  }`}
                >

                  {Math.round(
                    closure.matchConfidence
                  )}%

                </div>


                <div>

                  <span
                    className={`text-xs font-bold uppercase tracking-wider block ${
                      closure.isLikelyMatch
                        ? 'text-[#1E6B42]'
                        : 'text-[#C54E38]'
                    }`}
                  >

                    {closure.isLikelyMatch
                      ? 'Location match verified'
                      : 'Additional verification required'}

                  </span>


                  <p
                    className={`text-xs font-medium mt-0.5 ${
                      closure.isLikelyMatch
                        ? 'text-[#1E6B42]/90'
                        : 'text-[#C54E38]/90'
                    }`}
                  >

                    Field evidence was captured{' '}

                    <span className="font-bold underline">

                      {Math.round(
                        closure.distanceMeters
                      )}{' '}
                      metres

                    </span>{' '}

                    from the original incident coordinate.

                  </p>

                </div>

              </div>


              <span
                className={`hidden sm:inline-block px-2.5 py-1 rounded text-xs font-bold bg-white border ${
                  closure.isLikelyMatch
                    ? 'text-[#1E6B42] border-[#C8EAD4]'
                    : 'text-[#C54E38] border-[#F8D2CA]'
                }`}
              >

                {closure.isLikelyMatch
                  ? 'Verified'
                  : 'Review Required'}

              </span>

            </div>

          ) : (

            <div className="p-4 rounded-xl bg-[#FAF9F5] border border-[#E5E3DC]">

              <div className="flex items-center gap-2">

                <AlertTriangle
                  className="w-4 h-4 text-[#C54E38]"
                  aria-hidden="true"
                />

                <span className="text-xs font-bold text-[#191B1F]">
                  No Smart Closure evaluation available
                </span>

              </div>

              <p className="mt-2 text-xs text-[#565C68]">
                No completion evidence has been evaluated for this incident yet.
              </p>

            </div>

          )}


          {/* =================================================
              EVIDENCE
          ================================================= */}

          <div>

            <div className="flex items-center justify-between mb-2">

              <span className="text-xs font-bold text-[#191B1F] uppercase tracking-wider">
                Completion Evidence
              </span>

              {closure && (

                <span className="text-[11px] text-[#7E8592] font-mono">
                  {formatDateTime(
                    closure.inspectedAt
                  )}
                </span>

              )}

            </div>


            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">


              {/* BEFORE */}

              <div className="border border-[#E5E3DC] rounded-xl overflow-hidden bg-[#F4F3EF]">

                <div className="px-3 py-1.5 bg-[#FAF9F5] border-b border-[#E5E3DC] flex items-center justify-between text-xs">

                  <span className="font-bold text-[#C54E38]">
                    ORIGINAL REPORT
                  </span>

                  <span className="text-[10px] text-[#7E8592] font-mono">
                    {formatDate(
                      inc.reportedAt
                    )}
                  </span>

                </div>


                {inc.beforeImageUrl ? (

                  <img
                    src={inc.beforeImageUrl}
                    alt="Original reported condition"
                    className="w-full h-48 object-cover"
                  />

                ) : (

                  <div className="w-full h-48 flex flex-col items-center justify-center gap-2 text-[#7E8592]">

                    <ImageOff
                      className="w-6 h-6"
                      aria-hidden="true"
                    />

                    <span className="text-xs">
                      Original photo unavailable
                    </span>

                  </div>

                )}


                <div className="p-2.5 text-[11px] text-[#565C68] leading-tight">

                  {inc.description ||
                    'Original citizen report evidence.'}

                </div>

              </div>


              {/* AFTER */}

              <div className="border border-[#C8EAD4] rounded-xl overflow-hidden bg-[#EBF7EF]">

                <div className="px-3 py-1.5 bg-[#EBF7EF] border-b border-[#C8EAD4] flex items-center justify-between text-xs">

                  <span className="font-bold text-[#1E6B42]">
                    COMPLETION PHOTO
                  </span>

                  <span className="text-[10px] text-[#1E6B42] font-mono">
                    Backend evidence
                  </span>

                </div>


                {inc.afterImageUrl ? (

                  <img
                    src={inc.afterImageUrl}
                    alt="Actual field completion evidence"
                    className="w-full h-48 object-cover"
                  />

                ) : (

                  <div className="w-full h-48 flex flex-col items-center justify-center gap-2 text-[#7E8592]">

                    <ImageOff
                      className="w-6 h-6"
                      aria-hidden="true"
                    />

                    <span className="text-xs">
                      No completion photo available
                    </span>

                  </div>

                )}


                <div className="p-2.5 text-[11px] text-[#1E6B42] leading-tight">

                  {hasClosureEvidence
                    ? 'Completion evidence has been evaluated from the backend record.'
                    : 'No completion evidence has been submitted.'}

                </div>

              </div>

            </div>

          </div>


          {/* =================================================
              LOCATION DETAILS
          ================================================= */}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">


            <div className="rounded-lg border border-[#E5E3DC] bg-[#FAF9F5] p-3">

              <div className="flex items-center gap-1.5 text-[11px] font-bold text-[#191B1F] uppercase">

                <MapPin
                  className="w-3.5 h-3.5"
                  aria-hidden="true"
                />

                Field distance

              </div>

              <p className="mt-1 text-sm font-extrabold text-[#191B1F]">

                {closure &&
                Number.isFinite(
                  closure.distanceMeters
                )
                  ? `${Math.round(
                      closure.distanceMeters
                    )} m`
                  : '—'}

              </p>

            </div>


            <div className="rounded-lg border border-[#E5E3DC] bg-[#FAF9F5] p-3">

              <div className="flex items-center gap-1.5 text-[11px] font-bold text-[#191B1F] uppercase">

                <ShieldCheck
                  className="w-3.5 h-3.5"
                  aria-hidden="true"
                />

                Match score

              </div>

              <p className="mt-1 text-sm font-extrabold text-[#191B1F]">

                {closure &&
                Number.isFinite(
                  closure.matchConfidence
                )
                  ? `${Math.round(
                      closure.matchConfidence
                    )}%`
                  : '—'}

              </p>

            </div>


            <div className="rounded-lg border border-[#E5E3DC] bg-[#FAF9F5] p-3">

              <div className="flex items-center gap-1.5 text-[11px] font-bold text-[#191B1F] uppercase">

                <Clock
                  className="w-3.5 h-3.5"
                  aria-hidden="true"
                />

                Status

              </div>

              <p className="mt-1 text-sm font-extrabold text-[#191B1F] capitalize">

                {statusLabel}

              </p>

            </div>

          </div>


          {/* =================================================
              SANKET EXPLANATION
          ================================================= */}

          <div className="p-3.5 rounded-lg bg-[#FAF9F5] border border-[#E5E3DC] space-y-1.5">

            <div className="flex items-center gap-1.5 text-xs font-bold text-[#191B1F]">

              <Sparkles
                className="w-3.5 h-3.5 text-[#2C5E48]"
                aria-hidden="true"
              />

              <span>
                SANKET Verification Logic
              </span>

            </div>


            <p className="text-xs text-[#565C68] leading-relaxed">

              {closure?.explanation ||
                'The backend has not produced a Smart Closure evaluation for this incident.'}

            </p>

          </div>


          {/* =================================================
              HONEST METHODOLOGY NOTE
          ================================================= */}

          <div className="rounded-lg border border-[#E5E3DC] p-3 text-xs text-[#565C68]">

            <strong className="text-[#191B1F]">
              Evidence basis:
            </strong>{' '}

            Smart Closure uses the submitted completion evidence
            and field GPS distance from the original incident.
            No synthetic image, distance, or visual-match value is
            displayed here.

          </div>

        </div>


        {/* =================================================
            FOOTER
        ================================================= */}

        <div className="p-5 border-t border-[#E5E3DC] bg-[#FAF9F5] flex flex-col sm:flex-row items-center justify-between gap-3">

          <div className="flex items-center gap-2 text-xs text-[#565C68]">

            {isVerified ? (

              <>

                <CheckCircle2
                  className="w-4 h-4 text-[#1E6B42]"
                  aria-hidden="true"
                />

                Incident resolved using Smart Closure evidence.

              </>

            ) : (

              <>

                <AlertTriangle
                  className="w-4 h-4 text-[#C54E38]"
                  aria-hidden="true"
                />

                Municipal review may still be required.

              </>

            )}

          </div>


          <button
            onClick={() =>
              setIsSmartClosureOpen(
                false
              )
            }
            className="w-full sm:w-auto px-4 py-2 rounded-lg text-xs font-bold bg-[#1E6B42] text-white hover:bg-[#185333] transition-colors flex items-center justify-center gap-1.5 shadow-sm"
          >

            <CheckCircle2
              className="w-3.5 h-3.5"
              aria-hidden="true"
            />

            Close

          </button>

        </div>

      </div>

    </div>
  );
};