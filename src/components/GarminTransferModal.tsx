import React, { useState } from 'react';
import { PlannedWorkout } from '../types/workout';
import { downloadGarminFitFile } from '../utils/fitWorkoutGenerator';
import {
  Watch,
  Download,
  FolderSync,
  CheckCircle2,
  HelpCircle,
  X,
  ArrowRight,
  Usb,
  Smartphone,
  Flame,
} from 'lucide-react';

interface GarminTransferModalProps {
  isOpen: boolean;
  onClose: () => void;
  workout: PlannedWorkout | null;
  distanceUnit: 'km' | 'mi';
}

export const GarminTransferModal: React.FC<GarminTransferModalProps> = ({
  isOpen,
  onClose,
  workout,
  distanceUnit,
}) => {
  const [downloaded, setDownloaded] = useState(false);

  if (!isOpen || !workout) return null;

  const handleDownload = () => {
    downloadGarminFitFile(workout);
    setDownloaded(true);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900 transition-colors">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 p-5 dark:border-slate-800 sticky top-0 bg-white dark:bg-slate-900 z-10">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-500/10 text-orange-600 dark:bg-orange-500/20 dark:text-orange-400">
              <Watch className="h-6 w-6" />
            </div>
            <div>
              <h3 className="font-display text-base font-bold text-slate-900 dark:text-white">
                Garmin Watch Sync &amp; Transfer
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                How StridePulse workouts sync to your Garmin watch and back
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

        <div className="p-6 space-y-6">
          {/* Workout Summary Badge */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between rounded-xl bg-orange-50/70 p-4 border border-orange-200 dark:bg-orange-950/20 dark:border-orange-900/40 gap-4">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-orange-600 dark:text-orange-400 block mb-0.5">
                Target Structured Workout
              </span>
              <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                {workout.title}
              </h4>
              <p className="text-xs text-slate-600 dark:text-slate-300 mt-1">
                {workout.steps.length} Steps · {workout.targetPaceSummary}
              </p>
            </div>

            <button
              onClick={handleDownload}
              className="flex items-center justify-center gap-2 rounded-xl bg-orange-600 px-4 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-orange-500 transition-colors shrink-0"
            >
              <Download className="h-4 w-4" />
              <span>Download .FIT Workout File</span>
            </button>
          </div>

          {downloaded && (
            <div className="flex items-center gap-2 rounded-lg bg-emerald-50 p-3 text-xs text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              <span>FIT Workout file downloaded! Follow Step 2 below to place it onto your watch.</span>
            </div>
          )}

          {/* 3-Step Visual Transfer Flow */}
          <div className="space-y-4">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              How the 2-Way Sync Works:
            </h4>

            {/* Step 1: Export from App */}
            <div className="flex items-start gap-3.5 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-800/40">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-orange-100 text-orange-600 dark:bg-orange-950 dark:text-orange-400 font-bold text-xs shrink-0">
                1
              </div>
              <div className="text-xs">
                <span className="font-bold text-slate-900 dark:text-white block">
                  Export Native Garmin Workout File
                </span>
                <p className="text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">
                  Click the orange download button above. StridePulse generates a genuine binary <code className="font-mono text-orange-600 dark:text-orange-400 font-semibold">.FIT</code> workout file encoded with Garmin message #26 (workout) and message #27 (workout steps with target pace windows).
                </p>
              </div>
            </div>

            {/* Step 2: Push to Garmin Watch */}
            <div className="flex items-start gap-3.5 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-800/40">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-orange-100 text-orange-600 dark:bg-orange-950 dark:text-orange-400 font-bold text-xs shrink-0">
                2
              </div>
              <div className="text-xs">
                <span className="font-bold text-slate-900 dark:text-white block">
                  Copy to Watch Storage (Direct USB)
                </span>
                <p className="text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">
                  Plug your Garmin watch into your computer using its USB charging cable. Open the Garmin drive and drop the downloaded file directly into:
                </p>
                <div className="mt-2 rounded-lg bg-slate-100 px-3 py-1.5 font-mono text-[11px] text-slate-800 dark:bg-slate-800 dark:text-slate-200 font-semibold">
                  GARMIN / NEWFILES /
                </div>
                <p className="text-slate-500 dark:text-slate-400 mt-1.5 leading-relaxed">
                  Unplug your watch. The Garmin operating system automatically parses the file and registers it inside:
                  <span className="font-semibold text-slate-700 dark:text-slate-300"> Run &rarr; Up (Menu) &rarr; Training &rarr; Workouts &rarr; "{workout.title}"</span>.
                </p>
              </div>
            </div>

            {/* Step 3: Run with Live Cues */}
            <div className="flex items-start gap-3.5 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-800/40">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-orange-100 text-orange-600 dark:bg-orange-950 dark:text-orange-400 font-bold text-xs shrink-0">
                3
              </div>
              <div className="text-xs">
                <span className="font-bold text-slate-900 dark:text-white block">
                  Run with Live Watch Audio &amp; Vibration Cues
                </span>
                <p className="text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">
                  Select <span className="font-semibold text-slate-700 dark:text-slate-300">"Do Workout"</span> on your watch. During the run, your watch beeps and vibrates if your pace is too fast or too slow, autolaps each interval, and guides recovery steps.
                </p>
              </div>
            </div>

            {/* Step 4: Sync Back for Execution Score */}
            <div className="flex items-start gap-3.5 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-800/40">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-100 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400 font-bold text-xs shrink-0">
                4
              </div>
              <div className="text-xs">
                <span className="font-bold text-slate-900 dark:text-white block">
                  Sync Back &rarr; Instant "Execution Score"
                </span>
                <p className="text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">
                  When you complete your run, drop the recorded activity file (<code className="font-mono">GARMIN/ACTIVITY/*.FIT</code> or export from Garmin Connect) into StridePulse. StridePulse matches the completed run against your planned workout and computes your <strong className="text-emerald-600 dark:text-emerald-400">Execution Score (0-100%)</strong> with step-by-step target accuracy!
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-slate-100 p-4 dark:border-slate-800 flex justify-end bg-slate-50/50 dark:bg-slate-900/50 sticky bottom-0">
          <button
            onClick={onClose}
            className="rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 dark:bg-orange-600 dark:hover:bg-orange-500"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
