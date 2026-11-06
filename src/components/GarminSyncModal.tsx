import React, { useState, useRef } from 'react';
import JSZip from 'jszip';
import { Workout, WorkoutType, GarminCloudAccount } from '../types/workout';
import { parseGPX, parseTCX, parseFIT, formatPace, formatDuration } from '../utils/parsers';
import { deduplicateWorkouts } from '../utils/deduplication';
import { GarminCloudSyncHub } from './GarminCloudSyncHub';
import {
  Watch,
  UploadCloud,
  FileCode,
  CheckCircle,
  AlertCircle,
  X,
  PlusCircle,
  Cloud,
  KeyRound,
  Layers,
  FolderArchive,
  ChevronRight,
  ShieldCheck,
} from 'lucide-react';

interface GarminSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddWorkout: (workout: Workout) => void;
  onBulkAddWorkouts: (workouts: Workout[]) => void;
  cloudAccount: GarminCloudAccount;
  onUpdateCloudAccount: (acc: GarminCloudAccount) => void;
  distanceUnit: 'km' | 'mi';
  existingWorkouts: Workout[];
}

export const GarminSyncModal: React.FC<GarminSyncModalProps> = ({
  isOpen,
  onClose,
  onAddWorkout,
  onBulkAddWorkouts,
  cloudAccount,
  onUpdateCloudAccount,
  distanceUnit,
  existingWorkouts,
}) => {
  const [activeTab, setActiveTab] = useState<'cloud' | 'upload' | 'manual'>('cloud');
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStatus, setProcessingStatus] = useState('');
  const [batchResults, setBatchResults] = useState<{
    unique: Workout[];
    duplicateCount: number;
    errorsCount: number;
  } | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Manual entry state
  const [manualTitle, setManualTitle] = useState('Afternoon Aerobic Run');
  const [manualType, setManualType] = useState<WorkoutType>('easy');
  const [manualDistance, setManualDistance] = useState('7.5');
  const [manualMinutes, setManualMinutes] = useState('42');
  const [manualSeconds, setManualSeconds] = useState('30');
  const [manualHr, setManualHr] = useState('142');
  const [manualElevation, setManualElevation] = useState('35');

  if (!isOpen) return null;

  const unitMultiplier = distanceUnit === 'mi' ? 0.621371 : 1.0;
  const unitLabel = distanceUnit;

  // Process a batch of files (including extracting files from ZIP archives)
  const processBatchFiles = async (fileList: FileList | File[]) => {
    setIsProcessing(true);
    setParseError(null);
    setBatchResults(null);
    setProcessingStatus('Inspecting files and archives...');

    const parsedWorkouts: Workout[] = [];
    let errorsCount = 0;

    try {
      // Step 1: Collect all raw activity files, extracting ZIPs if present
      const rawActivityFiles: { name: string; buffer: ArrayBuffer; text?: string }[] = [];

      for (let i = 0; i < fileList.length; i++) {
        const file = fileList[i];
        const lowerName = file.name.toLowerCase();

        if (lowerName.endsWith('.zip')) {
          setProcessingStatus(`Unpacking Garmin ZIP archive: ${file.name}...`);
          const zipBuffer = await file.arrayBuffer();
          const zip = await JSZip.loadAsync(zipBuffer);

          const entries = Object.keys(zip.files);
          for (const entryName of entries) {
            const entry = zip.files[entryName];
            if (entry.dir) continue;
            const entryLower = entryName.toLowerCase();
            if (entryLower.endsWith('.fit') || entryLower.endsWith('.tcx') || entryLower.endsWith('.gpx')) {
              const buffer = await entry.async('arraybuffer');
              rawActivityFiles.push({ name: entryName, buffer });
            }
          }
        } else if (lowerName.endsWith('.fit')) {
          const buffer = await file.arrayBuffer();
          rawActivityFiles.push({ name: file.name, buffer });
        } else if (lowerName.endsWith('.tcx') || lowerName.endsWith('.gpx')) {
          const text = await file.text();
          const buffer = await file.arrayBuffer();
          rawActivityFiles.push({ name: file.name, buffer, text });
        }
      }

      if (rawActivityFiles.length === 0) {
        throw new Error('No valid .FIT, .TCX, .GPX, or .ZIP files detected in upload.');
      }

      // Step 2: Parse each extracted activity
      for (let i = 0; i < rawActivityFiles.length; i++) {
        const item = rawActivityFiles[i];
        setProcessingStatus(`Parsing activity ${i + 1} of ${rawActivityFiles.length}: ${item.name}...`);
        const lowerName = item.name.toLowerCase();

        try {
          if (lowerName.endsWith('.fit')) {
            const workout = parseFIT(item.buffer, item.name);
            parsedWorkouts.push(workout);
          } else if (lowerName.endsWith('.gpx') && item.text) {
            const workout = parseGPX(item.text, item.name);
            parsedWorkouts.push(workout);
          } else if (lowerName.endsWith('.tcx') && item.text) {
            const workout = parseTCX(item.text, item.name);
            parsedWorkouts.push(workout);
          }
        } catch (fileErr) {
          console.warn(`Error parsing ${item.name}:`, fileErr);
          errorsCount++;
        }
      }

      // Step 3: Run deduplication against existing workouts
      const { unique, duplicateCount } = deduplicateWorkouts(parsedWorkouts, existingWorkouts);

      setBatchResults({
        unique,
        duplicateCount,
        errorsCount,
      });
    } catch (err: any) {
      setParseError(err.message || 'Failed to process batch files.');
    } finally {
      setIsProcessing(false);
      setProcessingStatus('');
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processBatchFiles(e.dataTransfer.files);
    }
  };

  const handleConfirmBatchImport = () => {
    if (batchResults && batchResults.unique.length > 0) {
      onBulkAddWorkouts(batchResults.unique);
      onClose();
    }
  };

  const handleSaveManual = (e: React.FormEvent) => {
    e.preventDefault();
    const distNum = parseFloat(manualDistance) || 5;
    const durSec = (parseInt(manualMinutes, 10) || 0) * 60 + (parseInt(manualSeconds, 10) || 0);
    const avgPace = distNum > 0 ? Math.round(durSec / distNum) : 330;

    const newWorkout: Workout = {
      id: 'manual_' + Date.now(),
      title: manualTitle || 'Manual Running Workout',
      date: new Date().toISOString(),
      type: manualType,
      distanceKm: distNum,
      durationSec: durSec,
      movingDurationSec: durSec,
      timerDurationSec: durSec,
      elapsedDurationSec: durSec,
      avgPaceSecKm: avgPace,
      elevationGainM: parseInt(manualElevation, 10) || 0,
      avgHeartRate: parseInt(manualHr, 10) || undefined,
      maxHeartRate: (parseInt(manualHr, 10) || 150) + 16,
      avgCadence: 172,
      calories: Math.round(distNum * 68),
      perceivedEffort: 6,
      notes: 'Manually logged running workout',
      source: 'manual',
      trackPoints: [],
      splits: [],
    };

    onAddWorkout(newWorkout);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900 transition-colors">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 p-5 dark:border-slate-800 sticky top-0 bg-white dark:bg-slate-900 z-10">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-orange-500/10 text-orange-600 dark:bg-orange-500/20 dark:text-orange-400">
              <Watch className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-display text-base font-bold text-slate-900 dark:text-white">
                Garmin Watch &amp; Activity Synchronization
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Direct Personal API Sync, Multi-File &amp; ZIP Archive Ingestion
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

        {/* Tab Selector */}
        <div className="flex border-b border-slate-100 px-5 pt-3 bg-slate-50/50 dark:border-slate-800 dark:bg-slate-900/50 gap-1 overflow-x-auto">
          <button
            onClick={() => {
              setActiveTab('cloud');
              setBatchResults(null);
            }}
            className={`flex items-center gap-2 rounded-t-lg py-2.5 px-3.5 text-xs font-semibold whitespace-nowrap border-b-2 transition-all ${
              activeTab === 'cloud'
                ? 'border-orange-500 text-orange-600 dark:text-orange-400 bg-white dark:bg-slate-900 shadow-xs'
                : 'border-transparent text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
            }`}
          >
            <KeyRound className="h-4 w-4" />
            <span>Garmin Personal API</span>
          </button>

          <button
            onClick={() => setActiveTab('upload')}
            className={`flex items-center gap-2 rounded-t-lg py-2.5 px-3.5 text-xs font-semibold whitespace-nowrap border-b-2 transition-all ${
              activeTab === 'upload'
                ? 'border-orange-500 text-orange-600 dark:text-orange-400 bg-white dark:bg-slate-900 shadow-xs'
                : 'border-transparent text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
            }`}
          >
            <FolderArchive className="h-4 w-4" />
            <span>Batch Files &amp; ZIP Archive</span>
          </button>

          <button
            onClick={() => {
              setActiveTab('manual');
              setBatchResults(null);
            }}
            className={`rounded-t-lg py-2.5 px-3.5 text-xs font-semibold whitespace-nowrap border-b-2 transition-all ${
              activeTab === 'manual'
                ? 'border-orange-500 text-orange-600 dark:text-orange-400 bg-white dark:bg-slate-900 shadow-xs'
                : 'border-transparent text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
            }`}
          >
            Manual Log
          </button>
        </div>

        {/* Body content based on active tab */}
        <div className="p-5">
          {activeTab === 'cloud' && (
            <GarminCloudSyncHub
              cloudAccount={cloudAccount}
              onUpdateAccount={onUpdateCloudAccount}
              onImportNewRuns={runs => {
                onBulkAddWorkouts(runs);
              }}
              distanceUnit={distanceUnit}
              existingWorkouts={existingWorkouts}
              onSwitchToZipTab={() => setActiveTab('upload')}
            />
          )}

          {activeTab === 'upload' && (
            <div className="space-y-5">
              {/* Dropzone */}
              <div
                onDragOver={e => {
                  e.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`flex flex-col items-center justify-center rounded-2xl border-2 border-dashed p-8 text-center cursor-pointer transition-all ${
                  isDragging
                    ? 'border-orange-500 bg-orange-50/50 dark:bg-orange-950/20'
                    : 'border-slate-200 hover:border-orange-400 bg-slate-50/50 dark:border-slate-800 dark:bg-slate-900/40'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept=".fit,.gpx,.tcx,.zip,application/zip"
                  className="hidden"
                  onChange={e => {
                    if (e.target.files && e.target.files.length > 0) {
                      processBatchFiles(e.target.files);
                    }
                  }}
                />

                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-orange-100 text-orange-600 dark:bg-orange-950/60 dark:text-orange-400 mb-3 shadow-xs">
                  <UploadCloud className="h-7 w-7" />
                </div>
                <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                  Drop your Garmin activity files or Connect ZIP archive here
                </h4>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 max-w-sm">
                  Drag &amp; drop multiple <span className="font-mono font-semibold">.FIT</span>,{' '}
                  <span className="font-mono font-semibold">.TCX</span>,{' '}
                  <span className="font-mono font-semibold">.GPX</span> files or a full Garmin Connect{' '}
                  <span className="font-mono font-semibold">.ZIP</span> archive.
                </p>
                <span className="mt-3 text-xs text-orange-600 dark:text-orange-400 font-bold hover:underline">
                  Click to select multiple files from your computer
                </span>
              </div>

              {/* Processing Progress */}
              {isProcessing && (
                <div className="p-4 rounded-xl bg-orange-50/60 dark:bg-orange-950/20 border border-orange-200/80 dark:border-orange-900/50 space-y-2">
                  <div className="flex items-center gap-2.5 text-xs font-semibold text-slate-800 dark:text-slate-200">
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-orange-500 border-t-transparent shrink-0" />
                    <span>{processingStatus}</span>
                  </div>
                </div>
              )}

              {/* Error message */}
              {parseError && (
                <div className="flex items-start gap-2.5 rounded-xl bg-rose-50 p-3.5 text-xs text-rose-700 dark:bg-rose-950/50 dark:text-rose-300 border border-rose-200 dark:border-rose-900">
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>{parseError}</span>
                </div>
              )}

              {/* Batch Parsing Results Preview */}
              {batchResults && (
                <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 shadow-xs">
                  {/* Summary Bar */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
                    <div>
                      <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                        <CheckCircle className="h-4 w-4 text-emerald-500" />
                        <span>Parsed {batchResults.unique.length + batchResults.duplicateCount} Activities</span>
                      </h4>
                      <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                          {batchResults.unique.length} new runs ready
                        </span>
                        <span>·</span>
                        <span className="text-slate-400">
                          {batchResults.duplicateCount} duplicates skipped
                        </span>
                        {batchResults.errorsCount > 0 && (
                          <>
                            <span>·</span>
                            <span className="text-rose-500">{batchResults.errorsCount} unreadable files</span>
                          </>
                        )}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={handleConfirmBatchImport}
                      disabled={batchResults.unique.length === 0}
                      className="rounded-xl bg-orange-600 px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-orange-500 disabled:opacity-50 transition-colors"
                    >
                      Import {batchResults.unique.length} New Runs
                    </button>
                  </div>

                  {/* List of preview items (first 5) */}
                  <div className="max-h-56 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/80 pr-1">
                    {batchResults.unique.slice(0, 8).map(w => (
                      <div key={w.id} className="py-2 flex items-center justify-between text-xs">
                        <div className="truncate mr-3">
                          <p className="font-semibold text-slate-900 dark:text-white truncate">{w.title}</p>
                          <p className="text-[11px] text-slate-400 font-mono">
                            {new Date(w.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} · {w.sourceFileName}
                          </p>
                        </div>
                        <div className="text-right shrink-0 font-mono">
                          <span className="font-bold text-slate-900 dark:text-white block">
                            {(w.distanceKm * unitMultiplier).toFixed(2)} {unitLabel}
                          </span>
                          <span className="text-[10px] text-cyan-600 dark:text-cyan-400">
                            {formatPace(w.avgPaceSecKm, distanceUnit)}
                          </span>
                        </div>
                      </div>
                    ))}
                    {batchResults.unique.length > 8 && (
                      <p className="pt-2 text-center text-xs text-slate-400 italic">
                        + {batchResults.unique.length - 8} more activities ready to import
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'manual' && (
            <form onSubmit={handleSaveManual} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                  Workout Title
                </label>
                <input
                  type="text"
                  value={manualTitle}
                  onChange={e => setManualTitle(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                    Activity Type
                  </label>
                  <select
                    value={manualType}
                    onChange={e => setManualType(e.target.value as WorkoutType)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  >
                    <option value="easy">Easy Run</option>
                    <option value="tempo">Tempo Run</option>
                    <option value="intervals">Intervals</option>
                    <option value="long_run">Long Run</option>
                    <option value="recovery">Recovery</option>
                    <option value="race">Race</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                    Distance (KM)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={manualDistance}
                    onChange={e => setManualDistance(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-white font-mono"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                    Minutes
                  </label>
                  <input
                    type="number"
                    value={manualMinutes}
                    onChange={e => setManualMinutes(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-white font-mono"
                    required
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                    Seconds
                  </label>
                  <input
                    type="number"
                    value={manualSeconds}
                    onChange={e => setManualSeconds(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-white font-mono"
                    required
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                    Avg HR (BPM)
                  </label>
                  <input
                    type="number"
                    value={manualHr}
                    onChange={e => setManualHr(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-white font-mono"
                  />
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  className="rounded-xl bg-orange-600 px-5 py-2 text-xs font-bold text-white hover:bg-orange-500 shadow-xs"
                >
                  Save Workout
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
