import React, { useState } from 'react';
import { UserGoals, RaceGoal } from '../types/workout';
import { formatPace, formatDuration } from '../utils/parsers';
import { Trophy, Target, Heart, Calendar, X, Clock, Flame, Check } from 'lucide-react';

interface GoalsModalProps {
  isOpen: boolean;
  onClose: () => void;
  goals: UserGoals;
  onSaveGoals: (goals: UserGoals) => void;
  distanceUnit?: 'km' | 'mi';
}

export const GoalsModal: React.FC<GoalsModalProps> = ({
  isOpen,
  onClose,
  goals,
  onSaveGoals,
  distanceUnit = 'km',
}) => {
  const isMiles = distanceUnit === 'mi';
  const kmToUnit = isMiles ? 0.621371 : 1.0;

  // Local state for weekly distance in active unit (miles or km)
  const [weeklyDist, setWeeklyDist] = useState(() => {
    return isMiles ? Math.round(goals.weeklyDistanceKm * 0.621371) : goals.weeklyDistanceKm;
  });

  const [raceName, setRaceName] = useState(goals.activeRaceGoal?.name || 'Autumn Marathon');
  const [raceDate, setRaceDate] = useState(goals.activeRaceGoal?.date || '2026-12-06');
  const [raceDistKm, setRaceDistKm] = useState(goals.activeRaceGoal?.distanceKm || 42.195);

  // Target time
  const initialSec = goals.activeRaceGoal?.targetTimeSec || 11700; // 3h 15m
  const [targetHours, setTargetHours] = useState(Math.floor(initialSec / 3600));
  const [targetMins, setTargetMins] = useState(Math.floor((initialSec % 3600) / 60));
  const [targetSecs, setTargetSecs] = useState(initialSec % 60);

  // Heart rates
  const [maxHr, setMaxHr] = useState(goals.maxHeartRate);
  const [restHr, setRestHr] = useState(goals.restingHeartRate);

  // Weekly Cycle
  const [weekCycle, setWeekCycle] = useState<'monday' | 'sunday' | 'saturday'>(
    goals.weekStartDay || 'monday'
  );

  if (!isOpen) return null;

  // Calculate target pace
  const totalTargetSec = targetHours * 3600 + targetMins * 60 + targetSecs;
  const calculatedPaceSecKm = raceDistKm > 0 ? Math.round(totalTargetSec / raceDistKm) : 300;

  // Race countdown calculation
  const today = new Date();
  const targetDateObj = new Date(raceDate);
  const diffTimeMs = targetDateObj.getTime() - today.getTime();
  const daysRemaining = Math.max(0, Math.ceil(diffTimeMs / (1000 * 60 * 60 * 24)));
  const weeksRemaining = (daysRemaining / 7).toFixed(1);

  // Handle Preset distances
  const handleSelectDistancePreset = (km: number) => {
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
    };

    // Calculate updated HR zones based on Max HR
    const z1Max = Math.round(maxHr * 0.65);
    const z2Max = Math.round(maxHr * 0.77);
    const z3Max = Math.round(maxHr * 0.85);
    const z4Max = Math.round(maxHr * 0.93);

    // Convert weekly distance back to km for persistent storage
    const normalizedWeeklyKm = isMiles
      ? Number((weeklyDist / 0.621371).toFixed(1))
      : weeklyDist;

    const updatedGoals: UserGoals = {
      ...goals,
      weeklyDistanceKm: normalizedWeeklyKm,
      distanceUnit: distanceUnit,
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
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="relative w-full max-w-xl max-h-[90vh] overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900 transition-colors">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 p-5 dark:border-slate-800 sticky top-0 bg-white dark:bg-slate-900 z-10">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-orange-500/10 text-orange-600 dark:bg-orange-500/20 dark:text-orange-400">
              <Trophy className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-display text-base font-bold text-slate-900 dark:text-white">
                Personal Goal Setting &amp; Race Targets
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Weekly mileage targets, race split calculator, and HR zones ({isMiles ? 'Miles' : 'Kilometers'})
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-5 space-y-6">
          {/* Section 0: Weekly Cycle */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Calendar className="h-4 w-4 text-orange-500" />
              <span>Weekly Training Cycle</span>
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: 'monday' as const, label: 'Mon – Sun', desc: 'Athletic standard' },
                { id: 'sunday' as const, label: 'Sun – Sat', desc: 'Calendar standard' },
                { id: 'saturday' as const, label: 'Sat – Fri', desc: 'Weekend kickoff' },
              ].map(opt => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setWeekCycle(opt.id)}
                  className={`p-2 rounded-lg border text-left transition-colors ${
                    weekCycle === opt.id
                      ? 'border-orange-500 bg-orange-500/10 text-orange-600 dark:text-orange-400 font-bold'
                      : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:border-slate-300'
                  }`}
                >
                  <span className="block text-xs font-bold">{opt.label}</span>
                  <span className="block text-[10px] text-slate-400 font-normal">{opt.desc}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Section 1: Weekly Mileage Target */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Target className="h-4 w-4 text-orange-500" />
                <span>Weekly Distance Goal</span>
              </label>
              <span className="font-mono text-base font-bold text-orange-600 dark:text-orange-400 tabular-nums">
                {weeklyDist} {distanceUnit} / week
              </span>
            </div>

            <input
              type="range"
              min={isMiles ? 5 : 10}
              max={isMiles ? 80 : 120}
              step="1"
              value={weeklyDist}
              onChange={e => setWeeklyDist(parseInt(e.target.value, 10))}
              className="w-full accent-orange-500 cursor-pointer"
            />

            {/* Presets in active unit */}
            <div className="flex flex-wrap gap-2 pt-1">
              {(isMiles ? [15, 20, 26, 35, 50, 70] : [25, 35, 42, 50, 70, 90]).map(val => (
                <button
                  key={val}
                  type="button"
                  onClick={() => setWeeklyDist(val)}
                  className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                    weeklyDist === val
                      ? 'bg-orange-600 text-white font-semibold'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300'
                  }`}
                >
                  {val} {distanceUnit}
                </button>
              ))}
            </div>
          </div>

          {/* Section 2: Active Race Preparation Block */}
          <div className="space-y-4 pt-4 border-t border-slate-100 dark:border-slate-800">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Calendar className="h-4 w-4 text-orange-500" />
                <span>Target Race Preparation</span>
              </label>
              <span className="text-xs font-mono font-medium text-emerald-600 dark:text-emerald-400 tabular-nums">
                {daysRemaining} days ({weeksRemaining} weeks) remaining
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <span className="text-[11px] text-slate-500 block mb-1">Race Name</span>
                <input
                  type="text"
                  value={raceName}
                  onChange={e => setRaceName(e.target.value)}
                  placeholder="e.g. Boston Marathon, Spring 10K"
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-900 dark:border-slate-800 dark:bg-slate-800 dark:text-white"
                />
              </div>

              <div>
                <span className="text-[11px] text-slate-500 block mb-1">Race Date</span>
                <input
                  type="date"
                  value={raceDate}
                  onChange={e => setRaceDate(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-900 dark:border-slate-800 dark:bg-slate-800 dark:text-white font-mono"
                />
              </div>
            </div>

            {/* Distance Presets */}
            <div>
              <span className="text-[11px] text-slate-500 block mb-1.5">
                Race Distance ({isMiles ? 'Miles' : 'Kilometers'})
              </span>
              <div className="grid grid-cols-4 gap-2">
                {(isMiles
                  ? [
                      { label: '5K (3.1 mi)', km: 5.0 },
                      { label: '10K (6.2 mi)', km: 10.0 },
                      { label: 'Half (13.1 mi)', km: 21.0975 },
                      { label: 'Full (26.2 mi)', km: 42.195 },
                    ]
                  : [
                      { label: '5K', km: 5.0 },
                      { label: '10K', km: 10.0 },
                      { label: 'Half (21.1k)', km: 21.0975 },
                      { label: 'Full (42.2k)', km: 42.195 },
                    ]
                ).map(item => (
                  <button
                    key={item.label}
                    type="button"
                    onClick={() => handleSelectDistancePreset(item.km)}
                    className={`py-1.5 text-xs font-medium rounded-lg border transition-colors ${
                      Math.abs(raceDistKm - item.km) < 0.1
                        ? 'border-orange-500 bg-orange-50 text-orange-700 font-bold dark:bg-orange-950/40 dark:text-orange-300'
                        : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-800 dark:text-slate-300'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Target Time & Split Calculator */}
            <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5 dark:border-slate-800 dark:bg-slate-800/40">
              <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block mb-2">
                Target Finish Time &amp; Required Pace Splits
              </span>

              <div className="grid grid-cols-3 gap-3 mb-3">
                <div>
                  <span className="text-[10px] text-slate-400 block font-mono">Hours</span>
                  <input
                    type="number"
                    min="0"
                    max="10"
                    value={targetHours}
                    onChange={e => setTargetHours(parseInt(e.target.value, 10) || 0)}
                    className="w-full rounded-md border border-slate-200 bg-white px-2 py-1 text-xs font-mono dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block font-mono">Minutes</span>
                  <input
                    type="number"
                    min="0"
                    max="59"
                    value={targetMins}
                    onChange={e => setTargetMins(parseInt(e.target.value, 10) || 0)}
                    className="w-full rounded-md border border-slate-200 bg-white px-2 py-1 text-xs font-mono dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block font-mono">Seconds</span>
                  <input
                    type="number"
                    min="0"
                    max="59"
                    value={targetSecs}
                    onChange={e => setTargetSecs(parseInt(e.target.value, 10) || 0)}
                    className="w-full rounded-md border border-slate-200 bg-white px-2 py-1 text-xs font-mono dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                </div>
              </div>

              {/* Calculated Split Output */}
              <div className="flex items-center justify-between rounded-lg bg-white p-2.5 dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800">
                <span className="text-xs text-slate-600 dark:text-slate-400">Required Goal Split:</span>
                <span className="font-mono text-sm font-bold text-orange-600 dark:text-orange-400 tabular-nums">
                  {isMiles
                    ? `${formatPace(calculatedPaceSecKm, 'mi')} (${formatPace(calculatedPaceSecKm, 'km')})`
                    : `${formatPace(calculatedPaceSecKm, 'km')} (${formatPace(calculatedPaceSecKm, 'mi')})`}
                </span>
              </div>
            </div>
          </div>

          {/* Section 3: Heart Rate Calibration */}
          <div className="space-y-3 pt-4 border-t border-slate-100 dark:border-slate-800">
            <label className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Heart className="h-4 w-4 text-rose-500" />
              <span>Heart Rate Zone Calibration</span>
            </label>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <span className="text-[11px] text-slate-500 block mb-1">Max HR (bpm)</span>
                <input
                  type="number"
                  value={maxHr}
                  onChange={e => setMaxHr(parseInt(e.target.value, 10) || 185)}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-900 dark:border-slate-800 dark:bg-slate-800 dark:text-white font-mono"
                />
              </div>

              <div>
                <span className="text-[11px] text-slate-500 block mb-1">Resting HR (bpm)</span>
                <input
                  type="number"
                  value={restHr}
                  onChange={e => setRestHr(parseInt(e.target.value, 10) || 48)}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-900 dark:border-slate-800 dark:bg-slate-800 dark:text-white font-mono"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-slate-100 p-4 dark:border-slate-800 flex justify-end gap-2.5 bg-slate-50/50 dark:bg-slate-900/50 sticky bottom-0">
          <button
            onClick={onClose}
            className="rounded-lg px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="flex items-center gap-1.5 rounded-lg bg-orange-600 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-orange-500 transition-colors"
          >
            <Check className="h-4 w-4" />
            <span>Save Training Targets</span>
          </button>
        </div>
      </div>
    </div>
  );
};
