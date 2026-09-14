/**
 * Small shared UI primitives for the Citizen workspace.
 * Reusable pieces: status pill, progress steps, section heading,
 * empty / error / skeleton states. All are accessibility-first:
 * icon + text (never color-only), 44px touch targets, focus states.
 */
import React from 'react';
import {
  AlertTriangle,
  Check,
  ChevronRight,
  CircleAlert,
  FileText,
  RefreshCw,
} from 'lucide-react';
import type { Incident, IncidentStatus } from '../../types/civic';
import { CITIZEN_STATUS, categoryLabel, updatedLabel } from './citizenData';

/* ---------------- Status pill (icon + text, never color-only) ---------------- */

export const StatusPill: React.FC<{ status: IncidentStatus }> = ({ status }) => {
  const info = CITIZEN_STATUS[status];
  return (
    <span className={`citizen-status citizen-status-${info.tone}`}>
      <Check className="w-3 h-3" aria-hidden="true" />
      {info.label}
    </span>
  );
};

/* ---------------- Section heading ---------------- */

export const SectionHeading: React.FC<{
  eyebrow?: string;
  title: string;
  action?: string;
  onAction?: () => void;
}> = ({ eyebrow, title, action, onAction }) => (
  <div className="flex items-end justify-between gap-3">
    <div>
      {eyebrow && <p className="citizen-eyebrow">{eyebrow}</p>}
      <h2 className="mt-1 text-lg font-extrabold tracking-[-.035em] text-[#191B1F]">{title}</h2>
    </div>
    {action && (
      <button className="citizen-text-action" onClick={onAction}>
        {action}
        <ChevronRight className="w-3.5 h-3.5" aria-hidden="true" />
      </button>
    )}
  </div>
);

/* ---------------- Report progress steps ---------------- */

const STAGES: { status: IncidentStatus; label: string }[] = [
  { status: 'reported', label: 'Reported' },
  { status: 'needs_review', label: 'Review' },
  { status: 'assigned', label: 'Assigned' },
  { status: 'in_progress', label: 'Progress' },
  { status: 'resolved', label: 'Resolved' },
];

export const ReportProgress: React.FC<{ incident: Incident }> = ({ incident }) => {
  const current = STAGES.findIndex((s) => s.status === incident.status);
  const activeIndex = current === -1 ? 0 : current;
  return (
    <div
      className="citizen-progress"
      role="img"
      aria-label={`Status: ${CITIZEN_STATUS[incident.status].label}`}
    >
      {STAGES.map((stage, index) => (
        <React.Fragment key={stage.status}>
          <span className={index <= activeIndex ? 'is-done' : ''}>
            <i aria-hidden="true">
              {index <= activeIndex ? <Check className="w-2.5 h-2.5" /> : index + 1}
            </i>
            <b>{stage.label}</b>
            {index === activeIndex && <span className="citizen-sr-only">(current step)</span>}
          </span>
          {index < STAGES.length - 1 && (
            <em className={index < activeIndex ? 'is-done' : ''} aria-hidden="true" />
          )}
        </React.Fragment>
      ))}
    </div>
  );
};

/* ---------------- My report card ---------------- */

export const MyReportCard: React.FC<{
  incident: Incident;
  onOpen?: () => void;
  /** Optional explanation rendered INSIDE the card, under a divider. */
  detail?: React.ReactNode;
}> = ({ incident, onOpen, detail }) => {
  const status = CITIZEN_STATUS[incident.status] || CITIZEN_STATUS.reported;
  return (
    <div className="citizen-my-report">
      <button
        onClick={onOpen}
        className="citizen-my-report-head"
        aria-label={`${categoryLabel(incident.category)} report in ${incident.sector}, status ${status.label}.${onOpen ? ' View details.' : ''}`}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="text-left">
            <span className="citizen-eyebrow">YOUR REPORT</span>
            <span className="citizen-my-report-title">{categoryLabel(incident.category)}</span>
            <span className="citizen-my-report-sector">{incident.sector} · Approximate area</span>
          </div>
          <StatusPill status={incident.status} />
        </div>
        <ReportProgress incident={incident} />
        <span className="citizen-my-report-updated">{updatedLabel(incident.waitingDays)}</span>
      </button>
      {detail && <div className="citizen-my-report-detail">{detail}</div>}
    </div>
  );
};

/* ---------------- Empty state ---------------- */

export const EmptyState: React.FC<{
  title: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
}> = ({ title, message, actionLabel, onAction }) => (
  <div className="citizen-empty" role="status">
    <FileText className="w-5 h-5" aria-hidden="true" />
    <p>
      <b>{title}</b>
      <span>{message}</span>
    </p>
    {actionLabel && onAction && <button onClick={onAction}>{actionLabel}</button>}
  </div>
);

/* ---------------- Error state (human-friendly, no raw technical errors) ---------------- */

export const ErrorState: React.FC<{
  title: string;
  message: string;
  onRetry?: () => void;
  retryLabel?: string;
  secondaryLabel?: string;
  onSecondary?: () => void;
}> = ({ title, message, onRetry, retryLabel = 'Try again', secondaryLabel, onSecondary }) => (
  <div className="citizen-error" role="alert">
    <b>
      <CircleAlert className="w-4 h-4" aria-hidden="true" />
      {title}
    </b>
    <p>{message}</p>
    {(onRetry || onSecondary) && (
      <div className="citizen-error-actions">
        {onRetry && (
          <button onClick={onRetry}>
            <RefreshCw className="mr-1 inline w-3.5 h-3.5" aria-hidden="true" />
            {retryLabel}
          </button>
        )}
        {onSecondary && onSecondary !== undefined && secondaryLabel && (
          <button onClick={onSecondary}>{secondaryLabel}</button>
        )}
      </div>
    )}
  </div>
);

/* ---------------- Skeleton loading ---------------- */

export const SkeletonList: React.FC<{ rows?: number; label?: string }> = ({
  rows = 3,
  label = 'Loading…',
}) => (
  <div className="mt-3 space-y-2.5" role="status" aria-label={label}>
    {Array.from({ length: rows }).map((_, i) => (
      <div key={i} className="flex items-center gap-3 p-2">
        <div className="citizen-skeleton h-10 w-10 shrink-0 rounded-xl" />
        <div className="flex-1 space-y-2">
          <div className="citizen-skeleton h-3.5 w-2/5 rounded-full" />
          <div className="citizen-skeleton h-3 w-3/5 rounded-full" />
        </div>
        <AlertTriangle className="citizen-sr-only" aria-hidden="true" />
      </div>
    ))}
  </div>
);