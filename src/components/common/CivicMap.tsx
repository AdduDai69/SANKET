import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import { Incident, IncidentStatus, IssueCategory, CivicDnaAsset } from '../../types/civic';
import { useCivic } from '../../context/CivicContext';

interface CivicMapProps {
  incidents: Incident[];
  selectedIncidentId?: string | null;
  onSelectIncident?: (id: string) => void;
  height?: string;
  className?: string;
  showFilters?: boolean;

  /**
   * 'admin' (default): operational markers (risk scores, SANKET popups).
   * 'citizen': public layer only — status-colored markers, citizen popups,
   * no internal scores. Same underlying Leaflet map, tiles and controls.
   */
  variant?: 'admin' | 'citizen';

  /** Citizen variant: called when "View Issue" is pressed in a popup. */
  onIssueClick?: (id: string) => void;

  /** Citizen variant: approximate "you are here" dot. */
  userLocation?: [number, number] | null;

  /** Citizen variant: fly to these coordinates when they change. */
  focusTarget?: [number, number] | null;

  /** Show persistent infrastructure assets layer (Civic DNA) */
  showAssets?: boolean;

  /** Optional pre-filtered assets list (e.g. from MapView) */
  assets?: CivicDnaAsset[];
}

/* ---------------- Citizen presentation layer (public info only) ---------------- */

const CITIZEN_MARKER_VISUAL: Record<
  IncidentStatus,
  { color: string; soft: string; border: string; label: string }
> = {
  reported: {
    color: '#4E5D6C',
    soft: '#EEF0F3',
    border: '#DDE1E6',
    label: 'Reported',
  },
  needs_review: {
    color: '#C88427',
    soft: '#FBF3E0',
    border: '#F0E2C4',
    label: 'Under Review',
  },
  assigned: {
    color: '#24638F',
    soft: '#EEF5F9',
    border: '#D4E4EF',
    label: 'Assigned',
  },
  in_progress: {
    color: '#2F6355',
    soft: '#EAF3F0',
    border: '#D3E5DF',
    label: 'In Progress',
  },
  resolved: {
    color: '#1E6B42',
    soft: '#E9F4ED',
    border: '#CDE7D6',
    label: 'Resolved',
  },
  closed: {
    color: '#1E6B42',
    soft: '#E9F4ED',
    border: '#CDE7D6',
    label: 'Closed',
  },
};

/** Simplified stroke glyphs so markers read at small size. */
const CITIZEN_CATEGORY_GLYPH: Record<IssueCategory, string> = {
  pothole:
    '<path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><path d="M12 9v4"/><path d="M12 17h.01"/>',

  road_damage:
    '<path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><path d="M12 9v4"/><path d="M12 17h.01"/>',

  drainage:
    '<path d="M12 22a7 7 0 0 0 7-7c0-2-1-3.9-3-5.5s-3.5-4-4-6.5c-.5 2.5-2 4.9-4 6.5C6 11.1 5 13 5 15a7 7 0 0 0 7 7z"/>',

  water_leak:
    '<path d="M12 22a7 7 0 0 0 7-7c0-2-1-3.9-3-5.5s-3.5-4-4-6.5c-.5 2.5-2 4.9-4 6.5C6 11.1 5 13 5 15a7 7 0 0 0 7 7z"/>',

  waste:
    '<path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>',

  streetlight:
    '<path d="M15 14c.2-1 .7-1.7 1.5-2.5a5.5 5.5 0 1 0-9 0c.8.8 1.3 1.5 1.5 2.5"/><path d="M9 18h6"/><path d="M10 22h4"/>',

  other:
    '<path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/>',
};

const citizenGlyphSvg = (category: IssueCategory): string =>
  `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${
    CITIZEN_CATEGORY_GLYPH[category] ?? CITIZEN_CATEGORY_GLYPH.other
  }</svg>`;

/* ---------------- CivicMap ---------------- */

export const CivicMap: React.FC<CivicMapProps> = ({
  incidents,
  selectedIncidentId,
  onSelectIncident,
  height = '480px',
  className = '',
  variant = 'admin',
  onIssueClick,
  userLocation = null,
  focusTarget = null,
  showAssets = true,
  assets: propAssets,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersRef = useRef<{ [id: string]: L.Marker }>({});
  const assetMarkersRef = useRef<{ [id: string]: L.Marker }>({});

  const { selectIncident, assets: contextAssets, openAssetProfile, selectedAssetId } = useCivic();
  const assets = propAssets !== undefined ? propAssets : contextAssets;

  /*
   * Read the CARTO API key exactly once.
   *
   * IMPORTANT:
   * Vite exposes variables beginning with VITE_ to browser code.
   * CARTO basemap keys are designed to be used from the browser.
   */
  const cartoApiKey = import.meta.env.VITE_CARTO_API_KEY;

  // Keep the latest citizen click handler without re-creating markers each render.
  const onIssueClickRef = useRef(onIssueClick);
  onIssueClickRef.current = onIssueClick;

  const userLocationKey = userLocation
    ? `${userLocation[0].toFixed(5)},${userLocation[1].toFixed(5)}`
    : '';

  const focusKey = focusTarget
    ? `${focusTarget[0].toFixed(5)},${focusTarget[1].toFixed(5)}`
    : '';

  const isCitizen = variant === 'citizen';

  /* ---------------- Map initialization + incident markers ---------------- */

  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (!mapInstanceRef.current) {
      // Initialize map with a wider Punjab–Chandigarh–Haryana viewport.
      // This changes only the initial view; users can still pan/zoom freely.
      const map = L.map(mapContainerRef.current, {
        center: [30.5, 76.0],
        zoom: 8,
        zoomControl: false,
        attributionControl: false,
        dragging: true,
        scrollWheelZoom: true,
        doubleClickZoom: true,
        touchZoom: true,
        boxZoom: true,
        keyboard: true,
      });

      // A focused incident opens with its popup visible.
      // As soon as an operator explores the area, remove that popup.
      map.on('dragstart', () => map.closePopup());

      map.getContainer().style.touchAction = 'none';

      

if (!cartoApiKey) {
  console.error(
    'CARTO basemap API key is missing. Set VITE_CARTO_API_KEY in your .env file.'
  );
}

L.tileLayer(
  `https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png?key=${encodeURIComponent(
    cartoApiKey ?? ''
  )}`,
  {
    maxZoom: 19,
    subdomains: 'abcd',
  }
).addTo(map);

      /* ---------------- CARTO Voyager basemap ---------------- */

      if (!cartoApiKey) {
        console.error(
          'CARTO basemap API key is missing. Set VITE_CARTO_API_KEY in your .env file and restart Vite.'
        );
      }

      const cartoTileUrl = cartoApiKey
        ? `https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png?key=${encodeURIComponent(
            cartoApiKey
          )}`
        : 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png';

      L.tileLayer(cartoTileUrl, {
        maxZoom: 19,
        subdomains: 'abcd',
      }).addTo(map);

      /* ---------------- Attribution ---------------- */

      L.control
        .attribution({
          position: 'bottomright',
          prefix: '© OpenStreetMap contributors, CartoDB',
        })
        .addTo(map);

      /* ---------------- Custom Zoom control ---------------- */

      L.control.zoom({
        position: 'topright',
      }).addTo(map);

      mapInstanceRef.current = map;
    }

    const map = mapInstanceRef.current;

    /* ---------------- Clear old markers ---------------- */

    Object.values(markersRef.current).forEach((marker) => marker.remove());
    markersRef.current = {};

    Object.values(assetMarkersRef.current).forEach((marker) => marker.remove());
    assetMarkersRef.current = {};

    /* ---------------- Render incident markers ---------------- */

    incidents.forEach((inc) => {
      // Co-location detection for coordinate micro-offsetting and badge display
      // Ensures multiple distinct issues at identical coordinates don't completely occlude
      const coordKey = `${inc.latitude.toFixed(4)}_${inc.longitude.toFixed(4)}`;
      const colocatedGroup = incidents.filter(
        (o) => `${o.latitude.toFixed(4)}_${o.longitude.toFixed(4)}` === coordKey
      );
      const groupIdx = colocatedGroup.findIndex((o) => o.id === inc.id);
      let displayLat = inc.latitude;
      let displayLng = inc.longitude;
      if (colocatedGroup.length > 1 && groupIdx >= 0) {
        const angle = (2 * Math.PI * groupIdx) / colocatedGroup.length;
        const radius = 0.00018; // ~18 meters subtle offset so all co-located markers are visible and clickable
        displayLat = inc.latitude + radius * Math.cos(angle);
        displayLng = inc.longitude + (radius / Math.cos((inc.latitude * Math.PI) / 180)) * Math.sin(angle);
      }

      if (isCitizen) {
        /* ---------------- Citizen marker ---------------- */

        const visual = CITIZEN_MARKER_VISUAL[inc.status];

        const isSelected = inc.id === selectedIncidentId;

        const size = isSelected ? 32 : 26;

        const iconHtml = `
          <div style="transform: translate(-50%, -50%); position: relative;">
            ${
              colocatedGroup.length > 1
                ? `
                  <div style="
                    position: absolute;
                    top: -4px;
                    right: -4px;
                    background: #191B1F;
                    color: white;
                    border: 1.5px solid white;
                    border-radius: 999px;
                    font-size: 8px;
                    font-weight: 800;
                    padding: 0 4px;
                    line-height: 12px;
                    z-index: 10;
                  ">
                    ${colocatedGroup.length}
                  </div>
                `
                : ''
            }
            <div style="
              background-color: ${visual.color};
              border: ${
                isSelected
                  ? '2.5px solid #191B1F'
                  : '2px solid #FFFFFF'
              };
              width: ${size}px;
              height: ${size}px;
              border-radius: 50%;
              display: flex;
              align-items: center;
              justify-content: center;
              box-shadow: 0 4px 10px rgba(0,0,0,0.22);
              transition: all 0.2s ease;
            ">
              ${citizenGlyphSvg(inc.category)}
            </div>
          </div>
        `;

        const customIcon = L.divIcon({
          html: iconHtml,
          className: 'custom-civic-marker',
          iconSize: [28, 28],
        });

        const marker = L.marker(
          [displayLat, displayLng],
          {
            icon: customIcon,
          }
        ).addTo(map);

        // Citizen popup: public information only.
        // No risk scores or internal operational metadata.
        const similarCount =
          inc.confidenceEvidence.relatedReportsCount;

        const popupHtml = `
          <div style="
            padding: 12px 14px;
            min-width: 210px;
            font-family: -apple-system, sans-serif;
            text-align: left;
          ">
            <div style="
              font-size: 10px;
              font-weight: 700;
              color: ${visual.color};
              text-transform: uppercase;
              letter-spacing: 0.5px;
            ">
              ${inc.category.replace('_', ' ')}
            </div>

            <div style="
              font-size: 12px;
              font-weight: 700;
              color: #191B1F;
              margin: 4px 0 2px;
              line-height: 1.3;
            ">
              ${inc.sector}
            </div>

            <div style="
              font-size: 11px;
              color: #565C68;
              margin-bottom: 8px;
            ">
              Approximate location${
                similarCount > 3
                  ? ` · ${similarCount} similar reports`
                  : ''
              }
            </div>

            ${
              colocatedGroup.length > 1
                ? `
                  <div style="
                    margin-bottom: 8px;
                    padding: 4px 8px;
                    border-radius: 6px;
                    background: #FAF9F5;
                    border: 1px solid #E5E3DC;
                    font-size: 10px;
                    color: #565C68;
                    font-weight: 600;
                  ">
                    📍 Co-located with ${colocatedGroup.length - 1} other issue${colocatedGroup.length > 2 ? 's' : ''} here (tracked separately)
                  </div>
                `
                : ''
            }

            <div style="
              display: inline-flex;
              align-items: center;
              gap: 4px;
              background: ${visual.soft};
              color: ${visual.color};
              border: 1px solid ${visual.border};
              padding: 2px 8px;
              border-radius: 999px;
              font-size: 10px;
              font-weight: 700;
              margin-bottom: 10px;
            ">
              ✓ ${visual.label}
            </div>

            <button
              id="citizen-view-btn-${inc.id}"
              style="
                width: 100%;
                background: #24638F;
                color: white;
                font-size: 11px;
                font-weight: 700;
                padding: 7px 10px;
                border-radius: 8px;
                border: none;
                cursor: pointer;
              "
            >
              View Issue →
            </button>
          </div>
        `;

        marker.bindPopup(popupHtml, {
          autoPan: true,
          autoPanPadding: [28, 56],
          keepInView: false,
        });

        marker.on('popupopen', () => {
          const btn = document.getElementById(
            `citizen-view-btn-${inc.id}`
          );

          if (btn) {
            btn.onclick = () => {
              onIssueClickRef.current?.(inc.id);
            };
          }
        });

        markersRef.current[inc.id] = marker;

        return;
      }

      /* ---------------- Admin marker ---------------- */

      const isSelected = inc.id === selectedIncidentId;

      const isCritical = inc.riskScore >= 80;

      const isHigh =
        inc.riskScore >= 70 && inc.riskScore < 80;

      const isMedium =
        inc.riskScore >= 50 && inc.riskScore < 70;

      let color = '#565C68';
      let border = '#191B1F';

      if (isCritical || isHigh) {
        color = '#C54E38';
        border = '#902C18';
      } else if (isMedium) {
        color = '#C88427';
        border = '#93580F';
      } else {
        color = '#2C5E48';
        border = '#1E4333';
      }

      /* ---------------- Admin SVG marker ---------------- */

      const iconHtml = `
        <div
          class="relative group cursor-pointer"
          style="transform: translate(-50%, -50%);"
        >
          ${
            colocatedGroup.length > 1
              ? `
                <div style="
                  position: absolute;
                  top: -5px;
                  right: -5px;
                  background: #191B1F;
                  color: white;
                  border: 1.5px solid white;
                  border-radius: 999px;
                  font-size: 8px;
                  font-weight: 800;
                  padding: 0 4px;
                  line-height: 12px;
                  z-index: 10;
                  box-shadow: 0 1px 3px rgba(0,0,0,0.3);
                ">
                  ${colocatedGroup.length}
                </div>
              `
              : ''
          }

          ${
            inc.isRecurring
              ? `
                <div
                  class="absolute -inset-1.5 rounded-full border border-dashed border-[#C88427] opacity-80 animate-spin-slow"
                ></div>
              `
              : ''
          }

          ${
            isCritical
              ? `
                <div
                  class="absolute -inset-2 rounded-full bg-[#C54E38] opacity-25 marker-pulse"
                ></div>
              `
              : ''
          }

          <div style="
            background-color: ${color};
            border: ${
              isSelected
                ? '2.5px solid #191B1F'
                : '1.5px solid #FFFFFF'
            };
            width: ${isSelected ? '32px' : '26px'};
            height: ${isSelected ? '32px' : '26px'};
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow: 0 4px 10px rgba(0,0,0,0.25);
            transition: all 0.2s ease;
          ">

            <span
              style="
                color: white;
                font-family: monospace;
                font-weight: 800;
                font-size: 11px;
              "
            >
              ${inc.riskScore}
            </span>

          </div>
        </div>
      `;

      const customIcon = L.divIcon({
        html: iconHtml,
        className: 'custom-civic-marker',
        iconSize: [28, 28],
      });

      const marker = L.marker(
        [displayLat, displayLng],
        {
          icon: customIcon,
        }
      ).addTo(map);

      /* ---------------- Admin popup ---------------- */

      const popupHtml = `
        <div style="
          padding: 12px 14px;
          min-width: 210px;
          font-family: -apple-system, sans-serif;
          text-align: left;
        ">

          <div style="
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 4px;
          ">

            <span style="
              font-size: 10px;
              font-weight: 700;
              color: ${color};
              text-transform: uppercase;
              letter-spacing: 0.5px;
            ">
              ${inc.category.replace('_', ' ')}
            </span>

            ${
              inc.isRecurring
                ? `
                  <span style="
                    font-size: 9px;
                    background: #FDF6EC;
                    color: #C88427;
                    border: 1px solid #F9E8CE;
                    padding: 1px 4px;
                    border-radius: 3px;
                    font-weight: 700;
                  ">
                    RECURRING
                  </span>
                `
                : ''
            }

          </div>

          <div style="
            font-size: 12px;
            font-weight: 700;
            color: #191B1F;
            margin-bottom: 4px;
            line-height: 1.3;
          ">
            ${inc.sector}
          </div>

          <div style="
            font-size: 11px;
            color: #565C68;
            margin-bottom: 8px;
          ">
            ${inc.location}
          </div>

          ${
            colocatedGroup.length > 1
              ? `
                <div style="
                  margin-bottom: 8px;
                  padding: 4px 8px;
                  border-radius: 6px;
                  background: #FAF9F5;
                  border: 1px solid #E5E3DC;
                  font-size: 10px;
                  color: #565C68;
                  font-weight: 600;
                ">
                  📍 Co-located: ${colocatedGroup.length} distinct complaints active at this coordinate
                </div>
              `
              : ''
          }

          <div style="
            display: flex;
            gap: 8px;
            font-size: 11px;
            margin-bottom: 10px;
            font-family: monospace;
            background: #F4F3EF;
            padding: 4px 6px;
            border-radius: 6px;
          ">

            <div>
              Risk: <b>${inc.riskScore}</b>
            </div>

            <div>•</div>

            <div>
              Conf: <b>${inc.confidenceScore}%</b>
            </div>

            <div>•</div>

            <div>
              ${inc.waitingDays}d
            </div>

          </div>

          <button
            id="view-btn-${inc.id}"
            style="
              width: 100%;
              background: #191B1F;
              color: white;
              font-size: 11px;
              font-weight: 700;
              padding: 6px 10px;
              border-radius: 6px;
              border: none;
              cursor: pointer;
            "
          >
            Investigate Incident →
          </button>

        </div>
      `;

      marker.bindPopup(popupHtml, {
        autoPan: true,
        autoPanPadding: [28, 56],
        keepInView: false,
      });

      marker.on('popupopen', () => {
        const btn = document.getElementById(
          `view-btn-${inc.id}`
        );

        if (btn) {
          btn.onclick = () => {
            selectIncident(inc.id, true);
          };
        }
      });

      marker.on('click', () => {
        if (onSelectIncident) {
          onSelectIncident(inc.id);
        } else {
          selectIncident(inc.id, false);
        }
      });

      markersRef.current[inc.id] = marker;
    });

    /* ---------------- Render Civic DNA Asset Markers (Admin mode) ---------------- */

    if (!isCitizen && showAssets && assets && assets.length > 0) {
      assets.forEach((asset) => {
        const isSelected = selectedAssetId === asset.assetId;
        const health = asset.currentHealthScore;
        const color = health >= 75 ? '#1E6B42' : health >= 60 ? '#C88427' : '#C54E38';
        const bgSoft = health >= 75 ? '#E9F4ED' : health >= 60 ? '#FDF6EC' : '#FDF0ED';

        const assetIconHtml = `
          <div style="transform: translate(-50%, -50%); cursor: pointer;">
            <div style="
              background-color: ${bgSoft};
              border: ${isSelected ? '2.5px solid #191B1F' : `2px solid ${color}`};
              width: 26px;
              height: 26px;
              border-radius: 6px;
              display: flex;
              align-items: center;
              justify-content: center;
              box-shadow: 0 2px 5px rgba(0,0,0,0.2);
              font-size: 12px;
            ">
              ${
                asset.assetType === 'streetlight'
                  ? '💡'
                  : asset.assetType === 'drainage'
                  ? '💧'
                  : asset.assetType === 'waste'
                  ? '🗑️'
                  : '🛣️'
              }
            </div>
          </div>
        `;

        const customIcon = L.divIcon({
          html: assetIconHtml,
          className: 'civic-asset-marker',
          iconSize: [26, 26],
          iconAnchor: [13, 13],
        });

        const marker = L.marker([asset.latitude, asset.longitude], { icon: customIcon });

        const popupHtml = `
          <div style="font-family: sans-serif; font-size: 12px; line-height: 1.4; padding: 2px; min-width: 220px;">
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 4px;">
              <span style="font-family: monospace; font-weight: bold; font-size: 11px; background: #f3f4f6; padding: 2px 5px; border-radius: 4px;">#${
                asset.assetId
              }</span>
              <span style="font-family: monospace; font-weight: bold; font-size: 10px; color: ${color}; background: ${bgSoft}; padding: 2px 6px; border-radius: 9999px;">Health: ${
          asset.currentHealthScore
        }/100</span>
            </div>
            <div style="font-weight: bold; font-size: 13px; color: #111827; margin-bottom: 2px;">${
              asset.assetName
            }</div>
            <div style="color: #6b7280; font-size: 11px; margin-bottom: 6px;">${
              asset.location
            } &bull; ${asset.department}</div>
            <div style="background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 6px; padding: 6px; font-size: 11px; margin-bottom: 8px;">
              <div style="display: flex; justify-content: space-between; margin-bottom: 2px;">
                <span style="color: #6b7280;">Spent to date:</span>
                <span style="font-family: monospace; font-weight: bold;">₹${asset.totalMaintenanceCost.toLocaleString(
                  'en-IN'
                )}</span>
              </div>
              <div style="display: flex; justify-content: space-between;">
                <span style="color: #6b7280;">Advice:</span>
                <span style="font-weight: bold; color: ${
                  asset.recommendation.action.startsWith('REPLACE')
                    ? '#b45309'
                    : '#15803d'
                }">${asset.recommendation.action.replace('_', ' ')}</span>
              </div>
            </div>
            <button id="dna-btn-${
              asset.assetId
            }" style="width: 100%; background: #18181b; color: white; border: none; border-radius: 6px; padding: 6px 10px; font-weight: 600; font-size: 11px; cursor: pointer;">
              View Civic DNA Profile →
            </button>
          </div>
        `;

        marker.bindPopup(popupHtml, { maxWidth: 280 });
        marker.on('popupopen', () => {
          const btn = document.getElementById(`dna-btn-${asset.assetId}`);
          if (btn) {
            btn.onclick = () => {
              openAssetProfile(asset.assetId);
            };
          }
        });

        marker.addTo(map);
        assetMarkersRef.current[asset.assetId] = marker;
      });
    }

    /* ---------------- Selected incident ---------------- */

    if (
      selectedIncidentId &&
      markersRef.current[selectedIncidentId]
    ) {
      const selected = incidents.find(
        (i) => i.id === selectedIncidentId
      );

      if (selected) {
        map.flyTo(
          [selected.latitude, selected.longitude],
          Math.max(map.getZoom(), 14),
          {
            animate: true,
            duration: 0.45,
          }
        );

        markersRef.current[selectedIncidentId].openPopup();
      }
    }
  }, [
    incidents,
    assets,
    showAssets,
    selectedIncidentId,
    selectedAssetId,
    variant,
    userLocationKey,
    onSelectIncident,
    selectIncident,
    openAssetProfile,
    cartoApiKey,
  ]);

  /* ---------------- Citizen: user location ---------------- */

  useEffect(() => {
    const map = mapInstanceRef.current;

    if (!map || !userLocation) return;

    const icon = L.divIcon({
      html: `
        <div
          style="
            transform: translate(-50%, -50%);
            position: relative;
          "
        >

          <div
            class="marker-pulse"
            style="
              position: absolute;
              inset: -8px;
              border-radius: 50%;
              background: rgba(36, 99, 143, 0.25);
            "
          ></div>

          <div style="
            width: 16px;
            height: 16px;
            border-radius: 50%;
            background: #24638F;
            border: 2.5px solid #FFFFFF;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.35);
          "></div>

        </div>
      `,
      className: 'custom-civic-marker',
      iconSize: [16, 16],
    });

    const marker = L.marker(userLocation, {
      icon,
    }).addTo(map);

    marker.bindTooltip('Your approximate location', {
      direction: 'top',
      offset: [0, -10],
    });

    return () => {
      marker.remove();
    };

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userLocationKey]);

  /* ---------------- Citizen: focus target ---------------- */

  useEffect(() => {
    const map = mapInstanceRef.current;

    if (!map || !focusKey) return;

    const [lat, lng] = focusKey
      .split(',')
      .map(Number);

    map.flyTo(
      [lat, lng],
      Math.max(map.getZoom(), 14),
      {
        animate: true,
        duration: 0.6,
      }
    );
  }, [focusKey]);

  /* ---------------- Resize handling ---------------- */

  useEffect(() => {
    const element = mapContainerRef.current;
    const map = mapInstanceRef.current;

    if (!element || !map) return;

    const observer = new ResizeObserver(() =>
      map.invalidateSize({
        animate: false,
      })
    );

    observer.observe(element);

    requestAnimationFrame(() =>
      map.invalidateSize({
        animate: false,
      })
    );

    return () => observer.disconnect();
  }, []);

  /* ---------------- UI ---------------- */

  return (
    <div
      className={`relative w-full min-w-0 min-h-0 rounded-xl overflow-hidden border border-[#E5E3DC] shadow-xs ${className}`}
      style={{ height }}
    >
      {/* Map Element */}

      <div
        ref={mapContainerRef}
        className="absolute inset-0"
        style={{
          width: '100%',
        }}
      />

      {/* Map Legend Overlay */}

      {isCitizen ? (
        <div
          className="
            absolute
            bottom-3
            left-3
            z-[1000]
            bg-white/95
            backdrop-blur-md
            px-3
            py-2
            rounded-lg
            border
            border-[#E5E3DC]
            shadow-md
            text-left
            text-xs
            flex
            flex-wrap
            items-center
            gap-2.5
          "
        >
          <span
            className="
              font-bold
              text-[10px]
              text-[#7E8592]
              uppercase
              tracking-wider
            "
          >
            Public issues:
          </span>

          <div className="flex items-center gap-1.5 text-[11px]">
            <span className="w-2.5 h-2.5 rounded-full bg-[#4E5D6C]"></span>
            <span>Reported</span>
          </div>

          <div className="flex items-center gap-1.5 text-[11px]">
            <span className="w-2.5 h-2.5 rounded-full bg-[#24638F]"></span>
            <span>Assigned</span>
          </div>

          <div className="flex items-center gap-1.5 text-[11px]">
            <span className="w-2.5 h-2.5 rounded-full bg-[#2F6355]"></span>
            <span>In Progress</span>
          </div>

          <div className="flex items-center gap-1.5 text-[11px]">
            <span className="w-2.5 h-2.5 rounded-full bg-[#1E6B42]"></span>
            <span>Resolved</span>
          </div>
        </div>
      ) : (
        <div
          className="
            absolute
            bottom-3
            left-3
            z-[1000]
            bg-white/95
            backdrop-blur-md
            px-3
            py-2
            rounded-lg
            border
            border-[#E5E3DC]
            shadow-md
            text-left
            text-xs
            flex
            flex-wrap
            items-center
            gap-3
          "
        >
          <span
            className="
              font-bold
              text-[10px]
              text-[#7E8592]
              uppercase
              tracking-wider
            "
          >
            Signal Legend:
          </span>

          <div className="flex items-center gap-1.5 text-[11px]">
            <span className="w-2.5 h-2.5 rounded-full bg-[#C54E38]"></span>
            <span>
              Critical / High Risk (&ge;70)
            </span>
          </div>

          <div className="flex items-center gap-1.5 text-[11px]">
            <span className="w-2.5 h-2.5 rounded-full bg-[#C88427]"></span>
            <span>
              Medium Risk (50-69)
            </span>
          </div>

          <div className="flex items-center gap-1.5 text-[11px]">
            <span className="w-2.5 h-2.5 rounded-full border border-dashed border-[#C88427]"></span>
            <span>Recurring Hotspot</span>
          </div>
        </div>
      )}
    </div>
  );
};