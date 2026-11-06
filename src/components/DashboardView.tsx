import React, { useState } from 'react';
import { Workout, UserGoals, PlannedWorkout } from '../types/workout';
import {
  computeWeeklySummary,
  computeEightWeekTrend,
  computeTrainingLoad,
  computeHeartRateZones,
} from '../utils/analytics';
import { formatPace, formatDuration } from '../utils/parsers';
import confetti from 'canvas-confetti';
import {
  Trophy,
  Flame,
  TrendingUp,
  Target,
  Zap,
  Heart,
  Calendar,
  Watch,
  ChevronRight,
  Activity,
  Plus,
  Sparkles,
  Award,
} from 'lucide-react';

interface DashboardViewProps {
  workouts: Workout[];
  goals: UserGoals;
  plannedWorkouts?: PlannedWorkout[];
  onSelectWorkout: (workout: Workout) => void;
  onOpenSyncModal: () => void;
  onOpenGoalsModal?: () => void;
  onNavigateToGoals?: () => void;
  onNavigateToPlanner?: () => void;
  distanceUnit: 'km' | 'mi';
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  workouts,
  goals,
  plannedWorkouts = [],
  onSelectWorkout,
  onOpenSyncModal,
  onOpenGoalsModal,
  onNavigateToGoals,
  onNavigateToPlanner,
  distanceUnit,
}) => {
  const [selectedDayIndex, setSelectedDayIndex] = useState<number | null>(null);

  const unitMultiplier = distanceUnit === 'mi' ? 0.621371 : 1.0;
  const unitLabel = distanceUnit;

  const cycleLabel =
    goals.weekStartDay === 'sunday'
      ? 'Sun – Sat Cycle'
      : goals.weekStartDay === 'saturday'
      ? 'Sat – Fri Cycle'
      : 'Mon – Sun Cycle';

  // Compute analytics with user-configured weekly cycle
  const weekly = computeWeeklySummary(workouts, goals.weeklyDistanceKm, new Date(), goals.weekStartDay);
  const load = computeTrainingLoad(workouts);
  const eightWeekTrend = computeEightWeekTrend(workouts, new Date(), goals.weekStartDay);
  const hrDistribution = computeHeartRateZones(workouts, goals.hrZones);

  // Trigger celebration confetti
  const triggerConfetti = () => {
    confetti({
      particleCount: 80,
      spread: 70,
      origin: { y: 0.6 },
      colors: ['#f97316', '#3b82f6', '#10b981', '#f59e0b'],
    });
  };

  // Race calculations
  const race = goals.activeRaceGoal;
  const today = new Date();
  const raceDays = race
    ? Math.max(0, Math.ceil((new Date(race.date).getTime() - today.getTime()) / (1000 * 60 * 60 * 24)))
    : 0;
  const raceWeeks = (raceDays / 7).toFixed(1);

  const handleGoToGoals = onNavigateToGoals || onOpenGoalsModal;

  return (
    <div className="space-y-6 pb-12">
      {/* Zero-data Welcome Callout */}
      {workouts.length === 0 && (
        <div className="rounded-2xl border border-orange-200 bg-gradient-to-r from-orange-500/10 via-amber-500/5 to-transparent p-6 dark:border-orange-950/60 dark:from-orange-950/30 dark:to-slate-900 transition-colors flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 shadow-xs">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-orange-600 text-white shadow-xs shrink-0">
              <Watch className="h-6 w-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Welcome to StridePulse
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-300 max-w-xl mt-0.5 leading-relaxed">
                Your training log is ready for your personal running activities. Use the <strong className="text-orange-600 dark:text-orange-400 font-semibold">Sync Garmin</strong> button to link your Garmin Personal API Key, or drag and drop your activity files (.FIT, .TCX, .GPX, .ZIP).
              </p>
            </div>
          </div>
          <button
            onClick={onOpenSyncModal}
            className="flex items-center justify-center gap-2 rounded-xl bg-orange-600 px-4 py-2.5 text-xs font-bold text-white shadow-xs hover:bg-orange-500 transition-colors shrink-0"
          >
            <Watch className="h-4 w-4" />
            <span>Sync Garmin Activities</span>
          </button>
        </div>
      )}

      {/* Top Banner / Goal Progress Hero Strip */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs dark:border-slate-800 dark:bg-slate-900 transition-colors">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          {/* Left: Weekly Goal Gauge */}
          <div className="flex-1 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Target className="h-5 w-5 text-orange-500" />
                <h2 className="font-display text-lg font-bold text-slate-900 dark:text-white">
                  Weekly Distance Goal
                </h2>
                <span className="text-xs text-slate-400">·</span>
                <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                  {cycleLabel}
                </span>
              </div>
            </div>

            {/* Big Numbers & Progress Bar */}
            <div className="flex items-baseline gap-3">
              <span className="font-mono text-4xl font-extrabold tracking-tight text-slate-900 dark:text-white tabular-nums">
                {(weekly.totalDistanceKm * unitMultiplier).toFixed(1)}
              </span>
              <span className="text-sm font-semibold text-slate-400">
                / {(weekly.goalDistanceKm * unitMultiplier).toFixed(1)} {unitLabel}
              </span>
              <span className="font-mono text-sm font-bold text-orange-600 dark:text-orange-400 tabular-nums">
                ({weekly.progressPercent}%)
              </span>
              {weekly.progressPercent >= 100 && (
                <button
                  onClick={triggerConfetti}
                  title="Celebrate Goal Completion!"
                  className="ml-2 flex items-center gap-1 rounded-md bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-800 dark:bg-amber-950 dark:text-amber-300 animate-bounce"
                >
                  <Trophy className="h-3.5 w-3.5 text-amber-500" />
                  <span>Goal Achieved!</span>
                </button>
              )}
            </div>

            {/* Visual Progress Bar */}
            <div className="h-3 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
              <div
                className="h-full rounded-full bg-gradient-to-r from-orange-500 to-amber-500 transition-all duration-500"
                style={{ width: `${Math.min(100, weekly.progressPercent)}%` }}
              />
            </div>

            {/* Summary Micro-Stats */}
            <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500 dark:text-slate-400 pt-1">
              <span>{weekly.workoutCount} workouts this week</span>
              <span aria-hidden="true">·</span>
              <span>{formatDuration(weekly.totalDurationSec)} total time</span>
              <span aria-hidden="true">·</span>
              <span>Avg pace {formatPace(weekly.avgPaceSecKm, distanceUnit)}</span>
              <span aria-hidden="true">·</span>
              <span>+{weekly.totalElevationM}m elevation</span>
            </div>
          </div>

          {/* Right: Daily Workout Breakdown Bar Grid (Mon - Sun) */}
          <div className="flex flex-col rounded-xl border border-slate-100 bg-slate-50/70 p-4 dark:border-slate-800/80 dark:bg-slate-800/40 lg:w-96">
            <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-3 block">
              Daily Volume Breakdown
            </span>
            <div className="grid grid-cols-7 gap-2 items-end h-24">
              {weekly.dailyDistances.map((day, idx) => {
                const maxDayDist = Math.max(1, ...weekly.dailyDistances.map(d => d.distanceKm));
                const heightPct = Math.round((day.distanceKm / maxDayDist) * 100);
                const hasRuns = day.distanceKm > 0;
                const isSelected = selectedDayIndex === idx;

                return (
                  <button
                    key={day.dayName}
                    onClick={() => setSelectedDayIndex(isSelected ? null : idx)}
                    className="flex flex-col items-center gap-1.5 focus:outline-none group"
                  >
                    <span className="font-mono text-[10px] text-slate-400 tabular-nums">
                      {hasRuns ? (day.distanceKm * unitMultiplier).toFixed(0) : ''}
                    </span>
                    <div className="w-full h-14 flex items-end justify-center rounded bg-slate-200/50 dark:bg-slate-700/50 overflow-hidden">
                      <div
                        className={`w-full rounded-t transition-all ${
                          hasRuns
                            ? isSelected
                              ? 'bg-orange-600'
                              : 'bg-orange-500 group-hover:bg-orange-400'
                            : 'bg-transparent'
                        }`}
                        style={{ height: `${Math.max(hasRuns ? 15 : 0, heightPct)}%` }}
                      />
                    </div>
                    <span
                      className={`text-[10px] font-medium transition-colors ${
                        isSelected
                          ? 'text-orange-600 font-bold dark:text-orange-400'
                          : 'text-slate-500 dark:text-slate-400'
                      }`}
                    >
                      {day.dayName}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* If a day is selected, show runs for that day */}
            {selectedDayIndex !== null && (
              <div className="mt-2.5 pt-2 border-t border-slate-200/60 dark:border-slate-700 text-xs">
                {weekly.dailyDistances[selectedDayIndex].workouts.length > 0 ? (
                  weekly.dailyDistances[selectedDayIndex].workouts.map(w => (
                    <div
                      key={w.id}
                      onClick={() => onSelectWorkout(w)}
                      className="flex items-center justify-between py-1 cursor-pointer hover:text-orange-500"
                    >
                      <span className="font-medium truncate">{w.title}</span>
                      <span className="font-mono tabular-nums text-slate-400 ml-2">
                        {(w.distanceKm * unitMultiplier).toFixed(1)} {unitLabel}
                      </span>
                    </div>
                  ))
                ) : (
                  <span className="text-slate-400 text-[11px]">Rest day (no workouts logged)</span>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Garmin Structured Workouts & Execution Score Ribbon */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between rounded-xl border border-orange-200/80 bg-gradient-to-r from-orange-500/10 via-amber-500/5 to-transparent p-4 dark:border-orange-950/60 dark:from-orange-950/30 dark:via-slate-900 dark:to-slate-900 gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-500 text-white shadow-xs shrink-0">
            <Watch className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Garmin Structured Workouts &amp; Execution Scores
              </h3>
              <span className="text-[10px] font-semibold text-orange-600 dark:text-orange-400">
                2-Way Watch Sync Active
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Build custom interval workouts here, export native .FIT files to your Garmin watch, and review execution accuracy scores.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          {plannedWorkouts.find(p => p.status === 'completed') && (
            <div className="rounded-lg bg-emerald-50 px-3 py-1.5 border border-emerald-200 text-xs font-bold text-emerald-800 dark:bg-emerald-950/50 dark:border-emerald-800 dark:text-emerald-300 flex items-center gap-1.5">
              <Trophy className="h-3.5 w-3.5 text-emerald-600" />
              <span>Latest Execution: 94% (Grade A)</span>
            </div>
          )}

          {onNavigateToPlanner && (
            <button
              onClick={onNavigateToPlanner}
              className="flex items-center gap-1 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800 dark:bg-orange-600 dark:hover:bg-orange-500 transition-colors"
            >
              <span>Manage Garmin Workouts</span>
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Row 2: Training Load (ACWR) & Race Preparation Block */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Card 1: ACWR Workload & Fatigue Monitor */}
        <div className="lg:col-span-6 rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900 transition-colors">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-emerald-500" />
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Training Load &amp; Fatigue (ACWR)
              </h3>
            </div>
            <span
              className={`text-xs font-semibold ${
                load.status === 'optimal'
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : load.status === 'building'
                  ? 'text-amber-600 dark:text-amber-400'
                  : 'text-blue-600 dark:text-blue-400'
              }`}
            >
              {load.label}
            </span>
          </div>

          <div className="mt-4 grid grid-cols-3 gap-3">
            <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800/50">
              <span className="text-[11px] text-slate-400 block">Acute (7-Day)</span>
              <span className="font-mono text-lg font-bold text-slate-900 dark:text-white tabular-nums">
                {(load.acuteDistanceKm * unitMultiplier).toFixed(1)}
              </span>
              <span className="text-[10px] text-slate-400 uppercase ml-1 font-semibold">{unitLabel}</span>
            </div>

            <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800/50">
              <span className="text-[11px] text-slate-400 block">Chronic (28-Day Avg)</span>
              <span className="font-mono text-lg font-bold text-slate-900 dark:text-white tabular-nums">
                {(load.chronicAvgDistanceKm * unitMultiplier).toFixed(1)}
              </span>
              <span className="text-[10px] text-slate-400 uppercase ml-1 font-semibold">{unitLabel}</span>
            </div>

            <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800/50">
              <span className="text-[11px] text-slate-400 block">Load Ratio</span>
              <span className="font-mono text-lg font-bold text-orange-600 dark:text-orange-400 tabular-nums">
                {load.acwrRatio}
              </span>
              <span className="text-[10px] text-slate-400 ml-1">ACWR</span>
            </div>
          </div>

          {/* ACWR Visual Range Meter */}
          <div className="mt-4 space-y-1.5">
            <div className="relative h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
              {/* Sweet spot zone highlight */}
              <div
                className="absolute top-0 bottom-0 bg-emerald-500/25"
                style={{ left: '40%', width: '30%' }}
                title="Optimal Sweetspot (0.8 - 1.3)"
              />
              {/* Current indicator marker */}
              <div
                className="absolute top-0 bottom-0 w-2.5 rounded-full bg-orange-600 -translate-x-1/2"
                style={{ left: `${Math.min(95, Math.max(5, (load.acwrRatio / 2.0) * 100))}%` }}
              />
            </div>
            <div className="flex justify-between text-[10px] text-slate-400 font-mono">
              <span>0.5 Recovery</span>
              <span className="text-emerald-600 dark:text-emerald-400 font-bold">0.8 – 1.3 Optimal</span>
              <span>1.5+ Overreaching</span>
            </div>
          </div>

          <p className="mt-3 text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
            {load.description}
          </p>
        </div>

        {/* Card 2: Race Countdown & Pace Split Calculator */}
        <div className="lg:col-span-6 rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900 transition-colors flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <Trophy className="h-4 w-4 text-orange-500" />
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Target Race Preparation
                </h3>
              </div>
              <button
                onClick={handleGoToGoals}
                className="text-xs font-semibold text-orange-600 hover:text-orange-500 dark:text-orange-400"
              >
                Edit Race Target
              </button>
            </div>

            {race ? (
              <div className="mt-4 space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <h4 className="text-base font-bold text-slate-900 dark:text-white">
                      {race.name}
                    </h4>
                    <span className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                      {new Date(race.date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                    </span>
                  </div>
                  <div className="text-right">
                    <div className="flex items-baseline justify-end gap-1.5">
                      <span className="font-mono text-xl font-extrabold text-orange-600 dark:text-orange-400 tabular-nums">
                        {raceWeeks} <span className="text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">wks</span>
                      </span>
                      <span className="text-xs text-slate-400">·</span>
                      <span className="font-mono text-sm font-bold text-slate-700 dark:text-slate-300 tabular-nums">
                        {raceDays} <span className="text-[10px] font-semibold uppercase text-slate-400">days</span>
                      </span>
                    </div>
                    <span className="text-[10px] text-slate-400 uppercase block font-semibold">Remaining to Race</span>
                  </div>
                </div>

                {/* Target Time & Split Grid */}
                <div className="grid grid-cols-2 gap-3 pt-2">
                  <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800/50">
                    <span className="text-[11px] text-slate-400 block">Goal Finish Time</span>
                    <span className="font-mono text-base font-bold text-slate-900 dark:text-white tabular-nums">
                      {formatDuration(race.targetTimeSec)}
                    </span>
                    <span className="text-[10px] text-slate-400 block">
                      {(race.distanceKm * unitMultiplier).toFixed(1)} {unitLabel}
                    </span>
                  </div>

                  <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800/50">
                    <span className="text-[11px] text-cyan-600 dark:text-cyan-400 block font-medium">
                      Target Pace Split
                    </span>
                    <span className="font-mono text-base font-bold text-cyan-600 dark:text-cyan-400 tabular-nums">
                      {formatPace(race.targetPaceSecKm, distanceUnit)}
                    </span>
                    <span className="text-[10px] text-slate-400 block">Required split</span>
                  </div>
                </div>

                {race.notes && (
                  <p className="text-xs text-slate-500 dark:text-slate-400 italic">
                    "{race.notes}"
                  </p>
                )}
              </div>
            ) : (
              <div className="mt-6 text-center">
                <p className="text-xs text-slate-500 mb-3">No active race goal configured.</p>
                <button
                  onClick={handleGoToGoals}
                  className="rounded-lg bg-orange-600 px-4 py-2 text-xs font-semibold text-white hover:bg-orange-500"
                >
                  Set a Race Target
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Row 3: 8-Week Training Volume & Heart Rate Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* 8-Week Mileage Progression */}
        <div className="lg:col-span-7 rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900 transition-colors">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-orange-500" />
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                8-Week Training Volume Progression
              </h3>
            </div>
            <span className="text-xs text-slate-400 font-mono">
              Weekly Totals ({distanceUnit.toUpperCase()})
            </span>
          </div>

          <div className="mt-4 flex items-end justify-between gap-3 h-40 pt-4">
            {eightWeekTrend.map((item, idx) => {
              const maxVol = Math.max(35, ...eightWeekTrend.map(t => t.distanceKm));
              const heightPct = Math.round((item.distanceKm / maxVol) * 100);

              return (
                <div key={idx} className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end">
                  <span className="font-mono text-[10px] text-slate-400 tabular-nums">
                    {(item.distanceKm * unitMultiplier).toFixed(0)}
                  </span>
                  <div className="w-full flex items-end justify-center rounded-t bg-slate-100 dark:bg-slate-800 h-28 overflow-hidden">
                    <div
                      className={`w-full rounded-t transition-all ${
                        item.isCurrentWeek
                          ? 'bg-orange-500'
                          : 'bg-slate-400 hover:bg-slate-500 dark:bg-slate-600 dark:hover:bg-slate-500'
                      }`}
                      style={{ height: `${Math.max(10, heightPct)}%` }}
                    />
                  </div>
                  <span className="text-[10px] font-mono text-slate-500 dark:text-slate-400 truncate max-w-full">
                    {item.weekLabel}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Heart Rate Training Zones */}
        <div className="lg:col-span-5 rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900 transition-colors">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <Heart className="h-4 w-4 text-rose-500" />
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Heart Rate Zone Distribution
              </h3>
            </div>
            <span className="text-xs text-slate-400">Recent Runs</span>
          </div>

          {/* Zones list */}
          <div className="mt-4 space-y-2.5">
            {hrDistribution.map(z => {
              const zoneColors: Record<string, string> = {
                Z1: 'bg-blue-500',
                Z2: 'bg-emerald-500',
                Z3: 'bg-amber-500',
                Z4: 'bg-orange-500',
                Z5: 'bg-rose-500',
              };

              return (
                <div key={z.zone} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-slate-700 dark:text-slate-300">
                        {z.zone}
                      </span>
                      <span className="text-slate-500 dark:text-slate-400">{z.label}</span>
                      <span className="text-[10px] font-mono text-slate-400">
                        ({z.rangeBpm[0]}–{z.rangeBpm[1]} bpm)
                      </span>
                    </div>
                    <span className="font-mono font-semibold tabular-nums text-slate-900 dark:text-white">
                      {z.percentage}% <span className="text-[10px] text-slate-400">({z.minutes}m)</span>
                    </span>
                  </div>

                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                    <div
                      className={`h-full rounded-full ${zoneColors[z.zone]}`}
                      style={{ width: `${z.percentage}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Row 4: Recent Workouts List (Click to view full telemetry & comparison) */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900 transition-colors">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              Recent Garmin Workouts
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Click any workout to inspect detailed telemetry, GPS routes, and automated historical comparison
            </p>
          </div>
          <button
            onClick={onOpenSyncModal}
            className="flex items-center gap-1.5 rounded-lg bg-orange-600 px-3 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-orange-500 transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Upload Run</span>
          </button>
        </div>

        {workouts.length === 0 ? (
          <div className="py-10 px-4 text-center space-y-3">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-orange-100 text-orange-600 dark:bg-orange-950/60 dark:text-orange-400">
              <Watch className="h-6 w-6" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                No Activities Synced Yet
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto mt-1 leading-relaxed">
                Workouts flow directly from your Garmin watch or file upload and are saved to your private Firestore database.
              </p>
            </div>
            <button
              onClick={onOpenSyncModal}
              className="inline-flex items-center gap-2 rounded-xl bg-orange-600 px-4 py-2 text-xs font-bold text-white hover:bg-orange-500 shadow-xs transition-colors"
            >
              <Watch className="h-4 w-4" />
              <span>Sync Garmin Activities</span>
            </button>
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800/80 mt-2">
            {workouts.slice(0, 5).map(w => {
              const dateStr = new Date(w.date).toLocaleDateString('en-US', {
                weekday: 'short',
                month: 'short',
                day: 'numeric',
              });

              return (
                <div
                  key={w.id}
                  onClick={() => onSelectWorkout(w)}
                  className="group flex flex-col sm:flex-row sm:items-center sm:justify-between py-3.5 px-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer transition-colors gap-3"
                >
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-50 text-orange-600 dark:bg-orange-950/40 dark:text-orange-400 shrink-0">
                      <Watch className="h-5 w-5" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-slate-900 dark:text-white group-hover:text-orange-600 dark:group-hover:text-orange-400 transition-colors">
                        {w.title}
                      </h4>
                      {/* Clean unboxed metadata line */}
                      <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        <span className="capitalize">{w.type}</span>
                        <span aria-hidden="true">·</span>
                        <span>{dateStr}</span>
                        <span aria-hidden="true">·</span>
                        <span>{w.source === 'garmin_fit' ? 'Garmin FIT' : w.source === 'garmin_gpx' ? 'Garmin GPX' : w.source === 'garmin_tcx' ? 'Garmin TCX' : 'Manual'}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-6 justify-between sm:justify-end">
                    <div className="text-right">
                      <span className="font-mono text-base font-bold text-slate-900 dark:text-white tabular-nums block">
                        {(w.distanceKm * unitMultiplier).toFixed(2)} {unitLabel}
                      </span>
                      <span className="text-[11px] text-slate-400 font-mono tabular-nums">
                        {formatDuration(w.durationSec)}
                      </span>
                    </div>

                    <div className="text-right">
                      <span className="font-mono text-xs font-semibold text-cyan-600 dark:text-cyan-400 tabular-nums block">
                        {formatPace(w.avgPaceSecKm, distanceUnit)}
                      </span>
                      <span className="text-[11px] text-rose-600 dark:text-rose-400 font-mono tabular-nums">
                        {w.avgHeartRate ? `${w.avgHeartRate} bpm` : '--'}
                      </span>
                    </div>

                    <ChevronRight className="h-4 w-4 text-slate-400 group-hover:text-orange-500 group-hover:translate-x-0.5 transition-all" />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
