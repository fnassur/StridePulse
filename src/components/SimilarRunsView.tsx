import React, { useState, useMemo } from 'react';
import { Workout } from '../types/workout';
import { formatPace, formatDuration } from '../utils/parsers';
import { SimilarRunsCard } from './SimilarRunsCard';
import { TrendingUp, ChevronRight, Activity, Calendar } from 'lucide-react';

interface SimilarRunsViewProps {
  workouts: Workout[];
  onSelectWorkout: (workout: Workout) => void;
  distanceUnit: 'km' | 'mi';
}

export const SimilarRunsView: React.FC<SimilarRunsViewProps> = ({
  workouts,
  onSelectWorkout,
  distanceUnit,
}) => {
  // Find the latest completed run as the primary anchor
  const latestWorkout = useMemo(() => {
    if (workouts.length === 0) return null;
    return [...workouts].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
  }, [workouts]);

  const [selectedWorkoutId, setSelectedWorkoutId] = useState<string>(() => latestWorkout?.id || '');

  const currentWorkout =
    workouts.find(w => w.id === selectedWorkoutId) || latestWorkout || workouts[0];
  const unitMultiplier = distanceUnit === 'mi' ? 0.621371 : 1.0;
  const unitLabel = distanceUnit;

  if (!currentWorkout) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-16 text-center dark:border-slate-800 dark:bg-slate-900 shadow-xs space-y-3">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-orange-100 text-orange-600 dark:bg-orange-950/60 dark:text-orange-400">
          <TrendingUp className="h-6 w-6" />
        </div>
        <div>
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">
            Progress Comparison Waiting for Data
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto mt-1 leading-relaxed">
            Once you sync your Garmin activities, StridePulse automatically compares pace-to-heart-rate efficiency curves, elevation profiles, and recurring routes.
          </p>
        </div>
      </div>
    );
  }

  const formattedDate = new Date(currentWorkout.date).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  const formattedTime = new Date(currentWorkout.date).toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <div className="space-y-6 pb-12">
      {/* View Header with Clean Anchor Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="font-display text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-orange-500" />
            <span>Progress Comparison</span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Compare pacing, heart rate response, and split-by-split execution against past efforts and race benchmarks
          </p>
        </div>

        {/* Quiet Anchor Selector Dropdown (Replaces the cluttered 8-card grid) */}
        {workouts.length > 1 && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500 dark:text-slate-400 font-medium whitespace-nowrap">
              Anchor Workout:
            </span>
            <select
              value={currentWorkout.id}
              onChange={e => setSelectedWorkoutId(e.target.value)}
              className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 max-w-[280px] truncate shadow-2xs"
            >
              {workouts.map(w => {
                const isLatest = latestWorkout?.id === w.id;
                const dateStr = new Date(w.date).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                });
                const distStr = `${(w.distanceKm * unitMultiplier).toFixed(2)} ${unitLabel}`;
                return (
                  <option key={w.id} value={w.id}>
                    {isLatest ? '★ [Latest] ' : ''}
                    {dateStr} · {w.title} ({distStr})
                  </option>
                );
              })}
            </select>
          </div>
        )}
      </div>

      {/* Selected Benchmark Hero Banner (Clean & Uncluttered) */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900 shadow-xs transition-colors">
        <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
          <div>
            <div className="flex items-center gap-2 text-xs">
              <span className="font-bold text-orange-600 dark:text-orange-400 uppercase tracking-wider text-[10px]">
                {latestWorkout?.id === currentWorkout.id ? 'Latest Completed Run' : 'Selected Anchor Run'}
              </span>
              <span className="text-slate-300 dark:text-slate-700">·</span>
              <span className="text-slate-500 dark:text-slate-400 font-mono text-[11px]">
                {formattedDate} at {formattedTime}
              </span>
            </div>

            <h3 className="font-display text-lg font-bold text-slate-900 dark:text-white mt-1">
              {currentWorkout.title}
            </h3>
          </div>

          <button
            type="button"
            onClick={() => onSelectWorkout(currentWorkout)}
            className="flex items-center gap-1.5 rounded-lg bg-slate-900 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-slate-800 dark:bg-orange-600 dark:hover:bg-orange-500 transition-colors shadow-xs"
          >
            <span>Inspect Route &amp; All Splits</span>
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        {/* 4 Tabular Metric Ribbon */}
        <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono tabular-nums">
          <div className="rounded-lg bg-slate-50 p-2.5 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800/60">
            <span className="text-[10px] text-slate-400 block font-sans">Distance</span>
            <span className="text-base font-bold text-slate-900 dark:text-white">
              {(currentWorkout.distanceKm * unitMultiplier).toFixed(2)}
            </span>
            <span className="text-[10px] text-slate-400 uppercase font-semibold ml-1">
              {unitLabel}
            </span>
          </div>

          <div className="rounded-lg bg-slate-50 p-2.5 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800/60">
            <span className="text-[10px] text-slate-400 block font-sans">Moving Time</span>
            <span className="text-base font-bold text-slate-900 dark:text-white">
              {formatDuration(currentWorkout.movingDurationSec || currentWorkout.durationSec)}
            </span>
          </div>

          <div className="rounded-lg bg-slate-50 p-2.5 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800/60">
            <span className="text-[10px] text-cyan-600 dark:text-cyan-400 block font-sans font-medium">
              Avg Moving Pace
            </span>
            <span className="text-base font-bold text-cyan-600 dark:text-cyan-400">
              {formatPace(currentWorkout.avgPaceSecKm, distanceUnit).split(' ')[0]}
            </span>
            <span className="text-[10px] text-slate-400 uppercase font-semibold ml-1">
              /{unitLabel}
            </span>
          </div>

          <div className="rounded-lg bg-slate-50 p-2.5 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800/60">
            <span className="text-[10px] text-rose-600 dark:text-rose-400 block font-sans font-medium">
              Avg Heart Rate
            </span>
            <span className="text-base font-bold text-rose-600 dark:text-rose-400">
              {currentWorkout.avgHeartRate ?? '--'}
            </span>
            <span className="text-[10px] text-slate-400 font-sans ml-1">bpm</span>
          </div>
        </div>
      </div>

      {/* Progress Comparison Card with Pace vs HR Line Graph & Multi-Year Navigation */}
      <SimilarRunsCard
        currentWorkout={currentWorkout}
        allWorkouts={workouts}
        distanceUnit={distanceUnit}
        onSelectWorkout={workoutId => {
          const w = workouts.find(x => x.id === workoutId);
          if (w) onSelectWorkout(w);
        }}
      />
    </div>
  );
};
