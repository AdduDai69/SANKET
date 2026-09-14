/**
 * Citizen Map, My Reports, Profile pages + Notifications panel.
 *
 * Map: simplified public view — nearby public issues, approximate locations,
 *      simple filters, lightweight public issue card. No internal risk markers.
 * Reports: citizen's own reports with progress + human status explanations.
 * Profile: lightweight account area with prototype workspace switcher.
 * Notifications: slide-in panel; clicking one opens the relevant report.
 */
import React, { useMemo, useState } from 'react';
import {
  Bell,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  HardHat,
  Landmark,
  LifeBuoy,
  LocateFixed,
  LogOut,
  MapPin,
  MessageSquareText,
  Navigation,
  ShieldCheck,
  X,
} from 'lucide-react';
import { CivicMap } from '../common/CivicMap';
import type { CivicNotification, Incident } from '../../types/civic';
import { useCivic } from '../../context/CivicContext';
import { categoryLabel, CITIZEN_STATUS, MAP_FILTERS } from './citizenData';
import { useCitizenLocation } from './useCitizenLocation';
import {
  EmptyState,
  MyReportCard,
  SectionHeading,
  SkeletonList,
  StatusPill,
} from './CitizenPrimitives';

/* =================================================================
 * CITIZEN MAP
 * ================================================================= */

export const CitizenMapPage: React.FC<{
  incidents: Incident[];
  onReport: () => void;
}> = ({ incidents, onReport }) => {
  const [filterId, setFilterId] = useState('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const { status: locationStatus, coords, request } = useCitizenLocation();

  const visible = useMemo(() => {
    const filter = MAP_FILTERS.find((f) => f.id === filterId);
    if (!filter || filter.categories.length === 0) return incidents.slice(0, 10);
    return incidents.filter((i) => filter.categories.includes(i.category)).slice(0, 10);
  }, [incidents, filterId]);

  const selected = visible.find((i) => i.id === selectedId) ?? null;

  return (
    <div className="citizen-page">
      <SectionHeading eyebrow="AROUND YOU" title="Public issues nearby" />
      <p className="citizen-hint">Locations are shown approximately to protect community privacy.</p>

      <div className="citizen-filter-row" role="group" aria-label="Filter public issues by type">
        {MAP_FILTERS.map((f) => (
          <button
            key={f.id}
            onClick={() => setFilterId(f.id)}
            className={filterId === f.id ? 'is-active' : ''}
            aria-pressed={filterId === f.id}
          >
            {f.label}
          </button>
        ))}
      </div>

      {visible.length ? (
        <>
          {/* Real interactive Leaflet map (same engine as the Admin map) */}
          <div className="citizen-map-wrapper citizen-map-page-wrapper">
            <CivicMap
              variant="citizen"
              incidents={visible}
              height="100%"
              selectedIncidentId={selectedId}
              onSelectIncident={(id) => setSelectedId((prev) => (prev === id ? null : id))}
              onIssueClick={(id) => setSelectedId(id)}
              userLocation={coords}
              focusTarget={selected
                ? [selected.latitude, selected.longitude]
                : null}
            />
            <button
              className="citizen-locate-button"
              onClick={request}
              disabled={locationStatus === 'locating'}
              aria-label={
                locationStatus === 'granted'
                  ? 'Recentre map on your approximate location'
                  : 'Show your approximate location on the map'
              }
            >
              <LocateFixed className="h-4 w-4" aria-hidden="true" />
              {locationStatus === 'locating' ? 'Locating…' : locationStatus === 'granted' ? 'Recentre' : 'Locate me'}
            </button>
          </div>

          {locationStatus === 'unavailable' && (
            <div className="citizen-location-note" role="status">
              <Navigation className="h-3.5 w-3.5" aria-hidden="true" />
              Location unavailable — the map still works. Enable location permission, or simply
              browse the area by panning.
            </div>
          )}

          {selected && (
            <article className="citizen-public-issue" aria-live="polite">
              <div>
                <p className="citizen-eyebrow">PUBLIC ISSUE</p>
                <h2>{categoryLabel(selected.category)}</h2>
                <p>
                  {selected.sector} · Approximate location
                  {selected.confidenceEvidence.relatedReportsCount > 3 &&
                    ` · ${selected.confidenceEvidence.relatedReportsCount} similar reports`}
                </p>
              </div>
              <StatusPill status={selected.status} />
              <p>
                {selected.isRecurring
                  ? 'Multiple people have reported a similar problem nearby.'
                  : 'Municipal teams are reviewing this location.'}
              </p>
              <p className="citizen-public-issue-detail">
                {CITIZEN_STATUS[selected.status].explanation}
              </p>
            </article>
          )}
        </>
      ) : (
        <div className="mt-4">
          <EmptyState
            title="No reported issues in this category."
            message="Be the first to help your community."
            actionLabel="Report an issue"
            onAction={onReport}
          />
        </div>
      )}

      <div className="mt-5">
        <button className="citizen-report-compact" onClick={onReport}>
          <span className="citizen-report-compact-icon" aria-hidden="true">
            <MapPin className="h-4 w-4" />
          </span>
          Spotted something else? Report an issue
          <ChevronRight className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
};

/* =================================================================
 * MY REPORTS
 * ================================================================= */

export const CitizenReportsPage: React.FC<{
  myReports: Incident[];
  onReport: () => void;
}> = ({ myReports, onReport }) => {
  const [isLoading] = useState(false); // prototype: data is local & instant
  const activeCount = myReports.filter((r) => r.status !== 'resolved').length;

  return (
    <div className="citizen-page">
      <SectionHeading eyebrow="MY REPORTS" title="Your civic updates" />
      <p className="citizen-hint">
        {myReports.length
          ? `${activeCount} active · ${myReports.length - activeCount} resolved — follow the progress of what you reported.`
          : 'Reports you submit will appear here with their progress.'}
      </p>

      {isLoading ? (
        <SkeletonList rows={3} label="Loading your reports…" />
      ) : myReports.length ? (
        <div className="mt-5 grid gap-3 md:grid-cols-2">
          {myReports.map((incident) => (
            <MyReportCard
              key={incident.id}
              incident={incident}
              detail={<p>{(CITIZEN_STATUS[incident.status] || CITIZEN_STATUS.reported).explanation}</p>}
            />
          ))}
        </div>
      ) : (
        <div className="mt-5">
          <EmptyState
            title="No reports yet."
            message="You haven't reported anything yet."
            actionLabel="Report an issue"
            onAction={onReport}
          />
        </div>
      )}
    </div>
  );
};

/* =================================================================
 * PROFILE
 * ================================================================= */

export const CitizenProfilePage: React.FC<{
  onNavigate: (path: string) => void;
}> = ({ onNavigate }) => {
  const { showToast } = useCivic();
  const [language, setLanguage] = useState('English');
  const [locationAllowed, setLocationAllowed] = useState(true);
  const [notificationsOn, setNotificationsOn] = useState(true);

  return (
    <div className="citizen-page">
      <SectionHeading eyebrow="PROFILE" title="Your CivicLens account" />

      <section className="citizen-profile-card">
        <div className="citizen-profile-avatar" aria-hidden="true">
          AS
        </div>
        <div>
          <h2>Asha Sharma</h2>
          <p>a••••@example.com · +91 ••••• 4821</p>
        </div>
      </section>

      <section className="citizen-settings-list" aria-label="Profile settings">
        <div className="citizen-settings-row">
          <span>
            <MessageSquareText className="h-4 w-4" aria-hidden="true" />
            Preferred language
          </span>
          <b>
            <label className="citizen-sr-only" htmlFor="citizen-language">
              Preferred language
            </label>
            <select
              id="citizen-language"
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
            >
              <option>English</option>
              <option>हिन्दी</option>
              <option>ਪੰਜਾਬੀ</option>
            </select>
          </b>
        </div>

        <div className="citizen-settings-row">
          <span>
            <Navigation className="h-4 w-4" aria-hidden="true" />
            Location permission
          </span>
          <span className="citizen-switch">
            <input
              type="checkbox"
              checked={locationAllowed}
              onChange={(e) => setLocationAllowed(e.target.checked)}
              aria-label="Location permission"
            />
            <em aria-hidden="true" />
          </span>
        </div>

        <div className="citizen-settings-row">
          <span>
            <Bell className="h-4 w-4" aria-hidden="true" />
            Notification preferences
          </span>
          <span className="citizen-switch">
            <input
              type="checkbox"
              checked={notificationsOn}
              onChange={(e) => setNotificationsOn(e.target.checked)}
              aria-label="Notification preferences"
            />
            <em aria-hidden="true" />
          </span>
        </div>

        <button
          className="citizen-settings-row"
          onClick={() =>
            showToast('Help & support', 'Support is not part of this prototype yet.', 'info')
          }
        >
          <span>
            <LifeBuoy className="h-4 w-4" aria-hidden="true" />
            Help & support
          </span>
          <b>
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </b>
        </button>

        <button
          className="citizen-settings-row"
          onClick={() => onNavigate('/')}
          aria-label="Sign out and return to the workspace selection screen"
        >
          <span>
            <LogOut className="h-4 w-4" aria-hidden="true" />
            Sign out
          </span>
          <b>
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </b>
        </button>
      </section>

      {/* -------- Prototype workspace switcher (demo only) -------- */}
      <section className="citizen-switcher" aria-labelledby="citizen-switcher-title">
        <p className="citizen-eyebrow" id="citizen-switcher-title">
          PROTOTYPE WORKSPACE SWITCHER
        </p>
        <p className="mt-1 text-sm text-[#565C68]">
          Demo-only access to the other CivicLens workspaces. A real citizen account would not see
          this.
        </p>
        <div className="citizen-switcher-grid">
          <button className="is-current" disabled aria-current="true">
            <ShieldCheck className="h-4 w-4" aria-hidden="true" />
            Citizen
          </button>
          <button onClick={() => onNavigate('/field')}>
            <HardHat className="h-4 w-4" aria-hidden="true" />
            Field Worker
          </button>
          <button onClick={() => onNavigate('/admin')}>
            <Landmark className="h-4 w-4" aria-hidden="true" />
            Municipal Admin
          </button>
        </div>
      </section>
    </div>
  );
};

/* =================================================================
 * NOTIFICATIONS PANEL
 * ================================================================= */

export const CitizenNotifications: React.FC<{
  notifications: CivicNotification[];
  onClose: () => void;
  onOpenReport: () => void;
}> = ({ notifications, onClose, onOpenReport }) => {
  const { markNotificationRead, clearAllNotifications } = useCivic();

  return (
    <div
      className="citizen-notification-layer"
      role="dialog"
      aria-modal="true"
      aria-label="Notifications"
    >
      <button className="absolute inset-0" onClick={onClose} aria-label="Close notifications" />
      <section>
        <div className="flex items-center justify-between">
          <div>
            <p className="citizen-eyebrow">UPDATES</p>
            <h2 className="text-lg font-extrabold tracking-[-.03em]">Notifications</h2>
          </div>
          <button className="citizen-icon-button" onClick={onClose} aria-label="Close notifications">
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        {notifications.length ? (
          <>
            {notifications.slice(0, 6).map((n) => (
              <button
                key={n.id}
                className={`citizen-notification ${n.read ? '' : 'is-unread'}`}
                onClick={() => {
                  markNotificationRead(n.id);
                  onOpenReport();
                }}
              >
                <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                <span>
                  <b>{n.title}</b>
                  <small>
                    {n.message} ·{' '}
                    {new Date(n.timestamp).toLocaleDateString(undefined, {
                      month: 'short',
                      day: 'numeric',
                    })}
                  </small>
                </span>
              </button>
            ))}
            <button
              className="citizen-text-action mt-3 self-center"
              onClick={clearAllNotifications}
            >
              Mark all as read
            </button>
          </>
        ) : (
          <div className="citizen-notification-empty" role="status">
            <Bell className="mx-auto h-5 w-5" aria-hidden="true" />
            <p className="mt-2">You're all caught up.</p>
            <p className="text-xs text-[#7E8592]">Updates about your reports will appear here.</p>
          </div>
        )}

        <p className="citizen-confirm-fineprint mt-auto">
          <ClipboardList className="h-3.5 w-3.5" aria-hidden="true" />
          Tap a notification to see the report it belongs to.
        </p>
      </section>
    </div>
  );
};