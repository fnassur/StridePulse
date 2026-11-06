import React, { useState, useMemo } from 'react';
import { Workout, WorkoutType } from '../types/workout';
import { formatPace, formatDuration } from '../utils/parsers';
import {
  Search,
  Filter,
  ArrowUpDown,
  Plus,
  Watch,
  ChevronRight,
  Zap,
  Heart,
  Mountain,
} from 'lucide-react';

interface WorkoutsListViewProps {
  workouts: Workout[];
  onSelectWorkout: (workout: Workout) => void;
  onOpenSyncModal: () => void;
  distanceUnit: 'km' | 'mi';
}

export const WorkoutsListView: React.FC<WorkoutsListViewProps> = ({
  workouts,
  onSelectWorkout,
  onOpenSyncModal,
  distanceUnit,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'date_desc' | 'date_asc' | 'dist_desc' | 'pace_asc'>('date_desc');

  const unitMultiplier = distanceUnit === 'mi' ? 0.621371 : 1.0;
  const unitLabel = distanceUnit;

  // Filter and sort
  const filteredWorkouts = useMemo(() => {
    return workouts
      .filter(w => {
        const matchesQuery =
          w.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (w.notes && w.notes.toLowerCase().includes(searchQuery.toLowerCase())) ||
          (w.sourceFileName && w.sourceFileName.toLowerCase().includes(searchQuery.toLowerCase()));

        const matchesType = typeFilter === 'all' || w.type === typeFilter;
        return matchesQuery && matchesType;
      })
      .sort((a, b) => {
        if (sortBy === 'date_desc') {
          return new Date(b.date).getTime() - new Date(a.date).getTime();
        }
        if (sortBy === 'date_asc') {
          return new Date(a.date).getTime() - new Date(b.date).getTime();
        }
        if (sortBy === 'dist_desc') {
          return b.distanceKm - a.distanceKm;
        }
        if (sortBy === 'pace_asc') {
          return a.avgPaceSecKm - b.avgPaceSecKm;
        }
        return 0;
      });
  }, [workouts, searchQuery, typeFilter, sortBy]);

  return (
    <div className="space-y-5 pb-12">
      {/* Top Controls: Search, Filters, Sorting, and Add Run */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="font-display text-xl font-bold text-slate-900 dark:text-white">
            Running Activity Log
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {workouts.length} total logged activities with Garmin telemetry
          </p>
        </div>

        <button
          onClick={onOpenSyncModal}
          className="flex items-center gap-1.5 rounded-lg bg-orange-600 px-3.5 py-2 text-xs font-semibold text-white shadow-xs hover:bg-orange-500 transition-colors shrink-0"
        >
          <Plus className="h-4 w-4" />
          <span>Upload Garmin Run</span>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center gap-3 rounded-xl border border-slate-200 bg-white p-3.5 dark:border-slate-800 dark:bg-slate-900 shadow-xs">
        {/* Search Input */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search workouts by name, notes, or filename..."
            className="w-full rounded-lg border border-slate-200 bg-slate-50/50 pl-9 pr-3 py-1.5 text-xs text-slate-900 dark:border-slate-800 dark:bg-slate-800/50 dark:text-white focus:outline-none focus:ring-1 focus:ring-orange-500"
          />
        </div>

        {/* Workout Type Tabs / Filters (Buttons) */}
        <div className="flex flex-wrap items-center gap-1 overflow-x-auto pb-1 lg:pb-0">
          {[
            { id: 'all', label: 'All' },
            { id: 'tempo', label: 'Tempo' },
            { id: 'interval', label: 'Intervals' },
            { id: 'long', label: 'Long Runs' },
            { id: 'easy', label: 'Easy' },
            { id: 'trail', label: 'Trail' },
            { id: 'recovery', label: 'Recovery' },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setTypeFilter(tab.id)}
              className={`px-2.5 py-1 text-xs font-medium rounded-md whitespace-nowrap transition-colors ${
                typeFilter === tab.id
                  ? 'bg-slate-900 text-white dark:bg-orange-600'
                  : 'text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Sort Select */}
        <div className="flex items-center gap-1.5 shrink-0">
          <ArrowUpDown className="h-3.5 w-3.5 text-slate-400" />
          <select
            value={sortBy}
            onChange={e => setSortBy(e.target.value as any)}
            className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 dark:border-slate-800 dark:bg-slate-800 dark:text-slate-200"
          >
            <option value="date_desc">Newest First</option>
            <option value="date_asc">Oldest First</option>
            <option value="dist_desc">Longest Distance</option>
            <option value="pace_asc">Fastest Pace</option>
          </select>
        </div>
      </div>

      {/* Workouts Table / List */}
      <div className="rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 overflow-hidden shadow-xs">
        {filteredWorkouts.length === 0 ? (
          <div className="py-12 text-center">
            <Watch className="h-8 w-8 text-slate-400 mx-auto mb-2" />
            <p className="text-xs font-medium text-slate-500">No matching activities found.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800/80">
            {filteredWorkouts.map(w => {
              const formattedDate = new Date(w.date).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              });

              return (
                <div
                  key={w.id}
                  onClick={() => onSelectWorkout(w)}
                  className="group flex flex-col md:flex-row md:items-center md:justify-between p-4 hover:bg-slate-50/80 dark:hover:bg-slate-800/50 cursor-pointer transition-colors gap-3"
                >
                  <div className="flex items-start gap-3.5">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-50 text-orange-600 dark:bg-orange-950/40 dark:text-orange-400 shrink-0 mt-0.5">
                      <Watch className="h-5 w-5" />
                    </div>

                    <div>
                      <h4 className="text-sm font-bold text-slate-900 dark:text-white group-hover:text-orange-600 dark:group-hover:text-orange-400 transition-colors">
                        {w.title}
                      </h4>
                      {/* Zero-Pill Unboxed Metadata */}
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                        <span className="capitalize font-semibold text-orange-600 dark:text-orange-400">{w.type}</span>
                        <span aria-hidden="true">·</span>
                        <span>{formattedDate}</span>
                        <span aria-hidden="true">·</span>
                        <span>{w.source === 'garmin_fit' ? 'Garmin FIT' : w.source === 'garmin_gpx' ? 'Garmin GPX' : w.source === 'garmin_tcx' ? 'Garmin TCX' : 'Manual'}</span>
                        {w.elevationGainM > 0 && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span>+{w.elevationGainM}m</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Right: Telemetry Metrics */}
                  {(() => {
                    const movingSec = w.movingDurationSec || w.durationSec;
                    const movingPace = w.distanceKm > 0.05 ? Math.round(movingSec / w.distanceKm) : w.avgPaceSecKm;
                    return (
                      <div className="flex items-center gap-6 justify-between md:justify-end">
                        <div className="text-left md:text-right">
                          <span className="font-mono text-base font-bold text-slate-900 dark:text-white tabular-nums block">
                            {(w.distanceKm * unitMultiplier).toFixed(2)} {unitLabel}
                          </span>
                          <span className="font-mono text-[11px] text-slate-400 tabular-nums" title={`Moving Time: ${formatDuration(movingSec)}`}>
                            {formatDuration(movingSec)}
                          </span>
                        </div>

                        <div className="text-right min-w-[70px]">
                          <span className="font-mono text-xs font-bold text-cyan-600 dark:text-cyan-400 tabular-nums block" title="Avg Moving Pace">
                            {formatPace(movingPace, distanceUnit)}
                          </span>
                          <span className="font-mono text-[11px] text-rose-600 dark:text-rose-400 tabular-nums">
                            {w.avgHeartRate ? `${w.avgHeartRate} bpm` : '--'}
                          </span>
                        </div>

                        <ChevronRight className="h-4 w-4 text-slate-400 group-hover:text-orange-500 group-hover:translate-x-0.5 transition-all" />
                      </div>
                    );
                  })()}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
