import React, { useState, useRef, useMemo } from 'react';
import { TrackPoint } from '../types/workout';
import { formatPace, formatDuration } from '../utils/parsers';
import { Activity, Heart, Mountain, Zap } from 'lucide-react';

interface TelemetryChartProps {
  trackPoints: TrackPoint[];
  distanceUnit: 'km' | 'mi';
  activeIndex: number | null;
  onHoverIndex: (index: number | null) => void;
}

export const TelemetryChart: React.FC<TelemetryChartProps> = ({
  trackPoints,
  distanceUnit,
  activeIndex,
  onHoverIndex,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [showPace, setShowPace] = useState(true);
  const [showHr, setShowHr] = useState(true);
  const [showElevation, setShowElevation] = useState(true);
  const [showCadence, setShowCadence] = useState(false);

  // Filter valid points
  const points = trackPoints;
  const n = points.length;

  const unitMultiplier = distanceUnit === 'mi' ? 0.621371 : 1.0;
  const unitLabel = distanceUnit;

  // Compute extents
  const { minElev, maxElev, minHr, maxHr, minPace, maxPace, minCad, maxCad, totalDist } = useMemo(() => {
    if (n === 0) {
      return { minElev: 0, maxElev: 100, minHr: 100, maxHr: 180, minPace: 240, maxPace: 400, minCad: 150, maxCad: 190, totalDist: 1 };
    }

    let minE = Infinity, maxE = -Infinity;
    let minH = Infinity, maxH = -Infinity;
    let minP = Infinity, maxP = -Infinity;
    let minC = Infinity, maxC = -Infinity;

    for (const p of points) {
      if (p.elevationM !== undefined) {
        if (p.elevationM < minE) minE = p.elevationM;
        if (p.elevationM > maxE) maxE = p.elevationM;
      }
      if (p.heartRate) {
        if (p.heartRate < minH) minH = p.heartRate;
        if (p.heartRate > maxH) maxH = p.heartRate;
      }
      if (p.paceSecKm && p.paceSecKm > 100 && p.paceSecKm < 900) {
        if (p.paceSecKm < minP) minP = p.paceSecKm;
        if (p.paceSecKm > maxP) maxP = p.paceSecKm;
      }
      if (p.cadence && p.cadence > 100) {
        if (p.cadence < minC) minC = p.cadence;
        if (p.cadence > maxC) maxC = p.cadence;
      }
    }

    const dist = points[n - 1]?.distanceKm ?? 1;

    return {
      minElev: Math.floor(minE === Infinity ? 0 : Math.max(0, minE - 5)),
      maxElev: Math.ceil(maxE === -Infinity ? 50 : maxE + 5),
      minHr: Math.floor(minH === Infinity ? 120 : minH - 5),
      maxHr: Math.ceil(maxH === -Infinity ? 180 : maxH + 5),
      // Pace: inverted axis where lower sec/km is higher on graph
      minPace: Math.max(120, Math.floor(minP === Infinity ? 240 : minP - 15)),
      maxPace: Math.min(800, Math.ceil(maxP === -Infinity ? 420 : maxP + 15)),
      minCad: Math.floor(minC === Infinity ? 160 : minC - 4),
      maxCad: Math.ceil(maxC === -Infinity ? 190 : maxC + 4),
      totalDist: dist,
    };
  }, [points, n]);

  // Width and height for SVG coordinate system
  const svgWidth = 800;
  const svgHeight = 240;
  const padding = { top: 20, right: 20, bottom: 25, left: 20 };
  const plotWidth = svgWidth - padding.left - padding.right;
  const plotHeight = svgHeight - padding.top - padding.bottom;

  // Path generators
  const elevationPath = useMemo(() => {
    if (!showElevation || n === 0) return { path: '', area: '' };
    const range = Math.max(1, maxElev - minElev);
    const coords: [number, number][] = points.map((p, i) => {
      const x = padding.left + (p.distanceKm / totalDist) * plotWidth;
      const elev = p.elevationM ?? minElev;
      const y = padding.top + plotHeight - ((elev - minElev) / range) * (plotHeight * 0.45);
      return [x, y];
    });

    const line = coords.reduce((acc, [x, y], idx) => (idx === 0 ? `M ${x} ${y}` : `${acc} L ${x} ${y}`), '');
    const firstX = coords[0][0];
    const lastX = coords[coords.length - 1][0];
    const bottomY = padding.top + plotHeight;
    const area = `${line} L ${lastX} ${bottomY} L ${firstX} ${bottomY} Z`;

    return { path: line, area };
  }, [showElevation, points, n, maxElev, minElev, totalDist, plotWidth, plotHeight]);

  const hrPath = useMemo(() => {
    if (!showHr || n === 0) return '';
    const range = Math.max(1, maxHr - minHr);
    const coords: [number, number][] = points.map(p => {
      const x = padding.left + (p.distanceKm / totalDist) * plotWidth;
      const hr = p.heartRate ?? minHr;
      const y = padding.top + plotHeight - ((hr - minHr) / range) * (plotHeight * 0.85);
      return [x, y];
    });

    return coords.reduce((acc, [x, y], idx) => (idx === 0 ? `M ${x} ${y}` : `${acc} L ${x} ${y}`), '');
  }, [showHr, points, n, maxHr, minHr, totalDist, plotWidth, plotHeight]);

  const pacePath = useMemo(() => {
    if (!showPace || n === 0) return '';
    const range = Math.max(1, maxPace - minPace);
    const coords: [number, number][] = points.map(p => {
      const x = padding.left + (p.distanceKm / totalDist) * plotWidth;
      const pace = Math.max(minPace, Math.min(maxPace, p.paceSecKm || 300));
      // Invert pace so faster (lower seconds) is higher on graph
      const y = padding.top + ((pace - minPace) / range) * (plotHeight * 0.85);
      return [x, y];
    });

    return coords.reduce((acc, [x, y], idx) => (idx === 0 ? `M ${x} ${y}` : `${acc} L ${x} ${y}`), '');
  }, [showPace, points, n, maxPace, minPace, totalDist, plotWidth, plotHeight]);

  const cadencePath = useMemo(() => {
    if (!showCadence || n === 0) return '';
    const range = Math.max(1, maxCad - minCad);
    const coords: [number, number][] = points.map(p => {
      const x = padding.left + (p.distanceKm / totalDist) * plotWidth;
      const cad = p.cadence ?? minCad;
      const y = padding.top + plotHeight - ((cad - minCad) / range) * (plotHeight * 0.7);
      return [x, y];
    });

    return coords.reduce((acc, [x, y], idx) => (idx === 0 ? `M ${x} ${y}` : `${acc} L ${x} ${y}`), '');
  }, [showCadence, points, n, maxCad, minCad, totalDist, plotWidth, plotHeight]);

  // Handle scrubber
  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!containerRef.current || n === 0) return;
    const rect = containerRef.current.getBoundingClientRect();
    const clientX = e.clientX - rect.left;
    const svgFraction = Math.max(0, Math.min(1, (clientX - padding.left) / plotWidth));
    const targetDist = svgFraction * totalDist;

    // Find nearest point
    let nearestIdx = 0;
    let minDiff = Infinity;
    for (let i = 0; i < n; i++) {
      const diff = Math.abs(points[i].distanceKm - targetDist);
      if (diff < minDiff) {
        minDiff = diff;
        nearestIdx = i;
      }
    }
    onHoverIndex(nearestIdx);
  };

  const handleMouseLeave = () => {
    onHoverIndex(null);
  };

  const currentPt = activeIndex !== null && points[activeIndex] ? points[activeIndex] : null;
  const scrubberX = currentPt ? padding.left + (currentPt.distanceKm / totalDist) * plotWidth : null;

  return (
    <div className="flex flex-col rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 transition-colors">
      {/* Top Header & Metric Series Toggles */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Telemetry Graph
          </span>
          <span className="text-slate-300 dark:text-slate-700">·</span>
          <span className="text-xs text-slate-500 dark:text-slate-400">
            Distance-Linked Scrubber
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowPace(!showPace)}
            className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
              showPace
                ? 'bg-cyan-50 text-cyan-700 dark:bg-cyan-950/60 dark:text-cyan-300 border border-cyan-200 dark:border-cyan-800'
                : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
            }`}
          >
            <Zap className="h-3.5 w-3.5 text-cyan-500" />
            <span>Pace</span>
          </button>

          <button
            onClick={() => setShowHr(!showHr)}
            className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
              showHr
                ? 'bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-200 dark:border-rose-800'
                : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
            }`}
          >
            <Heart className="h-3.5 w-3.5 text-rose-500" />
            <span>Heart Rate</span>
          </button>

          <button
            onClick={() => setShowElevation(!showElevation)}
            className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
              showElevation
                ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200 dark:border-amber-800'
                : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
            }`}
          >
            <Mountain className="h-3.5 w-3.5 text-amber-500" />
            <span>Elevation</span>
          </button>

          <button
            onClick={() => setShowCadence(!showCadence)}
            className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
              showCadence
                ? 'bg-purple-50 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300 border border-purple-200 dark:border-purple-800'
                : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
            }`}
          >
            <Activity className="h-3.5 w-3.5 text-purple-500" />
            <span>Cadence</span>
          </button>
        </div>
      </div>

      {/* Instantaneous HUD readout strip */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 py-3 text-xs border-b border-slate-100 dark:border-slate-800/80">
        <div>
          <span className="text-slate-400 block text-[11px]">Split Distance</span>
          <span className="font-mono font-semibold tabular-nums text-slate-800 dark:text-slate-200 text-sm">
            {currentPt ? (currentPt.distanceKm * unitMultiplier).toFixed(2) : (totalDist * unitMultiplier).toFixed(2)} {unitLabel}
          </span>
        </div>
        <div>
          <span className="text-slate-400 block text-[11px]">Elapsed Time</span>
          <span className="font-mono font-semibold tabular-nums text-slate-800 dark:text-slate-200 text-sm">
            {currentPt ? formatDuration(currentPt.time) : formatDuration(points[n - 1]?.time || 0)}
          </span>
        </div>
        <div>
          <span className="text-cyan-600 dark:text-cyan-400 block text-[11px] font-medium">Instant Pace</span>
          <span className="font-mono font-semibold tabular-nums text-cyan-600 dark:text-cyan-400 text-sm">
            {currentPt ? formatPace(currentPt.paceSecKm, distanceUnit) : '--:--'}
          </span>
        </div>
        <div>
          <span className="text-rose-600 dark:text-rose-400 block text-[11px] font-medium">Heart Rate</span>
          <span className="font-mono font-semibold tabular-nums text-rose-600 dark:text-rose-400 text-sm">
            {currentPt?.heartRate ? `${currentPt.heartRate} bpm` : '154 bpm'}
          </span>
        </div>
        <div>
          <span className="text-amber-600 dark:text-amber-400 block text-[11px] font-medium">Elevation</span>
          <span className="font-mono font-semibold tabular-nums text-amber-600 dark:text-amber-400 text-sm">
            {currentPt?.elevationM !== undefined ? `${currentPt.elevationM} m` : `${minElev} m`}
          </span>
        </div>
      </div>

      {/* SVG Canvas */}
      <div ref={containerRef} className="relative mt-2 h-60 w-full select-none cursor-crosshair">
        <svg
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
          className="h-full w-full overflow-visible"
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
        >
          <defs>
            {/* Elevation gradient */}
            <linearGradient id="elevGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.25" />
              <stop offset="100%" stopColor="#f59e0b" stopOpacity="0.02" />
            </linearGradient>

            {/* Horizontal Grid lines */}
            <pattern id="gridPattern" width="100" height="40" patternUnits="userSpaceOnUse">
              <line x1="0" y1="40" x2="100" y2="40" stroke="currentColor" strokeOpacity="0.05" />
            </pattern>
          </defs>

          {/* Grid Background */}
          <rect
            x={padding.left}
            y={padding.top}
            width={plotWidth}
            height={plotHeight}
            fill="url(#gridPattern)"
            className="text-slate-900 dark:text-slate-100"
          />

          {/* Elevation Fill & Stroke */}
          {showElevation && elevationPath.area && (
            <>
              <path d={elevationPath.area} fill="url(#elevGrad)" />
              <path
                d={elevationPath.path}
                fill="none"
                stroke="#d97706"
                strokeWidth="1.5"
                strokeLinecap="round"
                className="opacity-80"
              />
            </>
          )}

          {/* Cadence Path */}
          {showCadence && cadencePath && (
            <path
              d={cadencePath}
              fill="none"
              stroke="#8b5cf6"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeDasharray="3 3"
              className="opacity-75"
            />
          )}

          {/* Heart Rate Path */}
          {showHr && hrPath && (
            <path
              d={hrPath}
              fill="none"
              stroke="#f43f5e"
              strokeWidth="2"
              strokeLinecap="round"
              className="drop-shadow-sm"
            />
          )}

          {/* Pace Path */}
          {showPace && pacePath && (
            <path
              d={pacePath}
              fill="none"
              stroke="#06b6d4"
              strokeWidth="2"
              strokeLinecap="round"
              className="drop-shadow-sm"
            />
          )}

          {/* Distance Axis Ticks at bottom */}
          {[0, 0.25, 0.5, 0.75, 1].map((pct, i) => {
            const x = padding.left + pct * plotWidth;
            const distVal = (pct * totalDist * unitMultiplier).toFixed(1);
            return (
              <g key={i}>
                <line
                  x1={x}
                  y1={padding.top + plotHeight}
                  x2={x}
                  y2={padding.top + plotHeight + 5}
                  stroke="currentColor"
                  strokeOpacity="0.2"
                  className="text-slate-400"
                />
                <text
                  x={x}
                  y={padding.top + plotHeight + 16}
                  textAnchor={i === 0 ? 'start' : i === 4 ? 'end' : 'middle'}
                  className="fill-slate-400 text-[10px] font-mono tabular-nums"
                >
                  {distVal} {unitLabel}
                </text>
              </g>
            );
          })}

          {/* Scrubber vertical line & point indicator */}
          {scrubberX !== null && (
            <g>
              <line
                x1={scrubberX}
                y1={padding.top}
                x2={scrubberX}
                y2={padding.top + plotHeight}
                stroke="#f97316"
                strokeWidth="1.5"
                strokeDasharray="2 2"
              />
              <circle cx={scrubberX} cy={padding.top + 6} r="3.5" fill="#f97316" />
            </g>
          )}
        </svg>
      </div>
    </div>
  );
};
