import React, { useMemo, useState } from 'react';
import { TrackPoint } from '../types/workout';
import { MapPin, Navigation, Compass } from 'lucide-react';

interface RouteVisualizerProps {
  trackPoints: TrackPoint[];
  activeIndex: number | null;
  distanceUnit: 'km' | 'mi';
}

export const RouteVisualizer: React.FC<RouteVisualizerProps> = ({
  trackPoints,
  activeIndex,
  distanceUnit,
}) => {
  const [colorMode, setColorMode] = useState<'pace' | 'hr'>('pace');

  // Filter valid coordinates
  const validPoints = useMemo(() => {
    return trackPoints.filter(p => p.lat !== undefined && p.lon !== undefined && !isNaN(p.lat) && !isNaN(p.lon));
  }, [trackPoints]);

  const n = validPoints.length;

  // Compute map bounds
  const bounds = useMemo(() => {
    if (n === 0) return { minLat: 0, maxLat: 1, minLon: 0, maxLon: 1, centerLat: 0.5, centerLon: 0.5 };

    let minLat = Infinity, maxLat = -Infinity;
    let minLon = Infinity, maxLon = -Infinity;

    for (const p of validPoints) {
      if (p.lat! < minLat) minLat = p.lat!;
      if (p.lat! > maxLat) maxLat = p.lat!;
      if (p.lon! < minLon) minLon = p.lon!;
      if (p.lon! > maxLon) maxLon = p.lon!;
    }

    // Add padding margin
    const latSpan = Math.max(0.002, maxLat - minLat);
    const lonSpan = Math.max(0.002, maxLon - minLon);

    return {
      minLat: minLat - latSpan * 0.1,
      maxLat: maxLat + latSpan * 0.1,
      minLon: minLon - lonSpan * 0.1,
      maxLon: maxLon + lonSpan * 0.1,
      latSpan: latSpan * 1.2,
      lonSpan: lonSpan * 1.2,
    };
  }, [validPoints, n]);

  const svgWidth = 600;
  const svgHeight = 400;

  // Project lat/lon into SVG coordinates (Mercator-like approximation)
  const project = (lat: number, lon: number): [number, number] => {
    if (!bounds.latSpan || !bounds.lonSpan) return [svgWidth / 2, svgHeight / 2];
    const x = ((lon - bounds.minLon) / bounds.lonSpan) * svgWidth;
    // Invert Y because latitude increases northward while SVG Y increases downward
    const y = (1 - (lat - bounds.minLat) / bounds.latSpan) * svgHeight;
    return [Math.round(x * 10) / 10, Math.round(y * 10) / 10];
  };

  // Color segment helper
  const getSegmentColor = (pt: TrackPoint): string => {
    if (colorMode === 'hr') {
      const hr = pt.heartRate ?? 150;
      if (hr < 125) return '#3b82f6'; // Zone 1 (Blue)
      if (hr < 145) return '#10b981'; // Zone 2 (Green)
      if (hr < 160) return '#f59e0b'; // Zone 3 (Amber)
      if (hr < 175) return '#f97316'; // Zone 4 (Orange)
      return '#ef4444'; // Zone 5 (Red)
    } else {
      // Color by pace: faster is cyan/indigo, slower is orange/amber
      const pace = pt.paceSecKm || 300;
      if (pace < 240) return '#6366f1'; // Fast (< 4:00)
      if (pace < 270) return '#06b6d4'; // (4:00 - 4:30)
      if (pace < 300) return '#10b981'; // (4:30 - 5:00)
      if (pace < 340) return '#f59e0b'; // (5:00 - 5:40)
      return '#f97316'; // (> 5:40)
    }
  };

  // Compute 1km / 1mi checkpoints along route
  const checkpoints = useMemo(() => {
    if (n < 2) return [];
    const unitStep = distanceUnit === 'mi' ? 1.60934 : 1.0;
    const markers: { point: TrackPoint; label: string; x: number; y: number }[] = [];
    let nextDist = unitStep;
    let markCount = 1;

    for (const p of validPoints) {
      if (p.distanceKm >= nextDist) {
        const [x, y] = project(p.lat!, p.lon!);
        markers.push({
          point: p,
          label: `${markCount}`,
          x,
          y,
        });
        markCount++;
        nextDist += unitStep;
      }
    }
    return markers;
  }, [validPoints, n, distanceUnit, bounds]);

  // Current active point marker for scrubber
  const activePt = activeIndex !== null && validPoints[activeIndex] ? validPoints[activeIndex] : null;
  const activePos = activePt ? project(activePt.lat!, activePt.lon!) : null;

  // Start & Finish points
  const startPt = validPoints[0];
  const finishPt = validPoints[n - 1];
  const startPos = startPt ? project(startPt.lat!, startPt.lon!) : null;
  const finishPos = finishPt ? project(finishPt.lat!, finishPt.lon!) : null;

  if (n < 2) {
    return (
      <div className="flex h-64 flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center dark:border-slate-800 dark:bg-slate-900/50">
        <Compass className="h-8 w-8 text-slate-400 mb-2" />
        <p className="text-xs font-medium text-slate-500">No GPS route data recorded for this indoor workout.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 transition-colors">
      {/* Route header & Color Mode Switcher */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
        <div className="flex items-center gap-2">
          <Navigation className="h-4 w-4 text-orange-500" />
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            GPS Route Trace
          </span>
          <span className="text-slate-300 dark:text-slate-700">·</span>
          <span className="text-xs text-slate-500 dark:text-slate-400">
            {checkpoints.length} {distanceUnit.toUpperCase()} checkpoints
          </span>
        </div>

        {/* Heatmap Toggle */}
        <div className="flex items-center gap-1 p-0.5 rounded-lg bg-slate-100 dark:bg-slate-800">
          <button
            onClick={() => setColorMode('pace')}
            className={`px-2 py-1 text-[11px] font-medium rounded-md transition-colors ${
              colorMode === 'pace'
                ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-900 dark:text-white'
                : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
            }`}
          >
            Pace Heat
          </button>
          <button
            onClick={() => setColorMode('hr')}
            className={`px-2 py-1 text-[11px] font-medium rounded-md transition-colors ${
              colorMode === 'hr'
                ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-900 dark:text-white'
                : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
            }`}
          >
            HR Zones
          </button>
        </div>
      </div>

      {/* SVG Map Canvas */}
      <div className="relative mt-3 h-72 w-full overflow-hidden rounded-lg bg-slate-950">
        {/* Subtle Map Grid Lines */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#1e293b_1px,transparent_1px),linear-gradient(to_bottom,#1e293b_1px,transparent_1px)] bg-[size:24px_24px] opacity-40" />

        <svg viewBox={`0 0 ${svgWidth} ${svgHeight}`} className="h-full w-full">
          {/* Shadow track for contrast */}
          <path
            d={validPoints.reduce((acc, p, idx) => {
              const [x, y] = project(p.lat!, p.lon!);
              return idx === 0 ? `M ${x} ${y}` : `${acc} L ${x} ${y}`;
            }, '')}
            fill="none"
            stroke="#0f172a"
            strokeWidth="6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Color-coded segments along route */}
          {validPoints.map((p, i) => {
            if (i === 0) return null;
            const prev = validPoints[i - 1];
            const [x1, y1] = project(prev.lat!, prev.lon!);
            const [x2, y2] = project(p.lat!, p.lon!);
            const strokeColor = getSegmentColor(p);

            return (
              <line
                key={i}
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                stroke={strokeColor}
                strokeWidth="3.5"
                strokeLinecap="round"
              />
            );
          })}

          {/* Kilometer markers */}
          {checkpoints.map((cp, idx) => (
            <g key={idx} transform={`translate(${cp.x}, ${cp.y})`}>
              <circle r="7" fill="#0f172a" stroke="#cbd5e1" strokeWidth="1.5" />
              <text
                y="3"
                textAnchor="middle"
                className="fill-white text-[8px] font-bold font-mono"
              >
                {cp.label}
              </text>
            </g>
          ))}

          {/* Start Point Marker */}
          {startPos && (
            <g transform={`translate(${startPos[0]}, ${startPos[1]})`}>
              <circle r="9" fill="#10b981" stroke="#ffffff" strokeWidth="2" />
              <text y="3.5" textAnchor="middle" className="fill-white text-[9px] font-bold">
                S
              </text>
            </g>
          )}

          {/* Finish Point Marker */}
          {finishPos && (
            <g transform={`translate(${finishPos[0]}, ${finishPos[1]})`}>
              <circle r="9" fill="#f97316" stroke="#ffffff" strokeWidth="2" />
              <text y="3.5" textAnchor="middle" className="fill-white text-[9px] font-bold">
                F
              </text>
            </g>
          )}

          {/* Scrubber synchronized position dot */}
          {activePos && (
            <g transform={`translate(${activePos[0]}, ${activePos[1]})`}>
              <circle r="12" fill="#38bdf8" fillOpacity="0.4" className="animate-ping" />
              <circle r="6" fill="#38bdf8" stroke="#ffffff" strokeWidth="2" />
            </g>
          )}
        </svg>

        {/* Legend Overlay */}
        <div className="absolute bottom-2 left-2 rounded-md bg-slate-900/85 backdrop-blur-xs px-2.5 py-1 text-[10px] text-slate-300 flex items-center gap-3 border border-slate-800">
          <div className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-emerald-500 inline-block" />
            <span>Start</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-orange-500 inline-block" />
            <span>Finish</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-cyan-400 inline-block" />
            <span>Scrubber Sync</span>
          </div>
        </div>
      </div>
    </div>
  );
};
