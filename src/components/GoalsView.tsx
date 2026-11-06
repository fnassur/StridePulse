import React, { useState, useEffect } from 'react';
import { UserGoals, RaceGoal, Workout } from '../types/workout';
import { formatPace, formatDuration } from '../utils/parsers';
import { computeWeeklySummary } from '../utils/analytics';
import {
  Trophy,
  Target,
  Heart,
  Calendar,
  Clock,
  Flame,
  Check,
  ChevronLeft,
  ArrowRight,
  Sparkles,
  Info,
  CalendarDays,
  ShieldCheck,
} from 'lucide-react';

interface GoalsViewProps {
  goals: UserGoals;
  onSaveGoals: (goals: UserGoals) => void;
  distanceUnit: 'km' | 'mi';
  workouts: Workout[];
  onNavigateToDashboard?: () => void;
}

export const GoalsView: React.FC<GoalsViewProps> = ({
  goals,
  onSaveGoals,
  distanceUnit,
  workouts,
  onNavigateToDashboard,
}) => {
  const isMiles = distanceUnit === 'mi';
  const kmToUnit = isMiles ? 0.621371 : 1.0;
  const unitLabel = distanceUnit;

  // Weekly Distance in active unit
  const [weeklyDist, setWeeklyDist] = useState(() => {
    return isMiles ? Math.round(goals.weeklyDistanceKm * 0.621371) : goals.weeklyDistanceKm;
  });

  // Keep weeklyDist in sync if distanceUnit changes externally
  useEffect(() => {
    setWeeklyDist(isMiles ? Math.round(goals.weeklyDistanceKm * 0.621371) : goals.weeklyDistanceKm);
  }, [distanceUnit, goals.weeklyDistanceKm, isMiles]);

  // Weekly Cycle selection
  const [weekCycle, setWeekCycle] = useState<'monday' | 'sunday' | 'saturday'>(
    goals.weekStartDay || 'monday'
  );

  // Race Targets
  const [raceName, setRaceName] = useState(goals.activeRaceGoal?.name || 'Autumn Marathon');
  const [raceDate, setRaceDate] = useState(goals.activeRaceGoal?.date || '2026-12-06');
  const [raceDistKm, setRaceDistKm] = useState(goals.activeRaceGoal?.distanceKm || 42.195);
  const [raceNotes, setRaceNotes] = useState(goals.activeRaceGoal?.notes || 'Aiming for sub-3:15, steady negative split');

  // Target Finish Time
  const initialSec = goals.activeRaceGoal?.targetTimeSec || 11700; // 3h 15m
  const [targetHours, setTargetHours] = useState(Math.floor(initialSec / 3600));
  const [targetMins, setTargetMins] = useState(Math.floor((initialSec % 3600) / 60));
  const [targetSecs, setTargetSecs] = useState(initialSec % 60);

  // Heart Rates
  const [maxHr, setMaxHr] = useState(goals.maxHeartRate || 185);
  const [restHr, setRestHr] = useState(goals.restingHeartRate || 48);

  // Save Feedback Toast
  const [savedToast, setSavedToast] = useState(false);

  // Target Pace calculation
  const totalTargetSec = targetHours * 3600 + targetMins * 60 + targetSecs;
  const calculatedPaceSecKm = raceDistKm > 0 ? Math.round(totalTargetSec / raceDistKm) : 300;

  // Race Countdown calculation
  const today = new Date();
  const targetDateObj = new Date(raceDate);
  const diffTimeMs = targetDateObj.getTime() - today.getTime();
  const daysRemaining = Math.max(0, Math.ceil(diffTimeMs / (1000 * 60 * 60 * 24)));
  const weeksRemaining = (daysRemaining / 7).toFixed(1);

  // Compute live current weekly summary under the currently previewed cycle
  const currentWeeklyKm = isMiles ? weeklyDist / 0.621371 : weeklyDist;
  const liveWeeklySummary = computeWeeklySummary(workouts, currentWeeklyKm, today, weekCycle);

  // Presets for weekly distance slider
  const distancePresets = isMiles
    ? [25, 35, 45, 55, 70, 85, 100]
    : [40, 55, 70, 90, 110, 130, 160];

  // Race distance presets
  const racePresets = [
    { label: '5K', km: 5.0, mi: 3.11 },
    { label: '10K', km: 10.0, mi: 6.21 },
    { label: 'Half Marathon', km: 21.0975, mi: 13.11 },
    { label: 'Marathon', km: 42.195, mi: 26.22 },
    { label: '50K Ultra', km: 50.0, mi: 31.07 },
  ];

  const handleSelectRacePreset = (km: number) => {
    setRaceDistKm(km);
  };

  const handleSave = () => {
    const activeRace: RaceGoal = {
      id: goals.activeRaceGoal?.id || 'race_' + Date.now(),
      name: raceName,
      date: raceDate,
      distanceKm: raceDistKm,
      targetTimeSec: totalTargetSec,
      targetPaceSecKm: calculatedPaceSecKm,
      notes: raceNotes,
    };

    // Calculate updated HR zones based on Max HR
    const z1Max = Math.round(maxHr * 0.65);
    const z2Max = Math.round(maxHr * 0.77);
    const z3Max = Math.round(maxHr * 0.85);
    const z4Max = Math.round(maxHr * 0.93);

    // Convert weekly distance back to km for consistent storage
    const normalizedWeeklyKm = isMiles
      ? Number((weeklyDist / 0.621371).toFixed(1))
      : weeklyDist;

    const updatedGoals: UserGoals = {
      ...goals,
      weeklyDistanceKm: normalizedWeeklyKm,
      distanceUnit,
      weekStartDay: weekCycle,
      activeRaceGoal: activeRace,
      maxHeartRate: maxHr,
      restingHeartRate: restHr,
      hrZones: {
        z1: [restHr, z1Max],
        z2: [z1Max + 1, z2Max],
        z3: [z2Max + 1, z3Max],
        z4: [z3Max + 1, z4Max],
        z5: [z4Max + 1, maxHr],
      },
    };

    onSaveGoals(updatedGoals);
    setSavedToast(true);
    setTimeout(() => setSavedToast(false), 3500);
  };

  return (
    <div className="space-y-8 pb-16 max-w-5xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200 dark:border-slate-800">
        <div>
          {onNavigateToDashboard && (
            <button
              onClick={onNavigateToDashboard}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 mb-2 transition-colors"
            >
              <ChevronLeft className="h-4 w-4" />
              <span>Back to Dashboard</span>
            </button>
          )}
          <h1 className="font-display text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            Weekly Goals &amp; Race Target Settings
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Configure your training cycle boundaries, weekly volume goals, active race countdown, and HR zones.
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          {savedToast && (
            <div className="flex items-center gap-2 rounded-lg bg-emerald-50 px-3.5 py-2 text-xs font-semibold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 animate-fadeIn">
              <Check className="h-4 w-4 text-emerald-600" />
              <span>Goal settings saved successfully!</span>
            </div>
          )}
          <button
            onClick={handleSave}
            className="flex items-center gap-2 rounded-xl bg-orange-600 px-5 py-2.5 text-sm font-semibold text-white shadow-xs hover:bg-orange-500 active:scale-95 transition-all"
          >
            <Check className="h-4 w-4" />
            <span>Save All Goals</span>
          </button>
        </div>
      </div>

      {/* Section 1: Weekly Cycle Configuration */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs dark:border-slate-800 dark:bg-slate-900 transition-colors">
        <div className="flex items-center gap-2.5 mb-2">
          <CalendarDays className="h-5 w-5 text-orange-500" />
          <h2 className="font-display text-lg font-bold text-slate-900 dark:text-white">
            Weekly Training Cycle
          </h2>
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-400 mb-5">
          Select which days define your training week. This controls when weekly mileage resets and alters the 7-day volume breakdown on your dashboard.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Option 1: Monday - Sunday */}
          <button
            type="button"
            onClick={() => setWeekCycle('monday')}
            className={`flex flex-col text-left p-4 rounded-xl border-2 transition-all ${
              weekCycle === 'monday'
                ? 'border-orange-500 bg-orange-50/50 dark:bg-orange-950/20 shadow-xs'
                : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-transparent'
            }`}
          >
            <div className="flex items-center justify-between w-full mb-2">
              <span className="font-bold text-sm text-slate-900 dark:text-white">
                Monday – Sunday
              </span>
              <span
                className={`flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-bold ${
                  weekCycle === 'monday'
                    ? 'bg-orange-500 text-white'
                    : 'border border-slate-300 dark:border-slate-700 text-transparent'
                }`}
              >
                ✓
              </span>
            </div>
            <span className="text-[11px] font-semibold text-orange-600 dark:text-orange-400 mb-1">
              Garmin &amp; Athletic Standard
            </span>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              Week concludes with Saturday/Sunday long runs and recovery before starting fresh on Monday.
            </p>
            <div className="mt-3 flex items-center gap-1 text-[10px] font-mono text-slate-400">
              <span className="font-semibold text-slate-600 dark:text-slate-300">Mon</span>
              <span>· Tue · Wed · Thu · Fri · Sat ·</span>
              <span className="font-semibold text-slate-600 dark:text-slate-300">Sun</span>
            </div>
          </button>

          {/* Option 2: Sunday - Saturday */}
          <button
            type="button"
            onClick={() => setWeekCycle('sunday')}
            className={`flex flex-col text-left p-4 rounded-xl border-2 transition-all ${
              weekCycle === 'sunday'
                ? 'border-orange-500 bg-orange-50/50 dark:bg-orange-950/20 shadow-xs'
                : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-transparent'
            }`}
          >
            <div className="flex items-center justify-between w-full mb-2">
              <span className="font-bold text-sm text-slate-900 dark:text-white">
                Sunday – Saturday
              </span>
              <span
                className={`flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-bold ${
                  weekCycle === 'sunday'
                    ? 'bg-orange-500 text-white'
                    : 'border border-slate-300 dark:border-slate-700 text-transparent'
                }`}
              >
                ✓
              </span>
            </div>
            <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
              US Calendar Standard
            </span>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              Aligns with standard US calendar weeks starting Sunday morning and closing on Saturday evening.
            </p>
            <div className="mt-3 flex items-center gap-1 text-[10px] font-mono text-slate-400">
              <span className="font-semibold text-slate-600 dark:text-slate-300">Sun</span>
              <span>· Mon · Tue · Wed · Thu · Fri ·</span>
              <span className="font-semibold text-slate-600 dark:text-slate-300">Sat</span>
            </div>
          </button>

          {/* Option 3: Saturday - Friday */}
          <button
            type="button"
            onClick={() => setWeekCycle('saturday')}
            className={`flex flex-col text-left p-4 rounded-xl border-2 transition-all ${
              weekCycle === 'saturday'
                ? 'border-orange-500 bg-orange-50/50 dark:bg-orange-950/20 shadow-xs'
                : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-transparent'
            }`}
          >
            <div className="flex items-center justify-between w-full mb-2">
              <span className="font-bold text-sm text-slate-900 dark:text-white">
                Saturday – Friday
              </span>
              <span
                className={`flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-bold ${
                  weekCycle === 'saturday'
                    ? 'bg-orange-500 text-white'
                    : 'border border-slate-300 dark:border-slate-700 text-transparent'
                }`}
              >
                ✓
              </span>
            </div>
            <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
              Weekend Kickoff Cycle
            </span>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              Front-loads high volume on Saturday &amp; Sunday, then uses weekdays to hit remaining mileage.
            </p>
            <div className="mt-3 flex items-center gap-1 text-[10px] font-mono text-slate-400">
              <span className="font-semibold text-slate-600 dark:text-slate-300">Sat</span>
              <span>· Sun · Mon · Tue · Wed · Thu ·</span>
              <span className="font-semibold text-slate-600 dark:text-slate-300">Fri</span>
            </div>
          </button>
        </div>
      </div>

      {/* Section 2: Weekly Distance Target */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs dark:border-slate-800 dark:bg-slate-900 transition-colors">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-2.5">
            <Target className="h-5 w-5 text-orange-500" />
            <h2 className="font-display text-lg font-bold text-slate-900 dark:text-white">
              Weekly Distance Target
            </h2>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="font-mono text-3xl font-extrabold text-orange-600 dark:text-orange-400 tabular-nums">
              {weeklyDist}
            </span>
            <span className="text-sm font-semibold uppercase text-slate-400">
              {unitLabel} / week
            </span>
          </div>
        </div>

        {/* Live Current Week Snapshot */}
        <div className="mb-6 p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
          <div className="flex items-center justify-between text-xs text-slate-600 dark:text-slate-400 mb-2">
            <span className="font-medium">
              Current Week ({weekCycle === 'sunday' ? 'Sun–Sat' : weekCycle === 'saturday' ? 'Sat–Fri' : 'Mon–Sun'}):
            </span>
            <span className="font-mono font-semibold tabular-nums text-slate-900 dark:text-white">
              {(liveWeeklySummary.totalDistanceKm * kmToUnit).toFixed(1)} / {weeklyDist} {unitLabel} ({liveWeeklySummary.progressPercent}%)
            </span>
          </div>
          <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
            <div
              className="h-full rounded-full bg-gradient-to-r from-orange-500 to-amber-500 transition-all duration-300"
              style={{ width: `${Math.min(100, liveWeeklySummary.progressPercent)}%` }}
            />
          </div>
        </div>

        {/* Range Slider */}
        <div className="space-y-3">
          <input
            type="range"
            min={isMiles ? 10 : 15}
            max={isMiles ? 120 : 180}
            step={isMiles ? 1 : 2}
            value={weeklyDist}
            onChange={e => setWeeklyDist(Number(e.target.value))}
            className="w-full h-2.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-orange-500 dark:bg-slate-700"
          />
          <div className="flex justify-between text-[11px] font-mono text-slate-400">
            <span>{isMiles ? '10 mi' : '15 km'}</span>
            <span>{isMiles ? '60 mi' : '90 km'}</span>
            <span>{isMiles ? '120 mi' : '180 km'}</span>
          </div>
        </div>

        {/* Quick Presets */}
        <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800">
          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-2.5 block">
            Quick Volume Presets:
          </span>
          <div className="flex flex-wrap gap-2">
            {distancePresets.map(val => (
              <button
                key={val}
                type="button"
                onClick={() => setWeeklyDist(val)}
                className={`rounded-lg px-3 py-1.5 text-xs font-mono font-medium transition-colors ${
                  weeklyDist === val
                    ? 'bg-orange-600 text-white font-bold'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
                }`}
              >
                {val} {unitLabel}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Section 3: Target Race Preparation */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs dark:border-slate-800 dark:bg-slate-900 transition-colors">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100 dark:border-slate-800 mb-6">
          <div className="flex items-center gap-2.5">
            <Trophy className="h-5 w-5 text-orange-500" />
            <div>
              <h2 className="font-display text-lg font-bold text-slate-900 dark:text-white">
                Active Target Race Preparation
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Set your key race date, distance, and goal finish time to calculate exact split pace requirements.
              </p>
            </div>
          </div>

          {/* Unified Countdown: Weeks AND Days */}
          <div className="rounded-xl bg-orange-50/80 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-900/50 px-4 py-2 text-right">
            <div className="flex items-baseline justify-end gap-1.5">
              <span className="font-mono text-2xl font-extrabold text-orange-600 dark:text-orange-400 tabular-nums">
                {weeksRemaining} <span className="text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">wks</span>
              </span>
              <span className="text-xs text-slate-400">·</span>
              <span className="font-mono text-base font-bold text-slate-700 dark:text-slate-300 tabular-nums">
                {daysRemaining} <span className="text-[11px] font-semibold uppercase text-slate-400">days</span>
              </span>
            </div>
            <span className="text-[10px] text-slate-500 dark:text-slate-400 uppercase font-semibold block">
              Remaining to Race
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Race Name & Date */}
          <div className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1.5">
                Target Race Name
              </label>
              <input
                type="text"
                value={raceName}
                onChange={e => setRaceName(e.target.value)}
                placeholder="e.g. California International Marathon"
                className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1.5">
                Race Date
              </label>
              <input
                type="date"
                value={raceDate}
                onChange={e => setRaceDate(e.target.value)}
                className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1.5">
                Race Strategy / Notes
              </label>
              <textarea
                value={raceNotes}
                onChange={e => setRaceNotes(e.target.value)}
                rows={2}
                placeholder="Pacing strategy, fueling targets, terrain notes..."
                className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
            </div>
          </div>

          {/* Distance & Time & Required Pace Split */}
          <div className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1.5">
                Race Distance: <span className="font-mono text-orange-600 dark:text-orange-400 font-bold">{(raceDistKm * kmToUnit).toFixed(2)} {unitLabel}</span>
              </label>
              <div className="flex flex-wrap gap-2">
                {racePresets.map(preset => {
                  const isSelected = Math.abs(raceDistKm - preset.km) < 0.1;
                  return (
                    <button
                      key={preset.label}
                      type="button"
                      onClick={() => handleSelectRacePreset(preset.km)}
                      className={`rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors ${
                        isSelected
                          ? 'bg-orange-600 text-white font-bold'
                          : 'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
                      }`}
                    >
                      {preset.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Target Finish Time Input */}
            <div>
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1.5">
                Target Finish Time (HH:MM:SS)
              </label>
              <div className="flex items-center gap-2">
                <div className="flex-1">
                  <span className="text-[10px] text-slate-400 uppercase font-mono block">Hours</span>
                  <input
                    type="number"
                    min={0}
                    max={24}
                    value={targetHours}
                    onChange={e => setTargetHours(Math.max(0, parseInt(e.target.value) || 0))}
                    className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-center font-mono text-base font-bold dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                </div>
                <span className="text-xl font-bold text-slate-400 pt-3">:</span>
                <div className="flex-1">
                  <span className="text-[10px] text-slate-400 uppercase font-mono block">Minutes</span>
                  <input
                    type="number"
                    min={0}
                    max={59}
                    value={targetMins}
                    onChange={e => setTargetMins(Math.max(0, Math.min(59, parseInt(e.target.value) || 0)))}
                    className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-center font-mono text-base font-bold dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                </div>
                <span className="text-xl font-bold text-slate-400 pt-3">:</span>
                <div className="flex-1">
                  <span className="text-[10px] text-slate-400 uppercase font-mono block">Seconds</span>
                  <input
                    type="number"
                    min={0}
                    max={59}
                    value={targetSecs}
                    onChange={e => setTargetSecs(Math.max(0, Math.min(59, parseInt(e.target.value) || 0)))}
                    className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-center font-mono text-base font-bold dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                </div>
              </div>
            </div>

            {/* Calculated Required Pace Split Card */}
            <div className="rounded-xl bg-gradient-to-r from-cyan-500/10 via-sky-500/5 to-transparent border border-cyan-500/20 p-4">
              <span className="text-xs font-semibold text-cyan-600 dark:text-cyan-400 block mb-1">
                Required Target Pace Split
              </span>
              <div className="flex items-baseline gap-2">
                <span className="font-mono text-3xl font-extrabold text-cyan-600 dark:text-cyan-400 tabular-nums">
                  {formatPace(calculatedPaceSecKm, distanceUnit)}
                </span>
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  sustained average over {(raceDistKm * kmToUnit).toFixed(1)} {unitLabel}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Section 4: Heart Rate Zones & Lactate Threshold Calibration */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs dark:border-slate-800 dark:bg-slate-900 transition-colors">
        <div className="flex items-center gap-2.5 mb-2">
          <Heart className="h-5 w-5 text-rose-500" />
          <h2 className="font-display text-lg font-bold text-slate-900 dark:text-white">
            Heart Rate Zones &amp; Physiology Calibration
          </h2>
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-400 mb-5">
          Zone boundaries are automatically calibrated according to your Max HR and Resting HR for precise intensity scoring.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
          <div>
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1.5">
              Maximum Heart Rate (Max HR)
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={130}
                max={225}
                value={maxHr}
                onChange={e => setMaxHr(parseInt(e.target.value) || 185)}
                className="w-full rounded-xl border border-slate-300 px-3.5 py-2 font-mono text-base font-bold dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
              <span className="text-xs font-mono text-slate-400">BPM</span>
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1.5">
              Resting Heart Rate (Resting HR)
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={30}
                max={90}
                value={restHr}
                onChange={e => setRestHr(parseInt(e.target.value) || 50)}
                className="w-full rounded-xl border border-slate-300 px-3.5 py-2 font-mono text-base font-bold dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
              <span className="text-xs font-mono text-slate-400">BPM</span>
            </div>
          </div>
        </div>

        {/* 5 Zones Preview Bar */}
        <div className="space-y-3 pt-2">
          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 block">
            Calibrated 5-Zone Model:
          </span>
          <div className="grid grid-cols-1 sm:grid-cols-5 gap-2.5">
            <div className="rounded-xl border border-blue-200/80 bg-blue-50/50 p-3 dark:border-blue-900/50 dark:bg-blue-950/20">
              <span className="text-[11px] font-bold text-blue-600 dark:text-blue-400 block">Z1 · Recovery</span>
              <span className="font-mono text-sm font-extrabold text-slate-900 dark:text-white tabular-nums">
                {restHr}–{Math.round(maxHr * 0.65)}
              </span>
              <span className="text-[10px] text-slate-400 block font-mono">bpm (&lt;65%)</span>
            </div>

            <div className="rounded-xl border border-emerald-200/80 bg-emerald-50/50 p-3 dark:border-emerald-900/50 dark:bg-emerald-950/20">
              <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 block">Z2 · Aerobic Base</span>
              <span className="font-mono text-sm font-extrabold text-slate-900 dark:text-white tabular-nums">
                {Math.round(maxHr * 0.65) + 1}–{Math.round(maxHr * 0.77)}
              </span>
              <span className="text-[10px] text-slate-400 block font-mono">bpm (65–77%)</span>
            </div>

            <div className="rounded-xl border border-amber-200/80 bg-amber-50/50 p-3 dark:border-amber-900/50 dark:bg-amber-950/20">
              <span className="text-[11px] font-bold text-amber-600 dark:text-amber-400 block">Z3 · Tempo</span>
              <span className="font-mono text-sm font-extrabold text-slate-900 dark:text-white tabular-nums">
                {Math.round(maxHr * 0.77) + 1}–{Math.round(maxHr * 0.85)}
              </span>
              <span className="text-[10px] text-slate-400 block font-mono">bpm (78–85%)</span>
            </div>

            <div className="rounded-xl border border-orange-200/80 bg-orange-50/50 p-3 dark:border-orange-900/50 dark:bg-orange-950/20">
              <span className="text-[11px] font-bold text-orange-600 dark:text-orange-400 block">Z4 · Threshold</span>
              <span className="font-mono text-sm font-extrabold text-slate-900 dark:text-white tabular-nums">
                {Math.round(maxHr * 0.85) + 1}–{Math.round(maxHr * 0.93)}
              </span>
              <span className="text-[10px] text-slate-400 block font-mono">bpm (86–93%)</span>
            </div>

            <div className="rounded-xl border border-rose-200/80 bg-rose-50/50 p-3 dark:border-rose-900/50 dark:bg-rose-950/20">
              <span className="text-[11px] font-bold text-rose-600 dark:text-rose-400 block">Z5 · Anaerobic</span>
              <span className="font-mono text-sm font-extrabold text-slate-900 dark:text-white tabular-nums">
                {Math.round(maxHr * 0.93) + 1}–{maxHr}
              </span>
              <span className="text-[10px] text-slate-400 block font-mono">bpm (94–100%)</span>
            </div>
          </div>
        </div>
      </div>

      {/* Sticky Save Confirmation Footer */}
      <div className="flex items-center justify-between p-4 rounded-2xl border border-slate-200 bg-white/90 backdrop-blur-md dark:border-slate-800 dark:bg-slate-900/90 shadow-sm">
        <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
          <ShieldCheck className="h-4 w-4 text-emerald-500" />
          <span>All targets are saved locally and synced across training logs and analytics.</span>
        </div>
        <button
          onClick={handleSave}
          className="flex items-center gap-2 rounded-xl bg-orange-600 px-6 py-2.5 text-sm font-semibold text-white shadow-xs hover:bg-orange-500 active:scale-95 transition-all"
        >
          <Check className="h-4 w-4" />
          <span>Save Changes</span>
        </button>
      </div>
    </div>
  );
};
