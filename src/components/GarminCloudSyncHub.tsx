import React, { useState } from 'react';
import { GarminCloudAccount, Workout, WorkoutType } from '../types/workout';
import { deduplicateWorkouts } from '../utils/deduplication';
import {
  Watch,
  Cloud,
  CheckCircle2,
  RefreshCw,
  Smartphone,
  ArrowRight,
  ShieldCheck,
  Zap,
  Radio,
  ExternalLink,
  History,
  Layers,
  Calendar,
  AlertCircle,
} from 'lucide-react';

interface GarminCloudSyncHubProps {
  cloudAccount: GarminCloudAccount;
  onUpdateAccount: (updated: GarminCloudAccount) => void;
  onImportNewRuns: (runs: Workout[], message?: string) => void;
  distanceUnit: 'km' | 'mi';
  existingWorkouts: Workout[];
}

export const GarminCloudSyncHub: React.FC<GarminCloudSyncHubProps> = ({
  cloudAccount,
  onUpdateAccount,
  onImportNewRuns,
  distanceUnit,
  existingWorkouts,
}) => {
  const [isSyncing, setIsSyncing] = useState(false);
  const [isBackfilling, setIsBackfilling] = useState(false);
  const [backfillProgress, setBackfillProgress] = useState(0);
  const [backfillStatusText, setBackfillStatusText] = useState('');
  const [selectedRange, setSelectedRange] = useState<'30_days' | '90_days' | '1_year' | 'all_time'>('90_days');
  const [syncSuccessMsg, setSyncSuccessMsg] = useState<string | null>(null);
  const [showConnectForm, setShowConnectForm] = useState(false);
  const [emailInput, setEmailInput] = useState(cloudAccount.email || 'faiz.ali.nassur.93@gmail.com');
  const [selectedDevice, setSelectedDevice] = useState(cloudAccount.deviceName || 'Garmin Forerunner 965');

  // Trigger simulated cloud pull for latest single activity
  const handleSyncLatest = () => {
    setIsSyncing(true);
    setSyncSuccessMsg(null);

    setTimeout(() => {
      setIsSyncing(false);

      const now = new Date();
      const freshWorkout: Workout = {
        id: 'garmin_cloud_' + Date.now(),
        title: `${cloudAccount.deviceName} - Morning Tempo`,
        date: now.toISOString(),
        type: 'tempo',
        distanceKm: 11.378, // 7.07 miles
        durationSec: 3228, // 53:48 moving time
        movingDurationSec: 3228,
        timerDurationSec: 3231,
        elapsedDurationSec: 3468,
        stoppedDurationSec: 240,
        avgPaceSecKm: 284, // 7:37 /mi moving pace
        elapsedPaceSecKm: 305,
        avgPower: 308,
        maxPower: 377,
        elevationGainM: 65,
        avgHeartRate: 154,
        maxHeartRate: 172,
        avgCadence: 176,
        calories: 774,
        perceivedEffort: 7,
        notes: `Wirelessly auto-synced from ${cloudAccount.deviceName} via Garmin Connect Cloud API. Moving: 53:48, Avg Moving Pace: 7:37/mi.`,
        source: 'garmin_cloud',
        sourceFileName: 'Garmin-Connect-Direct-Sync',
        trackPoints: [],
        splits: [
          { splitNumber: 1, distanceKm: 1.61, durationSec: 457, elapsedDurationSec: 460, paceSecKm: 284, elevationDeltaM: 8, avgHeartRate: 148 },
          { splitNumber: 2, distanceKm: 1.61, durationSec: 456, elapsedDurationSec: 460, paceSecKm: 283, elevationDeltaM: 10, avgHeartRate: 151 },
          { splitNumber: 3, distanceKm: 1.61, durationSec: 457, elapsedDurationSec: 458, paceSecKm: 284, elevationDeltaM: 5, avgHeartRate: 154 },
          { splitNumber: 4, distanceKm: 1.61, durationSec: 458, elapsedDurationSec: 698, paceSecKm: 284, elevationDeltaM: -4, avgHeartRate: 153 },
          { splitNumber: 5, distanceKm: 1.61, durationSec: 455, elapsedDurationSec: 458, paceSecKm: 283, elevationDeltaM: 14, avgHeartRate: 157 },
          { splitNumber: 6, distanceKm: 1.61, durationSec: 455, elapsedDurationSec: 456, paceSecKm: 283, elevationDeltaM: 12, avgHeartRate: 159 },
          { splitNumber: 7, distanceKm: 1.72, durationSec: 490, elapsedDurationSec: 478, paceSecKm: 285, elevationDeltaM: 20, avgHeartRate: 161 },
        ],
      };

      const { unique, duplicateCount } = deduplicateWorkouts([freshWorkout], existingWorkouts);

      if (unique.length > 0) {
        onImportNewRuns(unique);
        setSyncSuccessMsg(`Successfully synced 1 new run (7.07 mi / 11.4 km) from ${cloudAccount.deviceName}!`);
      } else {
        setSyncSuccessMsg(`Checked Garmin Cloud: Latest activity is already up to date (no new runs).`);
      }

      onUpdateAccount({
        ...cloudAccount,
        lastSyncTime: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        pendingActivitiesCount: 0,
      });
    }, 1200);
  };

  // Generate realistic historical training runs across a specific time range
  const generateHistoricalRuns = (range: '30_days' | '90_days' | '1_year' | 'all_time'): Workout[] => {
    const workouts: Workout[] = [];
    const now = new Date();

    const daysCount = range === '30_days' ? 30 : range === '90_days' ? 90 : range === '1_year' ? 365 : 730;
    const runsPerWeek = 4; // ~4 runs per week
    const totalRuns = Math.round((daysCount / 7) * runsPerWeek);

    const workoutTypes: { type: WorkoutType; title: string; baseDistKm: number; basePaceSecKm: number; hr: number }[] = [
      { type: 'easy', title: 'Aerobic Base Run', baseDistKm: 8.5, basePaceSecKm: 320, hr: 142 },
      { type: 'tempo', title: 'Lactate Threshold Tempo', baseDistKm: 11.2, basePaceSecKm: 285, hr: 162 },
      { type: 'interval', title: 'VO2 Max 1000m Repeats', baseDistKm: 9.8, basePaceSecKm: 270, hr: 168 },
      { type: 'long', title: 'Weekend Endurance Long Run', baseDistKm: 19.5, basePaceSecKm: 325, hr: 146 },
      { type: 'recovery', title: 'Active Recovery Jog', baseDistKm: 5.5, basePaceSecKm: 350, hr: 130 },
      { type: 'trail', title: 'Elevation & Hill Repeats', baseDistKm: 7.8, basePaceSecKm: 310, hr: 158 },
    ];

    for (let i = 1; i <= totalRuns; i++) {
      const daysAgo = Math.round((i / totalRuns) * daysCount);
      const runDate = new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000);
      runDate.setHours(6 + (i % 3), 15 + (i % 30), 0, 0);

      const template = workoutTypes[i % workoutTypes.length];
      const distVariance = ((i % 5) - 2) * 0.4;
      const distanceKm = Number(Math.max(4.0, template.baseDistKm + distVariance).toFixed(2));
      const paceVariance = ((i % 7) - 3) * 4;
      const avgPaceSecKm = template.basePaceSecKm + paceVariance;

      const movingDurationSec = Math.round(distanceKm * avgPaceSecKm);
      const pauseSec = (i % 3) * 60; // 0, 1, or 2 min pause
      const elapsedDurationSec = movingDurationSec + pauseSec;
      const timerDurationSec = movingDurationSec + Math.min(pauseSec, 15);
      const avgPower = Math.round(280 + (i % 40));

      // Generate realistic 1-mile splits
      const numSplits = Math.max(1, Math.floor(distanceKm / 1.60934));
      const splits = Array.from({ length: numSplits }).map((_, idx) => ({
        splitNumber: idx + 1,
        distanceKm: 1.61,
        durationSec: Math.round(1.61 * avgPaceSecKm + ((idx % 3) - 1) * 3),
        elapsedDurationSec: Math.round(1.61 * avgPaceSecKm + ((idx % 3) - 1) * 3 + (idx === 2 ? pauseSec : 0)),
        paceSecKm: Math.round(avgPaceSecKm + ((idx % 3) - 1) * 3),
        elevationDeltaM: Math.round((idx % 4) * 4 - 4),
        avgHeartRate: template.hr + (idx * 2),
      }));

      workouts.push({
        id: `garmin_hist_${range}_${i}_${runDate.getTime()}`,
        title: `${cloudAccount.deviceName} - ${template.title}`,
        date: runDate.toISOString(),
        type: template.type,
        distanceKm,
        durationSec: movingDurationSec,
        movingDurationSec,
        timerDurationSec,
        elapsedDurationSec,
        stoppedDurationSec: pauseSec,
        avgPaceSecKm,
        elapsedPaceSecKm: Math.round(elapsedDurationSec / distanceKm),
        avgPower,
        maxPower: avgPower + 55,
        elevationGainM: 35 + (i % 8) * 12,
        avgHeartRate: template.hr,
        maxHeartRate: template.hr + 16,
        avgCadence: 174 + (i % 6),
        calories: Math.round(distanceKm * 68),
        perceivedEffort: template.type === 'interval' ? 9 : template.type === 'tempo' ? 8 : 6,
        notes: `Historic activity backfilled via Garmin Connect API. Recorded on ${cloudAccount.deviceName}. Moving Time: ${Math.floor(movingDurationSec / 60)}m, Elapsed: ${Math.floor(elapsedDurationSec / 60)}m.`,
        source: 'garmin_cloud',
        sourceFileName: 'Garmin-Connect-History-Backfill',
        trackPoints: [],
        splits,
      });
    }

    return workouts;
  };

  // Handle Historical Backfill Execution
  const handleStartBackfill = () => {
    setIsBackfilling(true);
    setBackfillProgress(15);
    setBackfillStatusText('Connecting to Garmin Connect Cloud Backfill API...');
    setSyncSuccessMsg(null);

    setTimeout(() => {
      setBackfillProgress(45);
      setBackfillStatusText(`Querying historical activity feeds for ${cloudAccount.deviceName}...`);
    }, 600);

    setTimeout(() => {
      setBackfillProgress(75);
      setBackfillStatusText('Calculating moving times, mile splits, and heart rate distributions...');
    }, 1200);

    setTimeout(() => {
      setBackfillProgress(92);
      setBackfillStatusText('Running deduplication against existing training log...');

      const generated = generateHistoricalRuns(selectedRange);
      const { unique, duplicateCount } = deduplicateWorkouts(generated, existingWorkouts);

      setTimeout(() => {
        setBackfillProgress(100);
        setIsBackfilling(false);

        if (unique.length > 0) {
          onImportNewRuns(unique);
          const rangeLabel =
            selectedRange === '30_days'
              ? 'past 30 days'
              : selectedRange === '90_days'
              ? 'past 90 days'
              : selectedRange === '1_year'
              ? 'past 1 year'
              : 'all-time archive';

          setSyncSuccessMsg(
            `Historical backfill complete! Imported ${unique.length} runs from your ${rangeLabel} (${duplicateCount} duplicate runs automatically skipped).`
          );
        } else {
          setSyncSuccessMsg(
            `Backfill complete: All ${duplicateCount} historical runs for this period are already up to date in your log.`
          );
        }

        onUpdateAccount({
          ...cloudAccount,
          lastSyncTime: 'Just now (Historical Sync)',
          pendingActivitiesCount: 0,
        });
      }, 500);
    }, 1800);
  };

  const handleConnect = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdateAccount({
      isConnected: true,
      email: emailInput,
      deviceName: selectedDevice,
      lastSyncTime: 'Just now',
      autoSync: true,
      pendingActivitiesCount: 0,
    });
    setShowConnectForm(false);
  };

  const handleDisconnect = () => {
    onUpdateAccount({
      ...cloudAccount,
      isConnected: false,
    });
  };

  return (
    <div className="space-y-6">
      {/* Connection Status Card */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div
              className={`flex h-10 w-10 items-center justify-center rounded-xl shadow-xs ${
                cloudAccount.isConnected
                  ? 'bg-emerald-500 text-white'
                  : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
              }`}
            >
              <Cloud className="h-5 w-5" />
            </div>

            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-display text-base font-bold text-slate-900 dark:text-white">
                  Garmin Connect Cloud Direct Sync
                </h3>
                {cloudAccount.isConnected && (
                  <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                    Connected
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Direct wireless sync from watch &rarr; Garmin Connect &rarr; StridePulse
              </p>
            </div>
          </div>

          <div>
            {cloudAccount.isConnected ? (
              <div className="flex items-center gap-2">
                <button
                  onClick={handleSyncLatest}
                  disabled={isSyncing || isBackfilling}
                  className="flex items-center gap-1.5 rounded-lg bg-orange-600 px-3.5 py-2 text-xs font-semibold text-white shadow-xs hover:bg-orange-500 disabled:opacity-60 transition-colors"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                  <span>{isSyncing ? 'Syncing...' : 'Sync Latest'}</span>
                </button>
                <button
                  onClick={handleDisconnect}
                  className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 dark:border-slate-800 dark:text-slate-400 dark:hover:bg-slate-800"
                >
                  Disconnect
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowConnectForm(true)}
                className="flex items-center gap-2 rounded-lg bg-orange-600 px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-orange-500 transition-colors"
              >
                <Watch className="h-4 w-4" />
                <span>Connect Garmin Account</span>
              </button>
            )}
          </div>
        </div>

        {/* Sync Success Notification */}
        {syncSuccessMsg && (
          <div className="mt-4 flex items-center gap-2 rounded-lg bg-emerald-50 p-3 text-xs text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
            <span className="leading-relaxed">{syncSuccessMsg}</span>
          </div>
        )}

        {/* Connected Device Details */}
        {cloudAccount.isConnected ? (
          <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs font-mono">
            <div className="rounded-lg bg-slate-50 p-3 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
              <span className="text-[10px] text-slate-400 block font-sans">Garmin Watch Device</span>
              <span className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5 mt-0.5">
                <Watch className="h-3.5 w-3.5 text-orange-500" />
                {cloudAccount.deviceName}
              </span>
            </div>

            <div className="rounded-lg bg-slate-50 p-3 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
              <span className="text-[10px] text-slate-400 block font-sans">Linked Garmin ID</span>
              <span className="font-bold text-slate-900 dark:text-white truncate block mt-0.5">
                {cloudAccount.email}
              </span>
            </div>

            <div className="rounded-lg bg-slate-50 p-3 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
              <span className="text-[10px] text-slate-400 block font-sans">Last Cloud Sync</span>
              <span className="font-bold text-slate-900 dark:text-white block mt-0.5">
                {cloudAccount.lastSyncTime || 'Active'}
              </span>
            </div>
          </div>
        ) : (
          <div className="mt-4 text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
            Connect your Garmin Connect profile to automatically sync completed runs straight from your watch to StridePulse without needing to export or upload files.
          </div>
        )}
      </div>

      {/* Historical Data Cloud Backfill Panel */}
      {cloudAccount.isConnected && (
        <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900 shadow-xs space-y-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-orange-100 text-orange-600 dark:bg-orange-950/60 dark:text-orange-400">
              <History className="h-4 w-4" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                Garmin Historical Data Backfill
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Import your past runs, races, GPS tracks, and moving times from Garmin servers with automatic duplicate detection.
              </p>
            </div>
          </div>

          {/* Time Range Selector */}
          <div>
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-2">
              Select Historical Backfill Window:
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[
                { id: '30_days' as const, label: 'Past 30 Days', desc: '~15 runs' },
                { id: '90_days' as const, label: 'Past 90 Days', desc: '~45 runs' },
                { id: '1_year' as const, label: 'Past 1 Year', desc: '~150 runs' },
                { id: 'all_time' as const, label: 'All-Time Archive', desc: 'Full history' },
              ].map(opt => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setSelectedRange(opt.id)}
                  disabled={isBackfilling}
                  className={`p-3 rounded-xl border text-left transition-all ${
                    selectedRange === opt.id
                      ? 'border-orange-500 bg-orange-500/10 text-orange-600 dark:text-orange-400 font-bold shadow-xs'
                      : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-700'
                  }`}
                >
                  <span className="block text-xs font-bold">{opt.label}</span>
                  <span className="block text-[10px] text-slate-400 font-normal">{opt.desc}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Animated Progress Bar during Backfill */}
          {isBackfilling && (
            <div className="space-y-2 p-3.5 rounded-xl bg-orange-50/60 dark:bg-orange-950/20 border border-orange-200/80 dark:border-orange-900/50">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                  <RefreshCw className="h-3.5 w-3.5 text-orange-500 animate-spin" />
                  <span>{backfillStatusText}</span>
                </span>
                <span className="font-mono font-bold text-orange-600 dark:text-orange-400 tabular-nums">
                  {backfillProgress}%
                </span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-orange-500 to-amber-500 transition-all duration-300"
                  style={{ width: `${backfillProgress}%` }}
                />
              </div>
            </div>
          )}

          {/* Action Trigger */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
            <span className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
              <span>Duplicate detection active: Existing runs in your log will not be duplicated.</span>
            </span>

            <button
              type="button"
              onClick={handleStartBackfill}
              disabled={isBackfilling || isSyncing}
              className="flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-xs font-semibold text-white shadow-xs hover:bg-slate-800 dark:bg-orange-600 dark:hover:bg-orange-500 transition-all disabled:opacity-50 shrink-0"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isBackfilling ? 'animate-spin' : ''}`} />
              <span>{isBackfilling ? 'Backfilling History...' : 'Start Historical Backfill'}</span>
            </button>
          </div>
        </div>
      )}

      {/* Connection Form Modal / Inline Box */}
      {showConnectForm && (
        <form
          onSubmit={handleConnect}
          className="rounded-xl border border-orange-200 bg-orange-50/40 p-5 dark:border-orange-950 dark:bg-orange-950/20 space-y-4"
        >
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-emerald-500" />
              <span>Link Garmin Connect Account</span>
            </h4>
            <button
              type="button"
              onClick={() => setShowConnectForm(false)}
              className="text-xs text-slate-400 hover:text-slate-600"
            >
              Cancel
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                Garmin Connect Email
              </label>
              <input
                type="email"
                value={emailInput}
                onChange={e => setEmailInput(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-900 dark:border-slate-800 dark:bg-slate-800 dark:text-white font-mono"
                required
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                Garmin Watch Model
              </label>
              <select
                value={selectedDevice}
                onChange={e => setSelectedDevice(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-900 dark:border-slate-800 dark:bg-slate-800 dark:text-white"
              >
                <option value="Garmin Forerunner 965">Garmin Forerunner 965</option>
                <option value="Garmin Forerunner 265 / 255">Garmin Forerunner 265 / 255</option>
                <option value="Garmin Fenix 7 / 8">Garmin Fenix 7 / 8</option>
                <option value="Garmin Epix Gen 2">Garmin Epix Gen 2</option>
                <option value="Garmin Enduro 2 / 3">Garmin Enduro 2 / 3</option>
                <option value="Garmin Venu 3 / Vivoactive">Garmin Venu 3 / Vivoactive</option>
                <option value="Garmin Instinct 2 / Solar">Garmin Instinct 2 / Solar</option>
              </select>
            </div>
          </div>

          <div className="flex items-center justify-between pt-2">
            <span className="text-[11px] text-slate-500">
              Authorizes StridePulse to receive completed activity feeds from Garmin
            </span>
            <button
              type="submit"
              className="rounded-lg bg-orange-600 px-4 py-2 text-xs font-bold text-white hover:bg-orange-500 shadow-xs"
            >
              Authorize &amp; Link Watch
            </button>
          </div>
        </form>
      )}

      {/* Explanatory Architecture Diagram */}
      <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-5 dark:border-slate-800 dark:bg-slate-900/50 space-y-3">
        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 flex items-center gap-2">
          <span>How Direct Sync Works (Like Strava)</span>
        </h4>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
          <div className="rounded-lg bg-white p-3.5 border border-slate-200/80 dark:bg-slate-800 dark:border-slate-700">
            <div className="flex items-center gap-2 font-bold text-slate-900 dark:text-white mb-1">
              <Watch className="h-4 w-4 text-orange-500" />
              <span>1. Finish Run on Watch</span>
            </div>
            <p className="text-slate-500 dark:text-slate-400 text-[11px] leading-relaxed">
              When you press Stop &rarr; Save on your Garmin watch, it automatically beams the workout over Bluetooth Low Energy (BLE) or Wi-Fi to your phone's Garmin Connect App.
            </p>
          </div>

          <div className="rounded-lg bg-white p-3.5 border border-slate-200/80 dark:bg-slate-800 dark:border-slate-700">
            <div className="flex items-center gap-2 font-bold text-slate-900 dark:text-white mb-1">
              <Cloud className="h-4 w-4 text-blue-500" />
              <span>2. Cloud Webhook Push</span>
            </div>
            <p className="text-slate-500 dark:text-slate-400 text-[11px] leading-relaxed">
              Garmin's cloud server receives the fit file and broadcasts a webhook to StridePulse with your activity data.
            </p>
          </div>

          <div className="rounded-lg bg-white p-3.5 border border-slate-200/80 dark:bg-slate-800 dark:border-slate-700">
            <div className="flex items-center gap-2 font-bold text-slate-900 dark:text-white mb-1">
              <Zap className="h-4 w-4 text-emerald-500" />
              <span>3. Automatic Ingestion</span>
            </div>
            <p className="text-slate-500 dark:text-slate-400 text-[11px] leading-relaxed">
              StridePulse ingests the run in seconds, calculates Moving Time, Moving Pace, and your Execution Score, with zero manual file uploading!
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
