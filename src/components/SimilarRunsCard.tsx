import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Workout, GarminCloudAccount } from '../types/workout';
import { findSimilarWorkouts } from '../utils/similarityEngine';
import { formatPace, formatDuration, getUniformSplits } from '../utils/parsers';
import {
  TrendingUp,
  Award,
  Calendar,
  ArrowRight,
  Zap,
  Heart,
  CheckCircle2,
  LineChart,
  Clock,
  Sparkles,
  Filter,
  X,
  Trophy,
  RefreshCw,
} from 'lucide-react';

interface SimilarRunsCardProps {
  currentWorkout: Workout;
  allWorkouts: Workout[];
  distanceUnit: 'km' | 'mi';
  onSelectWorkout?: (workoutId: string) => void;
  onHydrateWorkout?: (workout: Workout) => Promise<Workout>;
  cloudAccount?: GarminCloudAccount;
}

export const SimilarRunsCard: React.FC<SimilarRunsCardProps> = ({
  currentWorkout,
  allWorkouts,
  distanceUnit,
  onSelectWorkout,
  onHydrateWorkout,
  cloudAccount,
}) => {
  const unitMultiplier = distanceUnit === 'mi' ? 0.621371 : 1.0;
  const unitLabel = distanceUnit;

  // Filter options for baseline candidate runs
  const [timeFilter, setTimeFilter] = useState<'week' | 'month' | 'all'>('month');
  const [selectedYear, setSelectedYear] = useState<string>('all');
  const [jumpDate, setJumpDate] = useState<string>('');
  const [racesOnly, setRacesOnly] = useState<boolean>(false);

  // Line graph metric mode: 'pace' vs 'hr' (Requirement: keep graph as a line graph)
  const [metricMode, setMetricMode] = useState<'pace' | 'hr'>('pace');
  const [hoveredSplitIndex, setHoveredSplitIndex] = useState<number | null>(null);
  const chartRef = useRef<SVGSVGElement>(null);

  // Available unique years in history
  const availableYears = useMemo(() => {
    const years = new Set<string>();
    allWorkouts.forEach(w => {
      const y = new Date(w.date).getFullYear().toString();
      if (y && !isNaN(Number(y))) years.add(y);
    });
    return Array.from(years).sort((a, b) => Number(b) - Number(a));
  }, [allWorkouts]);

  // Candidate runs excluding the current workout based on filters
  const candidateRuns = useMemo(() => {
    const currentMs = new Date(currentWorkout.date).getTime();
    const otherWorkouts = allWorkouts.filter(w => w.id !== currentWorkout.id);

    return otherWorkouts.filter(w => {
      const wDate = new Date(w.date);
      const wMs = wDate.getTime();
      const diffDays = Math.abs(currentMs - wMs) / (1000 * 60 * 60 * 24);

      // Timeframe filter (only if year and jumpDate are not explicitly active)
      if (timeFilter === 'week' && selectedYear === 'all' && !jumpDate) {
        if (diffDays > 8) return false;
      }
      if (timeFilter === 'month' && selectedYear === 'all' && !jumpDate) {
        if (diffDays > 35) return false;
      }

      // Year filter
      if (selectedYear !== 'all') {
        if (wDate.getFullYear().toString() !== selectedYear) return false;
      }

      // Jump Date filter (within ~30 days of the requested jump date)
      if (jumpDate) {
        const jMs = new Date(jumpDate).getTime();
        const dateDeltaDays = Math.abs(wMs - jMs) / (1000 * 60 * 60 * 24);
        if (dateDeltaDays > 30) return false;
      }

      // Races only filter
      if (racesOnly) {
        const isRace =
          w.type === 'race' ||
          w.title?.toLowerCase().includes('marathon') ||
          w.title?.toLowerCase().includes('race') ||
          w.title?.toLowerCase().includes('10k') ||
          w.title?.toLowerCase().includes('5k') ||
          w.title?.toLowerCase().includes('trot');
        if (!isRace) return false;
      }

      return true;
    }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [currentWorkout, allWorkouts, timeFilter, selectedYear, jumpDate, racesOnly]);

  // Find smart similarity matches
  const smartMatches = useMemo(() => {
    return findSimilarWorkouts(currentWorkout, allWorkouts);
  }, [currentWorkout, allWorkouts]);

  // Selected Baseline Run state
  const [selectedBaselineId, setSelectedBaselineId] = useState<string>(() => {
    if (smartMatches.length > 0) return smartMatches[0].workout.id;
    const past = allWorkouts.filter(w => w.id !== currentWorkout.id);
    return past[0]?.id || '';
  });

  // Effective Baseline Workout
  const prevWorkout = useMemo(() => {
    const foundInCandidates = candidateRuns.find(w => w.id === selectedBaselineId);
    if (foundInCandidates) return foundInCandidates;
    const foundInAll = allWorkouts.find(w => w.id === selectedBaselineId);
    if (foundInAll && foundInAll.id !== currentWorkout.id) return foundInAll;
    if (candidateRuns.length > 0) return candidateRuns[0];
    if (smartMatches.length > 0) return smartMatches[0].workout;
    return allWorkouts.find(w => w.id !== currentWorkout.id);
  }, [allWorkouts, selectedBaselineId, smartMatches, candidateRuns, currentWorkout.id]);

  // Check if either current run or selected baseline run needs granular telemetry hydration
  const isCurrentNeedsHydration = useMemo(() => {
    const validSplits = (currentWorkout.splits || []).filter(s => s && s.paceSecKm >= 120 && s.paceSecKm <= 1200);
    const ptsCount = (currentWorkout.trackPoints || []).length;
    return (currentWorkout.source === 'garmin_cloud' || currentWorkout.id.startsWith('garmin_')) && validSplits.length < 2 && ptsCount < 5;
  }, [currentWorkout]);

  const isPrevNeedsHydration = useMemo(() => {
    if (!prevWorkout) return false;
    const validSplits = (prevWorkout.splits || []).filter(s => s && s.paceSecKm >= 120 && s.paceSecKm <= 1200);
    const ptsCount = (prevWorkout.trackPoints || []).length;
    return (prevWorkout.source === 'garmin_cloud' || prevWorkout.id.startsWith('garmin_')) && validSplits.length < 2 && ptsCount < 5;
  }, [prevWorkout]);

  const [isHydrating, setIsHydrating] = useState(false);
  const [hydrationNotice, setHydrationNotice] = useState<string | null>(null);
  const hydratedIdsRef = useRef<Set<string>>(new Set());

  // Automatic background hydration for authentic Garmin activities
  useEffect(() => {
    if (!onHydrateWorkout) return;
    const targets: Workout[] = [];
    if (isCurrentNeedsHydration && !hydratedIdsRef.current.has(currentWorkout.id)) {
      targets.push(currentWorkout);
    }
    if (prevWorkout && isPrevNeedsHydration && !hydratedIdsRef.current.has(prevWorkout.id)) {
      targets.push(prevWorkout);
    }

    if (targets.length === 0) return;

    targets.forEach(t => hydratedIdsRef.current.add(t.id));
    setIsHydrating(true);
    setHydrationNotice('Retrieving authentic granular telemetry from Garmin Connect...');

    Promise.all(targets.map(t => onHydrateWorkout(t)))
      .catch(err => console.warn('[SimilarRunsCard] Auto-hydration error:', err))
      .finally(() => {
        setIsHydrating(false);
        setHydrationNotice(null);
      });
  }, [currentWorkout.id, prevWorkout?.id, isCurrentNeedsHydration, isPrevNeedsHydration, onHydrateWorkout]);

  if (!prevWorkout) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900 transition-colors">
        <div className="flex items-center gap-2 mb-2">
          <TrendingUp className="h-4 w-4 text-orange-500" />
          <h4 className="text-sm font-semibold text-slate-900 dark:text-white">
            Historical Progress Comparison
          </h4>
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
          Log or sync at least two runs to unlock side-by-side progression analysis.
        </p>
      </div>
    );
  }

  // Calculate relative days ago
  const currentMs = new Date(currentWorkout.date).getTime();
  const prevMs = new Date(prevWorkout.date).getTime();
  const relativeDaysAgo = Math.max(1, Math.round(Math.abs(currentMs - prevMs) / (1000 * 60 * 60 * 24)));

  // Pace delta format
  const paceDeltaSecKm = currentWorkout.avgPaceSecKm - prevWorkout.avgPaceSecKm;
  const paceFaster = paceDeltaSecKm < 0;
  const paceAbsSec = Math.abs(paceDeltaSecKm);
  const paceDeltaStr = `${paceFaster ? '-' : '+'}${paceAbsSec}s /${unitLabel}`;

  // HR delta format
  const currentHr = currentWorkout.avgHeartRate || 144;
  const prevHr = prevWorkout.avgHeartRate || 150;
  const hrDelta = currentHr - prevHr;
  const hrLower = hrDelta < 0;
  const hrAbs = Math.abs(hrDelta);
  const hrDeltaStr = `${hrLower ? '-' : '+'}${hrAbs} bpm`;

  // Aerobic Efficiency (Speed / HR)
  const currentSpeedKmh = currentWorkout.distanceKm / (currentWorkout.durationSec / 3600);
  const prevSpeedKmh = prevWorkout.distanceKm / (prevWorkout.durationSec / 3600);
  const currentEff = (currentSpeedKmh / currentHr) * 100;
  const prevEff = (prevSpeedKmh / prevHr) * 100;
  const effDelta = currentEff - prevEff;

  // COMPUTE UNIFORM SPLITS BASED ON MAXIMUM DISTANCE OF THE TWO RUNS
  const { comparePoints, maxSplitsCount, todaySplitsCount, prevSplitsCount } = useMemo(() => {
    const currentSplits = getUniformSplits(currentWorkout, distanceUnit);
    const prevSplits = getUniformSplits(prevWorkout, distanceUnit);

    const distToday = currentWorkout.distanceKm * unitMultiplier;
    const distPrev = prevWorkout.distanceKm * unitMultiplier;
    const maxDist = Math.max(distToday, distPrev);

    // Number of splits on the X-axis spans the full maximum distance
    const count = Math.max(currentSplits.length, prevSplits.length, Math.ceil(maxDist));
    const unitFactor = distanceUnit === 'mi' ? 1.609344 : 1.0;

    const items = [];

    for (let i = 0; i < count; i++) {
      const curr = currentSplits[i];
      const prev = prevSplits[i];

      const isCurrValid = curr !== undefined && curr.paceSecKm >= 120 && curr.paceSecKm <= 1200;
      const isPrevValid = prev !== undefined && prev.paceSecKm >= 120 && prev.paceSecKm <= 1200;

      const hasToday = curr !== undefined;
      const hasPrev = prev !== undefined;

      const currPaceSecKm = isCurrValid ? curr.paceSecKm : (currentWorkout.avgPaceSecKm || 300);
      const prevPaceSecKm = isPrevValid ? prev.paceSecKm : (prevWorkout.avgPaceSecKm || 300);

      const currPaceSecUnit = hasToday ? Math.round(currPaceSecKm * unitFactor) : 0;
      const prevPaceSecUnit = hasPrev ? Math.round(prevPaceSecKm * unitFactor) : 0;

      const currHr = hasToday ? (curr.avgHeartRate || currentWorkout.avgHeartRate || 144) : 0;
      const prevHrVal = hasPrev ? (prev.avgHeartRate || prevWorkout.avgHeartRate || 150) : 0;

      let deltaSec = 0;
      let isFaster = false;

      if (hasToday && hasPrev) {
        deltaSec = prevPaceSecUnit - currPaceSecUnit;
        isFaster = deltaSec > 0;
      }

      items.push({
        index: i,
        splitNumber: i + 1,
        label: `${distanceUnit === 'mi' ? 'Mi' : 'Km'} ${i + 1}`,
        hasToday,
        hasPrev,
        todayPaceSecKm: currPaceSecKm,
        todayPaceSecUnit: currPaceSecUnit,
        todayPaceFormatted: hasToday ? formatPace(currPaceSecKm, distanceUnit) : '--',
        todayHr: currHr,
        prevPaceSecKm: prevPaceSecKm,
        prevPaceSecUnit: prevPaceSecUnit,
        prevPaceFormatted: hasPrev ? formatPace(prevPaceSecKm, distanceUnit) : '--',
        prevHr: prevHrVal,
        deltaSec: Math.abs(deltaSec),
        isFaster,
      });
    }

    return {
      comparePoints: items,
      maxSplitsCount: count,
      todaySplitsCount: currentSplits.length,
      prevSplitsCount: prevSplits.length,
    };
  }, [currentWorkout, prevWorkout, distanceUnit, unitMultiplier]);

  // Chart dimensions & scaling
  const svgWidth = 740;
  const svgHeight = 220;
  const paddingLeft = 60;
  const paddingRight = 32;
  const paddingTop = 26;
  const paddingBottom = 40;
  const plotWidth = svgWidth - paddingLeft - paddingRight;
  const plotHeight = svgHeight - paddingTop - paddingBottom;

  // Y-Scale computation for Pace mode vs Heart Rate mode
  const { yMin, yMax, ySpan, yTicks } = useMemo(() => {
    if (metricMode === 'pace') {
      const activePaces = comparePoints
        .flatMap(p => [p.hasToday ? p.todayPaceSecUnit : null, p.hasPrev ? p.prevPaceSecUnit : null])
        .filter((p): p is number => p !== null && p >= 150);

      if (activePaces.length === 0) return { yMin: 360, yMax: 540, ySpan: 180, yTicks: [] };

      const minPace = Math.min(...activePaces);
      const maxPace = Math.max(...activePaces);

      // Inverted Y-axis: lower pace seconds (faster) is near the top
      const roundedMin = Math.max(120, Math.floor((minPace - 15) / 30) * 30);
      const roundedMax = Math.min(900, Math.ceil((maxPace + 15) / 30) * 30);
      const span = Math.max(60, roundedMax - roundedMin);

      const step = span > 240 ? 60 : 30;
      const ticks: number[] = [];
      for (let t = roundedMin; t <= roundedMax; t += step) {
        ticks.push(t);
      }

      return { yMin: roundedMin, yMax: roundedMax, ySpan: span, yTicks: ticks };
    } else {
      // Heart Rate mode (BPM, standard upright axis: higher HR is higher up)
      const activeHrs = comparePoints
        .flatMap(p => [p.hasToday ? p.todayHr : null, p.hasPrev ? p.prevHr : null])
        .filter((h): h is number => h !== null && h > 0);

      if (activeHrs.length === 0) return { yMin: 120, yMax: 180, ySpan: 60, yTicks: [120, 140, 160, 180] };

      const minHr = Math.min(...activeHrs);
      const maxHr = Math.max(...activeHrs);

      const roundedMin = Math.max(80, Math.floor((minHr - 8) / 10) * 10);
      const roundedMax = Math.min(220, Math.ceil((maxHr + 8) / 10) * 10);
      const span = Math.max(20, roundedMax - roundedMin);

      const ticks: number[] = [];
      for (let t = roundedMin; t <= roundedMax; t += 10) {
        ticks.push(t);
      }

      return { yMin: roundedMin, yMax: roundedMax, ySpan: span, yTicks: ticks };
    }
  }, [comparePoints, metricMode]);

  const getY = (val: number) => {
    if (metricMode === 'pace') {
      // Inverted: smaller pace seconds = top
      const ratio = (val - yMin) / ySpan;
      return paddingTop + ratio * plotHeight;
    } else {
      // Upright: higher bpm = top
      const ratio = (val - yMin) / ySpan;
      return paddingTop + (1 - ratio) * plotHeight;
    }
  };

  // getX spans the MAXIMUM DISTANCE splits count
  const getX = (index: number) => {
    if (maxSplitsCount <= 1) return paddingLeft + plotWidth / 2;
    return paddingLeft + (index / (maxSplitsCount - 1)) * plotWidth;
  };

  // Today path draws only for points that Today completed
  const todayPath = useMemo(() => {
    const pts = comparePoints.filter(p => p.hasToday);
    if (pts.length === 0) return '';
    return pts
      .map((pt, i) => {
        const val = metricMode === 'pace' ? pt.todayPaceSecUnit : pt.todayHr;
        return `${i === 0 ? 'M' : 'L'} ${getX(pt.index).toFixed(1)} ${getY(val).toFixed(1)}`;
      })
      .join(' ');
  }, [comparePoints, yMin, ySpan, maxSplitsCount, metricMode]);

  const todayArea = useMemo(() => {
    const pts = comparePoints.filter(p => p.hasToday);
    if (pts.length === 0) return '';
    const firstX = getX(pts[0].index).toFixed(1);
    const lastX = getX(pts[pts.length - 1].index).toFixed(1);
    const bottomY = (paddingTop + plotHeight).toFixed(1);
    return `${todayPath} L ${lastX} ${bottomY} L ${firstX} ${bottomY} Z`;
  }, [todayPath, comparePoints, maxSplitsCount]);

  // Baseline path draws only for points that Baseline completed
  const prevPath = useMemo(() => {
    const pts = comparePoints.filter(p => p.hasPrev);
    if (pts.length === 0) return '';
    return pts
      .map((pt, i) => {
        const val = metricMode === 'pace' ? pt.prevPaceSecUnit : pt.prevHr;
        return `${i === 0 ? 'M' : 'L'} ${getX(pt.index).toFixed(1)} ${getY(val).toFixed(1)}`;
      })
      .join(' ');
  }, [comparePoints, yMin, ySpan, maxSplitsCount, metricMode]);

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!chartRef.current || comparePoints.length === 0) return;
    const rect = chartRef.current.getBoundingClientRect();
    const xPos = ((e.clientX - rect.left) / rect.width) * svgWidth;
    let closestIdx = 0;
    let closestDist = Infinity;
    for (let i = 0; i < comparePoints.length; i++) {
      const px = getX(i);
      const dist = Math.abs(px - xPos);
      if (dist < closestDist) {
        closestDist = dist;
        closestIdx = i;
      }
    }
    setHoveredSplitIndex(closestIdx);
  };

  const fastestTodaySplit = useMemo(() => {
    const pts = comparePoints.filter(p => p.hasToday && p.todayPaceSecUnit >= 150);
    if (pts.length === 0) return null;
    return [...pts].sort((a, b) => a.todayPaceSecUnit - b.todayPaceSecUnit)[0];
  }, [comparePoints]);

  const lowestHrSplit = useMemo(() => {
    const pts = comparePoints.filter(p => p.hasToday);
    if (pts.length === 0) return null;
    return [...pts].sort((a, b) => a.todayHr - b.todayHr)[0];
  }, [comparePoints]);

  return (
    <div className="flex flex-col rounded-xl border border-orange-200/80 bg-gradient-to-b from-orange-50/40 to-transparent p-5 dark:border-orange-950/60 dark:from-orange-950/20 dark:to-slate-900 transition-colors">
      {/* Header with Title and Baseline Selector */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-orange-100 dark:border-slate-800">
        <div className="flex items-center gap-2.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-orange-500 text-white shadow-xs">
            <TrendingUp className="h-4 w-4" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              Progress Comparison
              <span className="text-[11px] font-normal text-slate-500 dark:text-slate-400">
                vs chosen baseline run
              </span>
            </h4>
          </div>
        </div>

        {/* User-selected comparison baseline controls with Year jump & Race filter */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Timeframe Filter Pills: Past Week vs Past Month vs All */}
          <div className="inline-flex rounded-lg border border-slate-200 p-0.5 dark:border-slate-800 bg-white dark:bg-slate-800/80 text-[11px]">
            <button
              type="button"
              onClick={() => {
                setTimeFilter('week');
                setJumpDate('');
              }}
              className={`px-2 py-0.5 rounded font-semibold transition-colors ${
                timeFilter === 'week' && !jumpDate && selectedYear === 'all'
                  ? 'bg-orange-600 text-white'
                  : 'text-slate-500 hover:text-slate-800 dark:text-slate-400'
              }`}
            >
              Past Week
            </button>
            <button
              type="button"
              onClick={() => {
                setTimeFilter('month');
                setJumpDate('');
              }}
              className={`px-2 py-0.5 rounded font-semibold transition-colors ${
                timeFilter === 'month' && !jumpDate && selectedYear === 'all'
                  ? 'bg-orange-600 text-white'
                  : 'text-slate-500 hover:text-slate-800 dark:text-slate-400'
              }`}
            >
              Past Month
            </button>
            <button
              type="button"
              onClick={() => {
                setTimeFilter('all');
              }}
              className={`px-2 py-0.5 rounded font-semibold transition-colors ${
                timeFilter === 'all' && !jumpDate && selectedYear === 'all'
                  ? 'bg-orange-600 text-white'
                  : 'text-slate-500 hover:text-slate-800 dark:text-slate-400'
              }`}
            >
              All Runs
            </button>
          </div>

          {/* Year Selector for Going Back Several Years */}
          <select
            value={selectedYear}
            onChange={e => {
              setSelectedYear(e.target.value);
              setJumpDate('');
            }}
            className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs font-semibold text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 shadow-2xs"
            title="Filter by Year"
          >
            <option value="all">All Years</option>
            {availableYears.map(yr => (
              <option key={yr} value={yr}>
                {yr}
              </option>
            ))}
          </select>

          {/* Jump to Specific Date Picker */}
          <div className="flex items-center gap-1">
            <input
              type="date"
              value={jumpDate}
              onChange={e => {
                setJumpDate(e.target.value);
                setTimeFilter('all');
              }}
              title="Jump to date in history"
              className="rounded-lg border border-slate-300 bg-white px-2 py-0.5 text-xs font-mono font-medium text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 shadow-2xs"
            />
            {jumpDate && (
              <button
                type="button"
                onClick={() => setJumpDate('')}
                title="Clear date jump"
                className="p-1 rounded text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Race Filter Toggle */}
          <button
            type="button"
            onClick={() => setRacesOnly(!racesOnly)}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold border transition-colors ${
              racesOnly
                ? 'bg-amber-500 text-white border-amber-600 shadow-xs'
                : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300'
            }`}
            title="Filter by races and all-out time trials"
          >
            <Trophy className="h-3 w-3" />
            <span>Races Only</span>
          </button>

          {/* Baseline Run Dropdown */}
          <select
            value={prevWorkout.id}
            onChange={e => setSelectedBaselineId(e.target.value)}
            className="rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs font-semibold text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 max-w-[240px] truncate shadow-2xs"
          >
            {candidateRuns.length > 0 ? (
              candidateRuns.map(w => {
                const dStr = new Date(w.date).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                });
                const distStr = `${(w.distanceKm * unitMultiplier).toFixed(2)} ${unitLabel}`;
                return (
                  <option key={w.id} value={w.id}>
                    {dStr} · {w.title} ({distStr})
                  </option>
                );
              })
            ) : (
              <option value="">No matching runs found</option>
            )}
          </select>
        </div>
      </div>

      {/* Progress Insight Headline */}
      <div className="mt-3.5 flex items-start gap-3 rounded-lg bg-white/90 p-3.5 border border-orange-100 dark:bg-slate-900/90 dark:border-slate-800 shadow-xs">
        <div className="mt-0.5 text-emerald-600 dark:text-emerald-400">
          <CheckCircle2 className="h-5 w-5" />
        </div>
        <div className="flex-1">
          <p className="text-xs font-semibold text-slate-900 dark:text-white">
            {paceFaster && hrLower ? (
              <span>
                Outstanding physiological adaptation! You ran{' '}
                <strong className="text-emerald-600 dark:text-emerald-400">
                  {paceAbsSec}s/{unitLabel} faster
                </strong>{' '}
                while holding your heart rate{' '}
                <strong className="text-emerald-600 dark:text-emerald-400">
                  {hrAbs} bpm lower
                </strong>
                .
              </span>
            ) : paceFaster ? (
              <span>
                High aerobic output: You ran{' '}
                <strong className="text-orange-600 dark:text-orange-400">
                  {paceAbsSec}s/{unitLabel} faster
                </strong>{' '}
                with sustained tempo effort.
              </span>
            ) : hrLower ? (
              <span>
                Cardiovascular efficiency gain: Kept comparable pace with{' '}
                <strong className="text-emerald-600 dark:text-emerald-400">
                  {hrAbs} bpm lower cardiac cost
                </strong>
                .
              </span>
            ) : (
              <span>
                Solid training stimulus: Pace was maintained within {paceAbsSec}s/{unitLabel} of your
                baseline run.
              </span>
            )}
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-slate-400 font-mono">
            <span>Comparing Against: {prevWorkout.title}</span>
            <span aria-hidden="true">·</span>
            <span>
              {relativeDaysAgo} days ago (
              {new Date(prevWorkout.date).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              })}
              )
            </span>
          </div>
        </div>
      </div>

      {/* 4-Metric Progression Matrix */}
      <div className="mt-4 grid grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Metric 1: Avg Moving Pace */}
        <div className="rounded-lg border border-slate-200/80 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
          <span className="text-[11px] text-slate-500 dark:text-slate-400 block mb-1">
            Avg Moving Pace
          </span>
          <div className="flex items-baseline justify-between">
            <span className="font-mono text-sm font-bold tabular-nums text-slate-900 dark:text-white">
              {formatPace(currentWorkout.avgPaceSecKm, distanceUnit).split(' ')[0]}
              <span className="text-[10px] text-slate-400 font-normal ml-0.5">/{unitLabel}</span>
            </span>
            <span
              className={`font-mono text-xs font-bold tabular-nums ${
                paceFaster ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-500'
              }`}
            >
              {paceDeltaStr}
            </span>
          </div>
          <span className="text-[10px] text-slate-400 block mt-1 font-mono tabular-nums">
            was {formatPace(prevWorkout.avgPaceSecKm, distanceUnit).split(' ')[0]} /{unitLabel}
          </span>
        </div>

        {/* Metric 2: Avg Heart Rate */}
        <div className="rounded-lg border border-slate-200/80 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
          <span className="text-[11px] text-slate-500 dark:text-slate-400 block mb-1">
            Avg Heart Rate
          </span>
          <div className="flex items-baseline justify-between">
            <span className="font-mono text-sm font-bold tabular-nums text-slate-900 dark:text-white">
              {currentWorkout.avgHeartRate ?? '--'}
              <span className="text-[10px] text-slate-400 font-normal ml-0.5">bpm</span>
            </span>
            <span
              className={`font-mono text-xs font-bold tabular-nums ${
                hrLower ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'
              }`}
            >
              {hrDeltaStr}
            </span>
          </div>
          <span className="text-[10px] text-slate-400 block mt-1 font-mono tabular-nums">
            was {prevWorkout.avgHeartRate ?? '--'} bpm
          </span>
        </div>

        {/* Metric 3: Aerobic Efficiency */}
        <div className="rounded-lg border border-slate-200/80 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
          <span className="text-[11px] text-slate-500 dark:text-slate-400 block mb-1">
            Aerobic Efficiency
          </span>
          <div className="flex items-baseline justify-between">
            <span className="font-mono text-sm font-bold tabular-nums text-slate-900 dark:text-white">
              {currentEff.toFixed(2)}
            </span>
            <span
              className={`font-mono text-xs font-bold tabular-nums ${
                effDelta >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-500'
              }`}
            >
              {effDelta >= 0 ? '+' : ''}
              {effDelta.toFixed(2)}
            </span>
          </div>
          <span className="text-[10px] text-slate-400 block mt-1 font-mono tabular-nums">
            was {prevEff.toFixed(2)} (km/h per bpm)
          </span>
        </div>

        {/* Metric 4: Total Distance & Maximum Distance Indicator */}
        <div className="rounded-lg border border-slate-200/80 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
          <span className="text-[11px] text-slate-500 dark:text-slate-400 block mb-1">
            Distance &amp; Time
          </span>
          <div className="flex items-baseline justify-between">
            <span className="font-mono text-sm font-bold tabular-nums text-slate-900 dark:text-white">
              {(currentWorkout.distanceKm * unitMultiplier).toFixed(2)} {unitLabel}
            </span>
            <span className="font-mono text-xs text-slate-500 tabular-nums">
              {formatDuration(currentWorkout.durationSec)}
            </span>
          </div>
          <span className="text-[10px] text-slate-400 block mt-1 font-mono tabular-nums">
            was {(prevWorkout.distanceKm * unitMultiplier).toFixed(2)} {unitLabel} in{' '}
            {formatDuration(prevWorkout.durationSec)}
          </span>
        </div>
      </div>

      {/* Comparative Splits Chart: LINE GRAPH BY PACE OR HEART RATE OVER MAXIMUM DISTANCE */}
      {comparePoints.length > 0 && (
        <div className="mt-4 rounded-lg bg-white p-4 border border-slate-200/80 dark:bg-slate-900 dark:border-slate-800">
          {/* Chart Header with Interactive Legend and Pace vs HR View Switcher */}
          <div className="flex flex-wrap items-center justify-between gap-3 mb-3 text-xs">
            <div>
              <div className="flex items-center gap-2">
                {metricMode === 'pace' ? (
                  <Zap className="h-4 w-4 text-orange-500" />
                ) : (
                  <Heart className="h-4 w-4 text-rose-500" />
                )}
                <span className="font-bold text-slate-900 dark:text-white text-sm">
                  {metricMode === 'pace'
                    ? `Pace by ${distanceUnit === 'mi' ? 'Mile' : 'Km'} Line Graph`
                    : `Heart Rate by ${distanceUnit === 'mi' ? 'Mile' : 'Km'} Line Graph`}
                </span>
                <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-mono text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                  X-Axis: {maxSplitsCount} {distanceUnit === 'mi' ? 'Miles' : 'Km'} (Max Distance)
                </span>
              </div>
              <span className="text-[11px] text-slate-400 block mt-0.5">
                {metricMode === 'pace'
                  ? 'Pace trajectory over maximum distance · Higher point = Faster pace'
                  : 'Heart rate response over maximum distance · Higher point = Higher cardiac cost (bpm)'}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {/* Legend */}
              <div className="flex items-center gap-3 text-[11px]">
                <div className="flex items-center gap-1.5">
                  <span
                    className={`h-2.5 w-2.5 rounded-full inline-block shadow-xs ${
                      metricMode === 'pace' ? 'bg-orange-500' : 'bg-rose-500'
                    }`}
                  />
                  <span className="text-slate-700 dark:text-slate-200 font-semibold">
                    Current Run ({todaySplitsCount} {distanceUnit})
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="h-0.5 w-3.5 bg-slate-400 inline-block border-t border-dashed border-slate-400" />
                  <span className="text-slate-400 font-medium">
                    Baseline ({prevSplitsCount} {distanceUnit})
                  </span>
                </div>
              </div>

              {/* On-Demand Telemetry Hydration Button if runs need granular laps/FIT */}
              {(isCurrentNeedsHydration || isPrevNeedsHydration) && onHydrateWorkout && (
                <button
                  type="button"
                  disabled={isHydrating}
                  onClick={() => {
                    const targets = [
                      isCurrentNeedsHydration ? currentWorkout : null,
                      prevWorkout && isPrevNeedsHydration ? prevWorkout : null,
                    ].filter(Boolean) as Workout[];
                    if (targets.length > 0) {
                      setIsHydrating(true);
                      setHydrationNotice('Hydrating granular lap splits from Garmin...');
                      Promise.all(targets.map(t => onHydrateWorkout(t)))
                        .finally(() => {
                          setIsHydrating(false);
                          setHydrationNotice(null);
                        });
                    }
                  }}
                  className="flex items-center gap-1.5 rounded-md bg-orange-100 px-2.5 py-1 text-[11px] font-semibold text-orange-700 hover:bg-orange-200 dark:bg-orange-950/60 dark:text-orange-300 dark:hover:bg-orange-900/60 transition-colors shadow-2xs disabled:opacity-60"
                  title="Query Garmin Connect Personal API for granular FIT file or lap telemetry"
                >
                  <RefreshCw className={`h-3 w-3 ${isHydrating ? 'animate-spin' : ''}`} />
                  <span>{isHydrating ? 'Fetching Telemetry...' : 'Fetch Granular Garmin Splits'}</span>
                </button>
              )}

              {/* PACE VS HEART RATE LINE GRAPH TOGGLE (Requested by user) */}
              <div className="inline-flex rounded-lg border border-slate-200 p-0.5 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 font-semibold text-xs">
                <button
                  type="button"
                  onClick={() => setMetricMode('pace')}
                  className={`flex items-center gap-1 px-3 py-1 rounded text-xs transition-colors ${
                    metricMode === 'pace'
                      ? 'bg-white shadow-xs text-orange-600 dark:bg-slate-700 dark:text-orange-400 font-bold'
                      : 'text-slate-500 hover:text-slate-800 dark:text-slate-400'
                  }`}
                >
                  <Zap className="h-3.5 w-3.5" />
                  <span>Pace</span>
                </button>
                <button
                  type="button"
                  onClick={() => setMetricMode('hr')}
                  className={`flex items-center gap-1 px-3 py-1 rounded text-xs transition-colors ${
                    metricMode === 'hr'
                      ? 'bg-white shadow-xs text-rose-600 dark:bg-slate-700 dark:text-rose-400 font-bold'
                      : 'text-slate-500 hover:text-slate-800 dark:text-slate-400'
                  }`}
                >
                  <Heart className="h-3.5 w-3.5 text-rose-500" />
                  <span>Heart Rate (HR)</span>
                </button>
              </div>
            </div>
          </div>

          {/* Hydration Banner Notification */}
          {isHydrating && (
            <div className="mb-3 flex items-center justify-between rounded-lg bg-orange-50/90 px-3 py-2 text-xs text-orange-900 dark:bg-orange-950/40 dark:text-orange-200 border border-orange-200 dark:border-orange-800 animate-pulse">
              <div className="flex items-center gap-2">
                <RefreshCw className="h-3.5 w-3.5 animate-spin text-orange-600 dark:text-orange-400 shrink-0" />
                <span>{hydrationNotice || 'Hydrating authentic lap splits and GPS curves from Garmin Connect...'}</span>
              </div>
              <span className="text-[10px] text-orange-700 dark:text-orange-300 font-mono">
                Calling /download-service/files/activity
              </span>
            </div>
          )}

          {/* SVG Line Graph */}
          <div className="relative w-full overflow-hidden">
            <svg
              ref={chartRef}
              viewBox={`0 0 ${svgWidth} ${svgHeight}`}
              className="w-full h-auto select-none cursor-crosshair"
              onMouseMove={handleMouseMove}
              onMouseLeave={() => setHoveredSplitIndex(null)}
            >
              <defs>
                <linearGradient id="splitGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop
                    offset="0%"
                    stopColor={metricMode === 'pace' ? '#f97316' : '#f43f5e'}
                    stopOpacity="0.22"
                  />
                  <stop
                    offset="100%"
                    stopColor={metricMode === 'pace' ? '#f97316' : '#f43f5e'}
                    stopOpacity="0.0"
                  />
                </linearGradient>
              </defs>

              {/* Horizontal Gridlines and Metric Labels */}
              {yTicks.map(tickVal => {
                const y = getY(tickVal);
                let label = '';
                if (metricMode === 'pace') {
                  const min = Math.floor(tickVal / 60);
                  const sec = Math.floor(tickVal % 60);
                  label = `${min}:${sec.toString().padStart(2, '0')}`;
                } else {
                  label = `${tickVal} bpm`;
                }

                return (
                  <g key={tickVal}>
                    <line
                      x1={paddingLeft}
                      y1={y}
                      x2={paddingLeft + plotWidth}
                      y2={y}
                      stroke="currentColor"
                      className="text-slate-200 dark:text-slate-800/80"
                      strokeDasharray="4 4"
                      strokeWidth="1"
                    />
                    <text
                      x={paddingLeft - 8}
                      y={y + 3.5}
                      textAnchor="end"
                      className="fill-slate-400 font-mono text-[10px] tabular-nums select-none"
                    >
                      {label}
                    </text>
                  </g>
                );
              })}

              {/* Baseline Dashed Line */}
              {prevPath && (
                <path
                  d={prevPath}
                  fill="none"
                  stroke="#94a3b8"
                  strokeWidth="2"
                  strokeDasharray="6 4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  opacity="0.85"
                />
              )}

              {/* Today Filled Area Gradient */}
              {todayArea && <path d={todayArea} fill="url(#splitGradient)" />}

              {/* Today Solid Line */}
              {todayPath && (
                <path
                  d={todayPath}
                  fill="none"
                  stroke={metricMode === 'pace' ? '#f97316' : '#f43f5e'}
                  strokeWidth="2.75"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              )}

              {/* Baseline Data Points */}
              {comparePoints
                .filter(pt => pt.hasPrev)
                .map((pt, i) => {
                  const val = metricMode === 'pace' ? pt.prevPaceSecUnit : pt.prevHr;
                  return (
                    <circle
                      key={`prev-${i}`}
                      cx={getX(pt.index)}
                      cy={getY(val)}
                      r="3.5"
                      fill="#64748b"
                      className="transition-transform"
                    />
                  );
                })}

              {/* Today Data Points & Value Labels */}
              {comparePoints
                .filter(pt => pt.hasToday)
                .map((pt, i) => {
                  const val = metricMode === 'pace' ? pt.todayPaceSecUnit : pt.todayHr;
                  const cx = getX(pt.index);
                  const cy = getY(val);
                  const isHovered = hoveredSplitIndex === pt.index;

                  return (
                    <g key={`today-${i}`}>
                      <circle
                        cx={cx}
                        cy={cy}
                        r={isHovered ? '7' : '5'}
                        fill={metricMode === 'pace' ? '#f97316' : '#f43f5e'}
                        className="transition-all duration-150"
                      />
                      <circle cx={cx} cy={cy} r="2.5" fill="#ffffff" />
                      <text
                        x={cx}
                        y={cy - 10}
                        textAnchor="middle"
                        className="fill-slate-800 dark:fill-slate-100 font-mono text-[10px] font-bold tabular-nums"
                      >
                        {metricMode === 'pace'
                          ? pt.todayPaceFormatted.split(' ')[0]
                          : `${pt.todayHr}`}
                      </text>
                    </g>
                  );
                })}

              {/* X-Axis Mile/Km Labels */}
              {comparePoints.map((pt, i) => {
                const cx = getX(i);
                const isHovered = hoveredSplitIndex === i;
                return (
                  <text
                    key={`lbl-${i}`}
                    x={cx}
                    y={paddingTop + plotHeight + 18}
                    textAnchor="middle"
                    className={`font-mono text-[11px] tabular-nums transition-colors ${
                      isHovered
                        ? 'fill-orange-600 dark:fill-orange-400 font-bold'
                        : 'fill-slate-500 dark:fill-slate-400 font-medium'
                    }`}
                  >
                    {pt.label}
                  </text>
                );
              })}

              {/* Finish Indicators if runs differed in length */}
              {todaySplitsCount < maxSplitsCount && (
                <g>
                  <line
                    x1={getX(todaySplitsCount - 1)}
                    y1={paddingTop}
                    x2={getX(todaySplitsCount - 1)}
                    y2={paddingTop + plotHeight}
                    stroke={metricMode === 'pace' ? '#f97316' : '#f43f5e'}
                    strokeWidth="1"
                    strokeDasharray="2 2"
                    opacity="0.5"
                  />
                  <text
                    x={getX(todaySplitsCount - 1) + 4}
                    y={paddingTop + 12}
                    className="fill-orange-500 font-mono text-[9px] font-bold uppercase"
                  >
                    Current Finish
                  </text>
                </g>
              )}

              {prevSplitsCount < maxSplitsCount && (
                <g>
                  <line
                    x1={getX(prevSplitsCount - 1)}
                    y1={paddingTop}
                    x2={getX(prevSplitsCount - 1)}
                    y2={paddingTop + plotHeight}
                    stroke="#94a3b8"
                    strokeWidth="1"
                    strokeDasharray="2 2"
                    opacity="0.5"
                  />
                  <text
                    x={getX(prevSplitsCount - 1) + 4}
                    y={paddingTop + 24}
                    className="fill-slate-400 font-mono text-[9px] font-bold uppercase"
                  >
                    Baseline Finish
                  </text>
                </g>
              )}

              {/* Vertical Crosshair Guide on Hover */}
              {hoveredSplitIndex !== null && (
                <g>
                  <line
                    x1={getX(hoveredSplitIndex)}
                    y1={paddingTop - 6}
                    x2={getX(hoveredSplitIndex)}
                    y2={paddingTop + plotHeight}
                    stroke={metricMode === 'pace' ? '#f97316' : '#f43f5e'}
                    strokeWidth="1.5"
                    strokeDasharray="3 3"
                    opacity="0.8"
                  />
                </g>
              )}
            </svg>

            {/* Floating Interactive Tooltip */}
            {hoveredSplitIndex !== null && comparePoints[hoveredSplitIndex] && (
              <div
                className="absolute top-2 z-20 pointer-events-none rounded-lg border border-slate-200 bg-white/95 px-3 py-2 shadow-lg dark:border-slate-800 dark:bg-slate-900/95 backdrop-blur-xs font-mono text-xs transition-all"
                style={{
                  left: `${Math.min(
                    75,
                    Math.max(10, (getX(hoveredSplitIndex) / svgWidth) * 100)
                  )}%`,
                  transform: 'translateX(-50%)',
                }}
              >
                <div className="font-bold text-slate-900 dark:text-white mb-1 border-b border-slate-100 dark:border-slate-800 pb-1 flex items-center justify-between gap-3">
                  <span>
                    {distanceUnit === 'mi' ? 'Mile' : 'Km'}{' '}
                    {comparePoints[hoveredSplitIndex].splitNumber}
                  </span>
                  {comparePoints[hoveredSplitIndex].hasToday &&
                    comparePoints[hoveredSplitIndex].hasPrev && (
                      <span
                        className={`text-[10px] font-semibold ${
                          metricMode === 'pace'
                            ? comparePoints[hoveredSplitIndex].isFaster
                              ? 'text-emerald-600 dark:text-emerald-400'
                              : 'text-amber-600 dark:text-amber-400'
                            : comparePoints[hoveredSplitIndex].todayHr <=
                              comparePoints[hoveredSplitIndex].prevHr
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : 'text-rose-600 dark:text-rose-400'
                        }`}
                      >
                        {metricMode === 'pace'
                          ? comparePoints[hoveredSplitIndex].isFaster
                            ? `-${comparePoints[hoveredSplitIndex].deltaSec}s faster`
                            : `+${comparePoints[hoveredSplitIndex].deltaSec}s`
                          : comparePoints[hoveredSplitIndex].todayHr <=
                            comparePoints[hoveredSplitIndex].prevHr
                          ? `-${
                              comparePoints[hoveredSplitIndex].prevHr -
                              comparePoints[hoveredSplitIndex].todayHr
                            } bpm lower HR`
                          : `+${
                              comparePoints[hoveredSplitIndex].todayHr -
                              comparePoints[hoveredSplitIndex].prevHr
                            } bpm higher`}
                      </span>
                    )}
                </div>
                <div className="flex items-center justify-between gap-4 text-[11px]">
                  <span
                    className={
                      metricMode === 'pace'
                        ? 'text-orange-600 dark:text-orange-400 font-semibold'
                        : 'text-rose-600 dark:text-rose-400 font-semibold'
                    }
                  >
                    Current: {comparePoints[hoveredSplitIndex].todayPaceFormatted} ·{' '}
                    {comparePoints[hoveredSplitIndex].todayHr} bpm
                  </span>
                  <span className="text-slate-400">
                    Past: {comparePoints[hoveredSplitIndex].prevPaceFormatted} ·{' '}
                    {comparePoints[hoveredSplitIndex].prevHr} bpm
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Bottom Split Highlights Strip */}
          <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3 dark:border-slate-800 text-[11px] font-mono tabular-nums">
            {metricMode === 'pace' ? (
              fastestTodaySplit && (
                <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
                  <Zap className="h-3.5 w-3.5 text-orange-500" />
                  <span className="font-sans text-slate-400">Fastest Split:</span>
                  <span className="font-bold text-slate-900 dark:text-white">
                    {fastestTodaySplit.label} ({fastestTodaySplit.todayPaceFormatted.split(' ')[0]} /{unitLabel})
                  </span>
                </div>
              )
            ) : (
              lowestHrSplit && (
                <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
                  <Heart className="h-3.5 w-3.5 text-rose-500" />
                  <span className="font-sans text-slate-400">Lowest HR Split:</span>
                  <span className="font-bold text-slate-900 dark:text-white">
                    {lowestHrSplit.label} ({lowestHrSplit.todayHr} bpm)
                  </span>
                </div>
              )
            )}

            <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
              <span className="font-sans text-slate-400">
                {metricMode === 'pace' ? 'Overall Average Pace:' : 'Overall Average HR:'}
              </span>
              <span
                className={`font-bold ${
                  metricMode === 'pace'
                    ? 'text-cyan-600 dark:text-cyan-400'
                    : 'text-rose-600 dark:text-rose-400'
                }`}
              >
                {metricMode === 'pace'
                  ? formatPace(currentWorkout.avgPaceSecKm, distanceUnit)
                  : `${currentWorkout.avgHeartRate ?? '--'} bpm`}
              </span>
            </div>

            <div className="flex items-center gap-1.5 text-slate-500">
              <span className="font-sans text-slate-400">Baseline Run:</span>
              <span className="font-semibold text-slate-700 dark:text-slate-300 truncate max-w-[200px]">
                {prevWorkout.title}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
