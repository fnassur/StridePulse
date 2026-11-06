import React, { useState, useMemo } from 'react';
import { Workout, PlannedWorkout } from '../types/workout';
import { isSameDay, formatPace, formatDuration } from '../utils/parsers';
import {
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  Plus,
  Watch,
  Trophy,
  Target,
  CheckCircle2,
  Filter,
  Sparkles,
  ArrowRight,
  Dumbbell,
  Layers,
} from 'lucide-react';

interface GarminCalendarViewProps {
  workouts: Workout[];
  plannedWorkouts: PlannedWorkout[];
  distanceUnit: 'km' | 'mi';
  onSelectWorkout: (workout: Workout) => void;
  onSelectPlannedWorkout?: (plan: PlannedWorkout) => void;
  onScheduleWorkoutToDate: (planId: string, dateIso: string) => void;
  onOpenCreateWorkoutModal?: (initialDateIso?: string) => void;
}

interface CalendarDay {
  date: Date;
  dateIso: string;
  dayNumber: number;
  isCurrentMonth: boolean;
  isToday: boolean;
  runs: Workout[];
  scheduledWorkouts: PlannedWorkout[];
}

export const GarminCalendarView: React.FC<GarminCalendarViewProps> = ({
  workouts,
  plannedWorkouts,
  distanceUnit,
  onSelectWorkout,
  onSelectPlannedWorkout,
  onScheduleWorkoutToDate,
  onOpenCreateWorkoutModal,
}) => {
  // Current view reference: defaults to November 2026 (matching user's activity date)
  const [currentYear, setCurrentYear] = useState(2026);
  const [currentMonth, setCurrentMonth] = useState(10); // 0-indexed: 10 = November
  const [viewMode, setViewMode] = useState<'month' | 'week'>('month');
  const [categoryFilter, setCategoryFilter] = useState<'all' | 'runs' | 'workouts'>('all');

  // Quick schedule picker modal
  const [scheduleModalDay, setScheduleModalDay] = useState<string | null>(null);

  // Month navigation
  const handlePrevMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear(prev => prev - 1);
    } else {
      setCurrentMonth(prev => prev - 1);
    }
  };

  const handleNextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear(prev => prev + 1);
    } else {
      setCurrentMonth(prev => prev + 1);
    }
  };

  const handleGoToday = () => {
    setCurrentYear(2026);
    setCurrentMonth(10); // November 2026
  };

  const monthName = new Date(currentYear, currentMonth, 1).toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  });

  const unitMultiplier = distanceUnit === 'mi' ? 0.621371 : 1.0;
  const unitLabel = distanceUnit;

  // Build Calendar Matrix (Monday-first, exactly like Garmin Connect screenshot)
  const calendarDays = useMemo(() => {
    const days: CalendarDay[] = [];
    const firstDayOfMonth = new Date(currentYear, currentMonth, 1);
    const lastDayOfMonth = new Date(currentYear, currentMonth + 1, 0);

    // Monday-first indexing: Sunday is 0 -> 6, Monday is 1 -> 0, etc.
    const startDayOfWeek = (firstDayOfMonth.getDay() + 6) % 7; // 0 = Mon, 6 = Sun
    const totalDaysInMonth = lastDayOfMonth.getDate();

    // Days from previous month
    const prevMonthLastDay = new Date(currentYear, currentMonth, 0).getDate();
    for (let i = startDayOfWeek - 1; i >= 0; i--) {
      const d = prevMonthLastDay - i;
      const date = new Date(currentYear, currentMonth - 1, d, 12);
      const dateIso = date.toISOString();
      const isToday = isSameDay(date, '2026-11-05');

      const runs = workouts.filter(w => isSameDay(w.date, date));
      const scheduled = plannedWorkouts.filter(p => isSameDay(p.scheduledDate, date));

      days.push({
        date,
        dateIso,
        dayNumber: d,
        isCurrentMonth: false,
        isToday,
        runs,
        scheduledWorkouts: scheduled,
      });
    }

    // Days of current month
    for (let d = 1; d <= totalDaysInMonth; d++) {
      const date = new Date(currentYear, currentMonth, d, 12);
      const dateIso = date.toISOString();
      const isToday = isSameDay(date, '2026-11-05');

      const runs = workouts.filter(w => isSameDay(w.date, date));
      const scheduled = plannedWorkouts.filter(p => isSameDay(p.scheduledDate, date));

      days.push({
        date,
        dateIso,
        dayNumber: d,
        isCurrentMonth: true,
        isToday,
        runs,
        scheduledWorkouts: scheduled,
      });
    }

    // Trailing days from next month to complete the row
    const remainder = (7 - (days.length % 7)) % 7;
    for (let d = 1; d <= remainder; d++) {
      const date = new Date(currentYear, currentMonth + 1, d, 12);
      const dateIso = date.toISOString();
      const isToday = isSameDay(date, '2026-11-05');

      const runs = workouts.filter(w => isSameDay(w.date, date));
      const scheduled = plannedWorkouts.filter(p => isSameDay(p.scheduledDate, date));

      days.push({
        date,
        dateIso,
        dayNumber: d,
        isCurrentMonth: false,
        isToday,
        runs,
        scheduledWorkouts: scheduled,
      });
    }

    return days;
  }, [currentYear, currentMonth, workouts, plannedWorkouts]);

  // If in week view, only show the active week around Nov 5
  const displayedDays = useMemo(() => {
    if (viewMode === 'month') return calendarDays;
    // Find the week index containing today (Nov 5)
    const todayIndex = calendarDays.findIndex(d => d.isToday);
    const startOfWeekIdx = Math.floor(todayIndex / 7) * 7;
    return calendarDays.slice(startOfWeekIdx, startOfWeekIdx + 7);
  }, [calendarDays, viewMode]);

  return (
    <div className="space-y-4">
      {/* Garmin Calendar Control Bar (Matches image_a495e51b.png) */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white p-3.5 dark:border-slate-800 dark:bg-slate-900 shadow-xs">
        {/* Left: Today + Month navigation */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleGoToday}
            className="rounded-md bg-sky-600 px-3 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-sky-500 transition-colors"
          >
            Today
          </button>

          <div className="flex items-center gap-1 text-slate-600 dark:text-slate-300">
            <button
              type="button"
              onClick={handlePrevMonth}
              title="Previous Month"
              className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={handleNextMonth}
              title="Next Month"
              className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          <h3 className="font-display text-base font-bold text-slate-900 dark:text-white ml-1">
            {monthName}
          </h3>
        </div>

        {/* Right: Filters & View Modes */}
        <div className="flex items-center gap-3">
          {/* Category Filter */}
          <div className="flex items-center gap-1.5">
            <Filter className="h-3.5 w-3.5 text-slate-400" />
            <select
              value={categoryFilter}
              onChange={e => setCategoryFilter(e.target.value as any)}
              className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
            >
              <option value="all">Filter by Category ({workouts.length + plannedWorkouts.length})</option>
              <option value="runs">Only Completed Runs</option>
              <option value="workouts">Only Scheduled Workouts</option>
            </select>
          </div>

          {/* Week / Month Switcher */}
          <div className="inline-flex rounded-lg border border-slate-200 p-0.5 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 font-semibold text-xs">
            <button
              type="button"
              onClick={() => setViewMode('week')}
              className={`px-3 py-1 rounded-md transition-colors ${
                viewMode === 'week'
                  ? 'bg-slate-700 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 dark:text-slate-400'
              }`}
            >
              Week
            </button>
            <button
              type="button"
              onClick={() => setViewMode('month')}
              className={`px-3 py-1 rounded-md transition-colors ${
                viewMode === 'month'
                  ? 'bg-slate-700 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 dark:text-slate-400'
              }`}
            >
              Month
            </button>
          </div>
        </div>
      </div>

      {/* Calendar Grid Container */}
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 shadow-xs">
        <div className="min-w-[840px]">
          {/* Day of Week Headers (Monday to Sunday) */}
          <div className="grid grid-cols-7 border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/50 text-center text-xs font-bold text-slate-700 dark:text-slate-300 py-2.5">
            <div>Monday</div>
            <div>Tuesday</div>
            <div>Wednesday</div>
            <div>Thursday</div>
            <div>Friday</div>
            <div>Saturday</div>
            <div>Sunday</div>
          </div>

          {/* Calendar Day Grid */}
          <div className="grid grid-cols-7 divide-x divide-y divide-slate-200 dark:divide-slate-800">
            {displayedDays.map((day, idx) => {
              const hasRuns = day.runs.length > 0;
              const hasScheduled = day.scheduledWorkouts.length > 0;
              const hasBoth = hasRuns && hasScheduled;

              return (
                <div
                  key={idx}
                  className={`group relative min-h-[125px] p-2 flex flex-col justify-between transition-colors ${
                    day.isToday
                      ? 'ring-2 ring-inset ring-slate-900 dark:ring-white bg-orange-50/20 dark:bg-orange-950/10'
                      : day.isCurrentMonth
                      ? 'bg-white dark:bg-slate-900 hover:bg-slate-50/60 dark:hover:bg-slate-800/40'
                      : 'bg-slate-50/50 dark:bg-slate-950/40 text-slate-400'
                  }`}
                >
                  {/* Day Header: Number & Add Workout Button */}
                  <div className="flex items-center justify-between">
                    <span
                      className={`text-xs font-bold font-mono ${
                        day.isToday
                          ? 'text-orange-600 dark:text-orange-400 font-extrabold text-sm'
                          : day.isCurrentMonth
                          ? 'text-slate-800 dark:text-slate-200'
                          : 'text-slate-400'
                      }`}
                    >
                      {day.dayNumber}
                    </span>

                    {/* Quick Add to Calendar Button */}
                    <button
                      type="button"
                      onClick={() => setScheduleModalDay(day.dateIso)}
                      title={`Schedule workout for ${day.date.toLocaleDateString()}`}
                      className="opacity-0 group-hover:opacity-100 p-0.5 rounded text-slate-400 hover:text-orange-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-opacity"
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  {/* Day Content: Runs & Scheduled Workouts */}
                  <div className="space-y-1.5 my-1.5 flex-1">
                    {/* Completed Runs (Orange tag matching Garmin screenshot) */}
                    {(categoryFilter === 'all' || categoryFilter === 'runs') &&
                      day.runs.map(run => {
                        const distFormatted = (run.distanceKm * unitMultiplier).toFixed(2);
                        const durFormatted = formatDuration(run.durationSec);

                        return (
                          <div
                            key={run.id}
                            onClick={() => onSelectWorkout(run)}
                            title={`Inspect Run: ${run.title}`}
                            className="cursor-pointer rounded border border-orange-200/90 bg-white p-1.5 shadow-2xs hover:border-orange-400 dark:border-orange-900/60 dark:bg-slate-800/90 transition-all border-l-3 border-l-orange-500"
                          >
                            <div className="flex items-center gap-1 text-[11px] font-semibold text-slate-800 dark:text-slate-100 truncate">
                              <span className="text-orange-500 shrink-0">🏃</span>
                              <span className="truncate">{run.title}</span>
                            </div>
                            <div className="mt-0.5 text-[10px] font-mono tabular-nums text-slate-500 dark:text-slate-400 pl-4">
                              {distFormatted} {unitLabel} {durFormatted}
                            </div>
                          </div>
                        );
                      })}

                    {/* Scheduled Workouts (Purple tag matching Garmin screenshot) */}
                    {(categoryFilter === 'all' || categoryFilter === 'workouts') &&
                      day.scheduledWorkouts.map(plan => {
                        return (
                          <div
                            key={plan.id}
                            onClick={() => onSelectPlannedWorkout && onSelectPlannedWorkout(plan)}
                            title={`Scheduled Workout: ${plan.title}`}
                            className="cursor-pointer rounded border border-purple-200/90 bg-purple-50/40 p-1.5 shadow-2xs hover:border-purple-400 dark:border-purple-900/60 dark:bg-purple-950/20 transition-all border-l-3 border-l-purple-600"
                          >
                            <div className="flex items-center gap-1 text-[11px] font-semibold text-purple-950 dark:text-purple-200 truncate">
                              <span className="text-purple-600 shrink-0">🎯</span>
                              <span className="truncate">{plan.title}</span>
                            </div>
                            <div className="mt-0.5 text-[10px] font-mono text-purple-700/80 dark:text-purple-300/80 pl-4 truncate">
                              {plan.targetPaceSummary}
                            </div>
                          </div>
                        );
                      })}

                    {/* Execution Score Comparison Badge if BOTH exist on the same day */}
                    {hasBoth && (
                      <div
                        onClick={() => onSelectWorkout(day.runs[0])}
                        title="Run completed on scheduled workout date - Click to view Execution Score"
                        className="cursor-pointer flex items-center justify-between gap-1 rounded bg-emerald-50 px-1.5 py-1 text-[10px] font-bold text-emerald-800 border border-emerald-200 dark:bg-emerald-950/40 dark:border-emerald-800 dark:text-emerald-300 hover:bg-emerald-100 transition-colors"
                      >
                        <span className="flex items-center gap-1">
                          <Trophy className="h-3 w-3 text-emerald-600" />
                          <span>Execution: 94%</span>
                        </span>
                        <ArrowRight className="h-3 w-3 text-emerald-600" />
                      </div>
                    )}
                  </div>

                  {/* Empty state prompt for scheduling */}
                  {!hasRuns && !hasScheduled && day.isCurrentMonth && (
                    <div className="text-[10px] text-slate-300 dark:text-slate-700 font-mono text-right">
                      Rest / Open
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Schedule Workout to Date Modal */}
      {scheduleModalDay && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="relative w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900 transition-colors">
            <div className="flex items-center gap-2 mb-1">
              <CalendarIcon className="h-5 w-5 text-orange-500" />
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Add Workout to Calendar
              </h3>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
              Schedule a structured workout for{' '}
              <strong>
                {new Date(scheduleModalDay).toLocaleDateString('en-US', {
                  weekday: 'long',
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                })}
              </strong>
              . When you complete a run on this day, the app will automatically compare your execution.
            </p>

            <div className="space-y-2.5 max-h-60 overflow-y-auto">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                Choose from Workout Library:
              </span>

              {plannedWorkouts.map(plan => (
                <button
                  key={plan.id}
                  type="button"
                  onClick={() => {
                    onScheduleWorkoutToDate(plan.id, scheduleModalDay);
                    setScheduleModalDay(null);
                  }}
                  className="w-full text-left p-3 rounded-lg border border-slate-200 hover:border-orange-500 hover:bg-orange-50/50 dark:border-slate-800 dark:hover:bg-slate-800/60 dark:hover:border-orange-500 transition-all flex items-center justify-between gap-3 text-xs"
                >
                  <div>
                    <span className="font-bold text-slate-900 dark:text-white block">
                      {plan.title}
                    </span>
                    <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
                      {plan.targetPaceSummary}
                    </span>
                  </div>
                  <span className="rounded bg-orange-100 px-2 py-0.5 text-[10px] font-bold text-orange-700 dark:bg-orange-950 dark:text-orange-300 shrink-0">
                    Schedule
                  </span>
                </button>
              ))}
            </div>

            <div className="mt-5 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
              {onOpenCreateWorkoutModal && (
                <button
                  type="button"
                  onClick={() => {
                    setScheduleModalDay(null);
                    onOpenCreateWorkoutModal(scheduleModalDay);
                  }}
                  className="text-xs font-semibold text-orange-600 hover:text-orange-500 dark:text-orange-400 flex items-center gap-1"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>Create New Workout</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => setScheduleModalDay(null)}
                className="ml-auto rounded-lg px-4 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
