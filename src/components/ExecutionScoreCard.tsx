import React, { useState } from 'react';
import { PlannedWorkout, Workout, WorkoutExecutionAnalysis } from '../types/workout';
import { analyzeWorkoutExecution } from '../utils/executionScoreEngine';
import { formatPace, formatDuration, isSameDay } from '../utils/parsers';
import {
  Trophy,
  Target,
  Award,
  CheckCircle2,
  AlertTriangle,
  Zap,
  Heart,
  ChevronDown,
  ChevronUp,
  FileCheck,
  Calendar as CalendarIcon,
  Plus,
} from 'lucide-react';

interface ExecutionScoreCardProps {
  workout: Workout;
  plannedWorkouts: PlannedWorkout[];
  distanceUnit: 'km' | 'mi';
  onScheduleWorkoutToDate?: (plannedId: string, dateIso: string) => void;
  onLinkPlannedWorkout?: (plannedId: string | null) => void;
}

export const ExecutionScoreCard: React.FC<ExecutionScoreCardProps> = ({
  workout,
  plannedWorkouts,
  distanceUnit,
  onScheduleWorkoutToDate,
  onLinkPlannedWorkout,
}) => {
  const [showStepDetails, setShowStepDetails] = useState(true);

  const formattedDate = new Date(workout.date).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  // GARMIN CALENDAR MATCHING:
  // Automatically compare the workout/run done on this day to the structured workout scheduled on this calendar day!
  const matchedPlan =
    plannedWorkouts.find(p => isSameDay(p.scheduledDate, workout.date)) ||
    plannedWorkouts.find(p => p.id === workout.plannedWorkoutId);

  // Selected workout for scheduling to this day if none currently exists
  const [selectedPlanIdToSchedule, setSelectedPlanIdToSchedule] = useState<string>(
    plannedWorkouts[0]?.id || ''
  );

  // Grade color styling
  const gradeColors: Record<string, string> = {
    'A+': 'text-emerald-500 border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40',
    A: 'text-emerald-600 border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40',
    'B+': 'text-cyan-600 border-cyan-500 bg-cyan-50 dark:bg-cyan-950/40',
    B: 'text-blue-600 border-blue-500 bg-blue-50 dark:bg-blue-950/40',
    C: 'text-amber-600 border-amber-500 bg-amber-50 dark:bg-amber-950/40',
    'Needs Review': 'text-rose-600 border-rose-500 bg-rose-50 dark:bg-rose-950/40',
  };

  // If NO workout is scheduled for this calendar date:
  if (!matchedPlan) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50/70 p-5 dark:border-slate-700/80 dark:bg-slate-900/60 transition-colors">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-orange-500/10 text-orange-600 dark:bg-orange-500/20 dark:text-orange-400">
              <CalendarIcon className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Calendar Execution Scoring
                </h3>
                <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500 border border-slate-200 dark:border-slate-700 px-1.5 py-0.5 rounded">
                  No Workout Scheduled on {formattedDate}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-2xl leading-relaxed">
                Add a structured workout to your calendar on this day ({formattedDate}) to automatically evaluate how well you hit your target paces, interval splits, and calculate your Execution Score.
              </p>
            </div>
          </div>

          {plannedWorkouts.length > 0 ? (
            <div className="flex items-center gap-2 shrink-0">
              <select
                value={selectedPlanIdToSchedule}
                onChange={e => setSelectedPlanIdToSchedule(e.target.value)}
                className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 max-w-[240px] truncate"
              >
                {plannedWorkouts.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.title} ({p.steps.length} steps)
                  </option>
                ))}
              </select>

              <button
                type="button"
                onClick={() => {
                  if (onScheduleWorkoutToDate && selectedPlanIdToSchedule) {
                    onScheduleWorkoutToDate(selectedPlanIdToSchedule, workout.date);
                  } else if (onLinkPlannedWorkout && selectedPlanIdToSchedule) {
                    onLinkPlannedWorkout(selectedPlanIdToSchedule);
                  }
                }}
                className="flex items-center gap-1.5 rounded-lg bg-orange-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-orange-500 transition-colors shadow-xs"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Add to this Day</span>
              </button>
            </div>
          ) : (
            <span className="text-xs text-slate-400 italic">No structured workouts created yet</span>
          )}
        </div>
      </div>
    );
  }

  // A workout IS scheduled on this calendar day: run full analysis!
  const analysis: WorkoutExecutionAnalysis = analyzeWorkoutExecution(matchedPlan, workout);

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900 transition-colors shadow-xs">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-orange-500/10 text-orange-600 dark:bg-orange-500/20 dark:text-orange-400">
            <Trophy className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Workout Execution Score
              </h3>
              <span className="text-[11px] font-semibold text-orange-600 dark:text-orange-400 flex items-center gap-1">
                <CalendarIcon className="h-3 w-3" />
                <span>Scheduled for {formattedDate}: &quot;{matchedPlan.title}&quot;</span>
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Evaluates pace adherence windows, interval targets, and recovery discipline for this scheduled calendar session
            </p>
          </div>
        </div>

        {/* Change Scheduled Workout Dropdown */}
        <div className="flex items-center gap-2">
          {plannedWorkouts.length > 1 && (
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-slate-400 hidden sm:inline">Compare with Workout:</span>
              <select
                value={matchedPlan.id}
                onChange={e => {
                  if (onScheduleWorkoutToDate) {
                    onScheduleWorkoutToDate(e.target.value, workout.date);
                  } else if (onLinkPlannedWorkout) {
                    onLinkPlannedWorkout(e.target.value);
                  }
                }}
                className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 max-w-[200px] truncate"
              >
                {plannedWorkouts.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.title}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      {/* Main Score Hero */}
      <div className="mt-4 grid grid-cols-1 md:grid-cols-12 gap-5 items-center">
        {/* Score Badge */}
        <div className="md:col-span-4 flex items-center gap-4 rounded-xl bg-slate-50 p-4 dark:bg-slate-800/40">
          <div className="flex flex-col items-center justify-center w-20 h-20 rounded-2xl bg-white shadow-xs border border-slate-200 dark:bg-slate-800 dark:border-slate-700">
            <span className="font-mono text-2xl font-extrabold text-orange-600 dark:text-orange-400 tabular-nums">
              {analysis.overallScore}%
            </span>
            <span
              className={`text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${gradeColors[analysis.grade] || ''}`}
            >
              Grade {analysis.grade}
            </span>
          </div>

          <div className="space-y-1">
            <span className="text-xs font-bold text-slate-900 dark:text-white block">
              {analysis.overallScore >= 90
                ? 'Exceptional Execution'
                : analysis.overallScore >= 80
                ? 'Solid Workout Execution'
                : 'Workout Completed'}
            </span>
            <span className="text-[11px] text-slate-500 dark:text-slate-400 block leading-tight">
              Pacing accuracy: {analysis.paceScore}% · Volume: {analysis.durationScore}%
            </span>
          </div>
        </div>

        {/* Coach Feedback Note */}
        <div className="md:col-span-8 flex items-start gap-3 rounded-xl bg-orange-50/60 p-4 border border-orange-100 dark:bg-orange-950/20 dark:border-orange-900/40">
          <CheckCircle2 className="h-5 w-5 text-orange-600 dark:text-orange-400 shrink-0 mt-0.5" />
          <div className="text-xs">
            <span className="font-semibold text-slate-900 dark:text-white block mb-0.5">
              Coach Diagnostic Feedback:
            </span>
            <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
              {analysis.coachFeedback}
            </p>
          </div>
        </div>
      </div>

      {/* Step Breakdown Toggle */}
      <div className="mt-5 pt-3 border-t border-slate-100 dark:border-slate-800">
        <button
          onClick={() => setShowStepDetails(!showStepDetails)}
          className="flex items-center justify-between w-full text-xs font-semibold text-slate-700 dark:text-slate-300 hover:text-orange-600 transition-colors"
        >
          <span>Interval-by-Interval Target Adherence ({analysis.stepResults.length} Steps)</span>
          {showStepDetails ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>

        {showStepDetails && (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-800 text-slate-400">
                  <th className="py-2 font-medium">Step</th>
                  <th className="py-2 font-medium">Type</th>
                  <th className="py-2 font-medium">Target Pace</th>
                  <th className="py-2 font-medium">Actual Pace</th>
                  <th className="py-2 font-medium">Accuracy</th>
                  <th className="py-2 font-medium">Coach Diagnostics</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-mono tabular-nums">
                {analysis.stepResults.map((s, idx) => (
                  <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                    <td className="py-2.5 font-bold text-slate-800 dark:text-slate-200">
                      {s.stepName}
                    </td>
                    <td className="py-2.5 font-sans capitalize text-slate-500">
                      {s.stepType}
                    </td>
                    <td className="py-2.5 text-slate-600 dark:text-slate-400">
                      {s.targetPaceMinSecKm && s.targetPaceMaxSecKm
                        ? `${formatPace(s.targetPaceMinSecKm, distanceUnit).split(' ')[0]} – ${formatPace(s.targetPaceMaxSecKm, distanceUnit).split(' ')[0]}`
                        : 'Open / Free'}
                    </td>
                    <td className="py-2.5 font-bold text-cyan-600 dark:text-cyan-400">
                      {s.actualPaceSecKm ? formatPace(s.actualPaceSecKm, distanceUnit).split(' ')[0] : '--'}
                    </td>
                    <td className="py-2.5">
                      <span
                        className={`font-bold ${
                          s.score >= 95
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : s.score >= 85
                            ? 'text-cyan-600 dark:text-cyan-400'
                            : 'text-amber-600 dark:text-amber-400'
                        }`}
                      >
                        {s.score}%
                      </span>
                    </td>
                    <td className="py-2.5 font-sans text-[11px] text-slate-600 dark:text-slate-300">
                      {s.feedback}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
