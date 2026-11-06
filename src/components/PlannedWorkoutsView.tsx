import React, { useState } from 'react';
import {
  PlannedWorkout,
  WorkoutStep,
  Workout,
  StepType,
  WorkoutType,
} from '../types/workout';
import { formatPace, formatDuration, isSameDay } from '../utils/parsers';
import { GarminTransferModal } from './GarminTransferModal';
import { GarminCalendarView } from './GarminCalendarView';
import {
  Plus,
  Watch,
  Trophy,
  Calendar as CalendarIcon,
  CheckCircle2,
  Clock,
  ArrowRight,
  Trash2,
  Edit3,
  Copy,
  ChevronUp,
  ChevronDown,
  Target,
  Sparkles,
  Layers,
  Activity,
  Flame,
  LayoutGrid,
} from 'lucide-react';

interface PlannedWorkoutsViewProps {
  plannedWorkouts: PlannedWorkout[];
  completedWorkouts: Workout[];
  onAddPlannedWorkout: (workout: PlannedWorkout) => void;
  onUpdatePlannedWorkout?: (workout: PlannedWorkout) => void;
  onDeletePlannedWorkout: (id: string) => void;
  onSelectCompletedWorkout: (workout: Workout) => void;
  onScheduleWorkoutToDate?: (planId: string, dateIso: string) => void;
  distanceUnit: 'km' | 'mi';
}

// Editable Step working state for the modal
interface StepFormState {
  id: string;
  name: string;
  stepType: StepType;
  durationType: 'distance' | 'time';
  distanceValue: number;
  distanceUnit: 'mi' | 'km' | 'm';
  timeMinutes: number;
  timeSeconds: number;
  targetType: 'pace' | 'open';
  targetPaceSlowMin: number;
  targetPaceSlowSec: number;
  targetPaceFastMin: number;
  targetPaceFastSec: number;
  notes?: string;
}

// Convert WorkoutStep to StepFormState
function stepToFormState(step: WorkoutStep, displayUnit: 'km' | 'mi'): StepFormState {
  let distVal = 1.0;
  let distUnit: 'mi' | 'km' | 'm' = displayUnit;
  if (step.durationType === 'distance') {
    if (displayUnit === 'mi') {
      distVal = Number((step.durationValue / 1609.344).toFixed(2));
      distUnit = 'mi';
    } else {
      if (step.durationValue < 1000) {
        distVal = Math.round(step.durationValue);
        distUnit = 'm';
      } else {
        distVal = Number((step.durationValue / 1000).toFixed(2));
        distUnit = 'km';
      }
    }
  }

  const timeMin = Math.floor((step.durationValue || 60) / 60);
  const timeSec = Math.round((step.durationValue || 60) % 60);

  let slowMin = 8;
  let slowSec = 30;
  let fastMin = 8;
  let fastSec = 0;

  if (step.targetPaceMinSecKm && step.targetPaceMaxSecKm) {
    const factor = displayUnit === 'mi' ? 1.609344 : 1.0;
    const slowTotalSec = Math.round(step.targetPaceMaxSecKm * factor);
    const fastTotalSec = Math.round(step.targetPaceMinSecKm * factor);

    slowMin = Math.floor(slowTotalSec / 60);
    slowSec = slowTotalSec % 60;
    fastMin = Math.floor(fastTotalSec / 60);
    fastSec = fastTotalSec % 60;
  }

  return {
    id: step.id,
    name: step.name,
    stepType: step.stepType,
    durationType: step.durationType,
    distanceValue: distVal,
    distanceUnit: distUnit,
    timeMinutes: timeMin,
    timeSeconds: timeSec,
    targetType: step.targetType === 'pace' ? 'pace' : 'open',
    targetPaceSlowMin: slowMin,
    targetPaceSlowSec: slowSec,
    targetPaceFastMin: fastMin,
    targetPaceFastSec: fastSec,
    notes: step.notes,
  };
}

// Convert StepFormState back to WorkoutStep
function formStateToStep(st: StepFormState, displayUnit: 'km' | 'mi'): WorkoutStep {
  let durationValue = 1000;

  if (st.durationType === 'distance') {
    if (st.distanceUnit === 'mi') {
      durationValue = Math.round(st.distanceValue * 1609.344);
    } else if (st.distanceUnit === 'km') {
      durationValue = Math.round(st.distanceValue * 1000);
    } else {
      durationValue = Math.round(st.distanceValue);
    }
  } else {
    durationValue = Math.max(1, st.timeMinutes * 60 + st.timeSeconds);
  }

  let targetPaceMinSecKm: number | undefined;
  let targetPaceMaxSecKm: number | undefined;

  if (st.targetType === 'pace') {
    const factor = displayUnit === 'mi' ? 1.609344 : 1.0;
    const slowTotalSec = st.targetPaceSlowMin * 60 + st.targetPaceSlowSec;
    const fastTotalSec = st.targetPaceFastMin * 60 + st.targetPaceFastSec;

    targetPaceMaxSecKm = Math.round(Math.max(slowTotalSec, fastTotalSec) / factor);
    targetPaceMinSecKm = Math.round(Math.min(slowTotalSec, fastTotalSec) / factor);
  }

  return {
    id: st.id || 'step_' + Date.now() + Math.random(),
    name: st.name.trim() || 'Interval Step',
    stepType: st.stepType,
    durationType: st.durationType,
    durationValue,
    targetType: st.targetType,
    targetPaceMinSecKm,
    targetPaceMaxSecKm,
    notes: st.notes,
  };
}

export const PlannedWorkoutsView: React.FC<PlannedWorkoutsViewProps> = ({
  plannedWorkouts,
  completedWorkouts,
  onAddPlannedWorkout,
  onUpdatePlannedWorkout,
  onDeletePlannedWorkout,
  onSelectCompletedWorkout,
  onScheduleWorkoutToDate,
  distanceUnit,
}) => {
  // Primary view toggle: 'calendar' (Garmin Connect monthly calendar) vs 'library' (cards)
  const [viewMode, setViewMode] = useState<'calendar' | 'library'>('calendar');

  const [isCreatorOpen, setIsCreatorOpen] = useState(false);
  const [editingWorkout, setEditingWorkout] = useState<PlannedWorkout | null>(null);
  const [activeTransferWorkout, setActiveTransferWorkout] = useState<PlannedWorkout | null>(null);

  // Form Fields
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<WorkoutType>('tempo');
  const [description, setDescription] = useState('');
  const [scheduledDateStr, setScheduledDateStr] = useState('2026-11-05');
  const [steps, setSteps] = useState<StepFormState[]>([]);

  // Open modal for CREATING a brand new workout
  const handleOpenCreateModal = (initialDateIso?: string) => {
    setEditingWorkout(null);
    setTitle('Tempo Run (8.00 mi)');
    setCategory('tempo');
    setDescription('2 mile warm-up, 4 miles at tempo effort (6\'20"-6\'00" /mi), 2 mile cool-down.');
    const dStr = initialDateIso ? initialDateIso.slice(0, 10) : '2026-11-05';
    setScheduledDateStr(dStr);
    setSteps([
      {
        id: 'step_1',
        name: 'Warm Up',
        stepType: 'warmup',
        durationType: 'distance',
        distanceValue: 2.0,
        distanceUnit: 'mi',
        timeMinutes: 16,
        timeSeconds: 0,
        targetType: 'pace',
        targetPaceSlowMin: 8,
        targetPaceSlowSec: 30,
        targetPaceFastMin: 8,
        targetPaceFastSec: 0,
      },
      {
        id: 'step_2',
        name: 'Training',
        stepType: 'interval',
        durationType: 'distance',
        distanceValue: 4.0,
        distanceUnit: 'mi',
        timeMinutes: 25,
        timeSeconds: 0,
        targetType: 'pace',
        targetPaceSlowMin: 6,
        targetPaceSlowSec: 20,
        targetPaceFastMin: 6,
        targetPaceFastSec: 0,
      },
      {
        id: 'step_3',
        name: 'Cool Down',
        stepType: 'cooldown',
        durationType: 'distance',
        distanceValue: 2.0,
        distanceUnit: 'mi',
        timeMinutes: 16,
        timeSeconds: 0,
        targetType: 'pace',
        targetPaceSlowMin: 8,
        targetPaceSlowSec: 30,
        targetPaceFastMin: 8,
        targetPaceFastSec: 0,
      },
    ]);
    setIsCreatorOpen(true);
  };

  // Open modal for EDITING an existing workout
  const handleOpenEditModal = (plan: PlannedWorkout) => {
    setEditingWorkout(plan);
    setTitle(plan.title);
    setCategory(plan.type);
    setDescription(plan.description);
    setScheduledDateStr(plan.scheduledDate ? plan.scheduledDate.slice(0, 10) : '2026-11-05');
    setSteps(plan.steps.map(s => stepToFormState(s, distanceUnit)));
    setIsCreatorOpen(true);
  };

  // Apply quick presets
  const handleApplyPreset = (presetKey: string) => {
    if (presetKey === 'fs_tempo') {
      setTitle('Tempo Run (8.00 mi)');
      setCategory('tempo');
      setDescription('2 mile warm-up, 4 miles at tempo effort (6\'20"-6\'00" /mi), 2 mile cool-down.');
      setSteps([
        {
          id: 'step_p1',
          name: 'Warm Up',
          stepType: 'warmup',
          durationType: 'distance',
          distanceValue: 2.0,
          distanceUnit: 'mi',
          timeMinutes: 16,
          timeSeconds: 0,
          targetType: 'pace',
          targetPaceSlowMin: 8,
          targetPaceSlowSec: 30,
          targetPaceFastMin: 8,
          targetPaceFastSec: 0,
        },
        {
          id: 'step_p2',
          name: 'Training',
          stepType: 'interval',
          durationType: 'distance',
          distanceValue: 4.0,
          distanceUnit: 'mi',
          timeMinutes: 25,
          timeSeconds: 0,
          targetType: 'pace',
          targetPaceSlowMin: 6,
          targetPaceSlowSec: 20,
          targetPaceFastMin: 6,
          targetPaceFastSec: 0,
        },
        {
          id: 'step_p3',
          name: 'Cool Down',
          stepType: 'cooldown',
          durationType: 'distance',
          distanceValue: 2.0,
          distanceUnit: 'mi',
          timeMinutes: 16,
          timeSeconds: 0,
          targetType: 'pace',
          targetPaceSlowMin: 8,
          targetPaceSlowSec: 30,
          targetPaceFastMin: 8,
          targetPaceFastSec: 0,
        },
      ]);
    } else if (presetKey === '6x3min') {
      setTitle('6 x 3 mins VO2');
      setCategory('interval');
      setDescription('1.5 mi warmup, 6 repeats of 3 minutes at 5K VO2 race effort (6:30 - 6:45/mi) with 2 min recovery, 1.5 mi cooldown.');
      setSteps([
        { id: 's1', name: 'Warm Up', stepType: 'warmup', durationType: 'distance', distanceValue: 1.5, distanceUnit: 'mi', timeMinutes: 12, timeSeconds: 0, targetType: 'open', targetPaceSlowMin: 8, targetPaceSlowSec: 30, targetPaceFastMin: 8, targetPaceFastSec: 0 },
        { id: 's2', name: '3 Min VO2 Interval', stepType: 'interval', durationType: 'time', distanceValue: 0.5, distanceUnit: 'mi', timeMinutes: 3, timeSeconds: 0, targetType: 'pace', targetPaceSlowMin: 6, targetPaceSlowSec: 45, targetPaceFastMin: 6, targetPaceFastSec: 30 },
        { id: 's3', name: '2 Min Recovery', stepType: 'recovery', durationType: 'time', distanceValue: 0.2, distanceUnit: 'mi', timeMinutes: 2, timeSeconds: 0, targetType: 'open', targetPaceSlowMin: 9, targetPaceSlowSec: 30, targetPaceFastMin: 9, targetPaceFastSec: 0 },
        { id: 's4', name: '3 Min VO2 Interval', stepType: 'interval', durationType: 'time', distanceValue: 0.5, distanceUnit: 'mi', timeMinutes: 3, timeSeconds: 0, targetType: 'pace', targetPaceSlowMin: 6, targetPaceSlowSec: 45, targetPaceFastMin: 6, targetPaceFastSec: 30 },
        { id: 's5', name: 'Cool Down', stepType: 'cooldown', durationType: 'distance', distanceValue: 1.5, distanceUnit: 'mi', timeMinutes: 12, timeSeconds: 0, targetType: 'open', targetPaceSlowMin: 8, targetPaceSlowSec: 30, targetPaceFastMin: 8, targetPaceFastSec: 0 },
      ]);
    } else if (presetKey === '5x6min') {
      setTitle('5 x 6 mins');
      setCategory('tempo');
      setDescription('1.5 mi warmup, 5 blocks of 6 minutes steady threshold pace (6:55 - 7:15/mi) with 2 min recovery, 1.5 mi cooldown.');
      setSteps([
        { id: 't1', name: 'Warm Up', stepType: 'warmup', durationType: 'distance', distanceValue: 1.5, distanceUnit: 'mi', timeMinutes: 12, timeSeconds: 0, targetType: 'open', targetPaceSlowMin: 8, targetPaceSlowSec: 30, targetPaceFastMin: 8, targetPaceFastSec: 0 },
        { id: 't2', name: '6 Min Threshold', stepType: 'interval', durationType: 'time', distanceValue: 0.85, distanceUnit: 'mi', timeMinutes: 6, timeSeconds: 0, targetType: 'pace', targetPaceSlowMin: 7, targetPaceSlowSec: 15, targetPaceFastMin: 6, targetPaceFastSec: 55 },
        { id: 't3', name: '2 Min Jog Float', stepType: 'recovery', durationType: 'time', distanceValue: 0.25, distanceUnit: 'mi', timeMinutes: 2, timeSeconds: 0, targetType: 'open', targetPaceSlowMin: 9, targetPaceSlowSec: 0, targetPaceFastMin: 9, targetPaceFastSec: 0 },
        { id: 't4', name: '6 Min Threshold', stepType: 'interval', durationType: 'time', distanceValue: 0.85, distanceUnit: 'mi', timeMinutes: 6, timeSeconds: 0, targetType: 'pace', targetPaceSlowMin: 7, targetPaceSlowSec: 15, targetPaceFastMin: 6, targetPaceFastSec: 55 },
        { id: 't5', name: 'Cool Down', stepType: 'cooldown', durationType: 'distance', distanceValue: 1.5, distanceUnit: 'mi', timeMinutes: 12, timeSeconds: 0, targetType: 'open', targetPaceSlowMin: 8, targetPaceSlowSec: 30, targetPaceFastMin: 8, targetPaceFastSec: 0 },
      ]);
    }
  };

  // Add Step
  const handleAddStep = (type: StepType) => {
    const isRecovery = type === 'recovery';
    const newStep: StepFormState = {
      id: 'step_' + Date.now() + Math.random().toString().slice(2, 5),
      name:
        type === 'warmup'
          ? 'Warm Up'
          : type === 'interval'
          ? 'Training Interval'
          : type === 'recovery'
          ? 'Jog Recovery'
          : 'Cool Down',
      stepType: type,
      durationType: isRecovery ? 'time' : 'distance',
      distanceValue: type === 'interval' ? (distanceUnit === 'mi' ? 1.0 : 1000) : (distanceUnit === 'mi' ? 1.0 : 1.5),
      distanceUnit: type === 'interval' && distanceUnit === 'km' ? 'm' : distanceUnit,
      timeMinutes: isRecovery ? 1 : 10,
      timeSeconds: isRecovery ? 30 : 0,
      targetType: type === 'interval' ? 'pace' : 'open',
      targetPaceSlowMin: distanceUnit === 'mi' ? 6 : 4,
      targetPaceSlowSec: distanceUnit === 'mi' ? 20 : 35,
      targetPaceFastMin: distanceUnit === 'mi' ? 6 : 4,
      targetPaceFastSec: distanceUnit === 'mi' ? 0 : 25,
    };
    setSteps([...steps, newStep]);
  };

  // Duplicate Step
  const handleDuplicateStep = (idx: number) => {
    const original = steps[idx];
    const clone: StepFormState = {
      ...original,
      id: 'step_' + Date.now() + Math.random().toString().slice(2, 5),
      name: `${original.name} (Copy)`,
    };
    const next = [...steps];
    next.splice(idx + 1, 0, clone);
    setSteps(next);
  };

  // Reorder steps
  const handleMoveStep = (idx: number, direction: 'up' | 'down') => {
    const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (targetIdx < 0 || targetIdx >= steps.length) return;
    const copy = [...steps];
    const item = copy.splice(idx, 1)[0];
    copy.splice(targetIdx, 0, item);
    setSteps(copy);
  };

  // Delete Step
  const handleRemoveStep = (idx: number) => {
    setSteps(steps.filter((_, i) => i !== idx));
  };

  // Save Workout
  const handleSaveWorkout = () => {
    const finalSteps: WorkoutStep[] = steps.map(s => formStateToStep(s, distanceUnit));

    let estDistKm = 0;
    let estDurSec = 0;

    finalSteps.forEach(s => {
      if (s.durationType === 'distance') {
        const km = s.durationValue / 1000;
        estDistKm += km;
        const avgSecKm = s.targetPaceMinSecKm && s.targetPaceMaxSecKm
          ? (s.targetPaceMinSecKm + s.targetPaceMaxSecKm) / 2
          : 300;
        estDurSec += km * avgSecKm;
      } else {
        estDurSec += s.durationValue;
        const avgSecKm = s.targetPaceMinSecKm && s.targetPaceMaxSecKm
          ? (s.targetPaceMinSecKm + s.targetPaceMaxSecKm) / 2
          : 320;
        estDistKm += s.durationValue / avgSecKm;
      }
    });

    const workInterval = finalSteps.find(s => s.stepType === 'interval');
    let paceSummary = 'Structured Workout';
    if (workInterval?.targetPaceMinSecKm && workInterval?.targetPaceMaxSecKm) {
      const slowP = formatPace(workInterval.targetPaceMaxSecKm, distanceUnit).split(' ')[0];
      const fastP = formatPace(workInterval.targetPaceMinSecKm, distanceUnit).split(' ')[0];
      if (workInterval.durationType === 'distance') {
        const distStr = distanceUnit === 'mi'
          ? `${(workInterval.durationValue / 1609.344).toFixed(2)} mi`
          : workInterval.durationValue >= 1000
          ? `${(workInterval.durationValue / 1000).toFixed(1)} km`
          : `${workInterval.durationValue}m`;
        paceSummary = `${distStr} @ ${slowP}–${fastP} /${distanceUnit}`;
      } else {
        const timeStr = `${Math.floor(workInterval.durationValue / 60)} min`;
        paceSummary = `${timeStr} @ ${slowP}–${fastP} /${distanceUnit}`;
      }
    }

    const scheduledIso = new Date(`${scheduledDateStr}T12:00:00.000Z`).toISOString();

    if (editingWorkout) {
      const updated: PlannedWorkout = {
        ...editingWorkout,
        title: title.trim() || 'Structured Workout',
        description: description.trim(),
        type: category,
        scheduledDate: scheduledIso,
        steps: finalSteps,
        estimatedDistanceKm: Number(estDistKm.toFixed(2)),
        estimatedDurationSec: Math.round(estDurSec),
        targetPaceSummary: paceSummary,
      };
      if (onUpdatePlannedWorkout) {
        onUpdatePlannedWorkout(updated);
      } else {
        onAddPlannedWorkout(updated);
      }
    } else {
      const newPlan: PlannedWorkout = {
        id: 'plan_' + Date.now(),
        title: title.trim() || 'Structured Workout',
        description: description.trim(),
        type: category,
        scheduledDate: scheduledIso,
        steps: finalSteps,
        estimatedDistanceKm: Number(estDistKm.toFixed(2)),
        estimatedDurationSec: Math.round(estDurSec),
        targetPaceSummary: paceSummary,
        status: 'planned',
      };
      onAddPlannedWorkout(newPlan);
    }

    setIsCreatorOpen(false);
  };

  const getStepAccent = (type: StepType) => {
    switch (type) {
      case 'warmup':
        return { border: 'border-l-amber-500', badge: 'text-amber-600 dark:text-amber-400' };
      case 'interval':
        return { border: 'border-l-emerald-500', badge: 'text-emerald-600 dark:text-emerald-400' };
      case 'recovery':
        return { border: 'border-l-sky-500', badge: 'text-sky-600 dark:text-sky-400' };
      case 'cooldown':
        return { border: 'border-l-teal-500', badge: 'text-teal-600 dark:text-teal-400' };
      default:
        return { border: 'border-l-slate-400', badge: 'text-slate-500' };
    }
  };

  const formatStepCardPreview = (step: WorkoutStep) => {
    let durStr = '';
    if (step.durationType === 'distance') {
      if (distanceUnit === 'mi') {
        durStr = `${(step.durationValue / 1609.344).toFixed(2)} mi`;
      } else {
        durStr = step.durationValue >= 1000
          ? `${(step.durationValue / 1000).toFixed(2)} km`
          : `${Math.round(step.durationValue)}m`;
      }
    } else {
      const m = Math.floor(step.durationValue / 60);
      const s = step.durationValue % 60;
      durStr = s === 0 ? `${m}:00 min` : `${m}:${s.toString().padStart(2, '0')} min`;
    }

    let paceStr = 'Pace | Open';
    if (step.targetType === 'pace' && step.targetPaceMinSecKm && step.targetPaceMaxSecKm) {
      const slowP = formatPace(step.targetPaceMaxSecKm, distanceUnit).split(' ')[0];
      const fastP = formatPace(step.targetPaceMinSecKm, distanceUnit).split(' ')[0];
      paceStr = `Pace | ${slowP}–${fastP} /${distanceUnit}`;
    }

    return { durStr, paceStr };
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header with Title and Primary View Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="font-display text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Target className="h-5 w-5 text-orange-500" />
            <span>Garmin Training Calendar &amp; Structured Workouts</span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Schedule structured workouts onto particular days. When you complete a run on that day, the webapp automatically compares your workout to the scheduled session.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {/* Calendar vs Library View Switcher */}
          <div className="inline-flex rounded-lg border border-slate-200 p-0.5 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs text-xs font-semibold">
            <button
              type="button"
              onClick={() => setViewMode('calendar')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-colors ${
                viewMode === 'calendar'
                  ? 'bg-slate-900 text-white dark:bg-orange-600 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 dark:text-slate-400'
              }`}
            >
              <CalendarIcon className="h-3.5 w-3.5" />
              <span>Calendar</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('library')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-colors ${
                viewMode === 'library'
                  ? 'bg-slate-900 text-white dark:bg-orange-600 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 dark:text-slate-400'
              }`}
            >
              <LayoutGrid className="h-3.5 w-3.5" />
              <span>Workout Library ({plannedWorkouts.length})</span>
            </button>
          </div>

          <button
            type="button"
            onClick={() => handleOpenCreateModal()}
            className="flex items-center gap-1.5 rounded-lg bg-orange-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-orange-500 transition-colors"
          >
            <Plus className="h-4 w-4" />
            <span>Create Workout</span>
          </button>
        </div>
      </div>

      {/* Main Content Area: Calendar View OR Workout Library */}
      {viewMode === 'calendar' ? (
        <GarminCalendarView
          workouts={completedWorkouts}
          plannedWorkouts={plannedWorkouts}
          distanceUnit={distanceUnit}
          onSelectWorkout={onSelectCompletedWorkout}
          onSelectPlannedWorkout={handleOpenEditModal}
          onScheduleWorkoutToDate={(planId, dateIso) => {
            if (onScheduleWorkoutToDate) {
              onScheduleWorkoutToDate(planId, dateIso);
            } else if (onUpdatePlannedWorkout) {
              const p = plannedWorkouts.find(x => x.id === planId);
              if (p) onUpdatePlannedWorkout({ ...p, scheduledDate: dateIso });
            }
          }}
          onOpenCreateWorkoutModal={handleOpenCreateModal}
        />
      ) : (
        /* Workout Library Cards Grid */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {plannedWorkouts.map(plan => {
            // Find run completed on the same scheduled calendar day!
            const completedRunOnSameDay = completedWorkouts.find(w =>
              isSameDay(w.date, plan.scheduledDate)
            );

            const scheduledFormatted = new Date(plan.scheduledDate).toLocaleDateString('en-US', {
              weekday: 'short',
              month: 'short',
              day: 'numeric',
              year: 'numeric',
            });

            return (
              <div
                key={plan.id}
                className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900 shadow-xs hover:border-orange-300 dark:hover:border-slate-700 transition-all"
              >
                <div>
                  {/* Top Badge & Calendar Day */}
                  <div className="flex items-center justify-between pb-2 text-xs">
                    <span className="capitalize font-bold text-orange-600 dark:text-orange-400">
                      {plan.type} Session
                    </span>

                    <span className="flex items-center gap-1 font-mono text-[11px] text-slate-500 dark:text-slate-400">
                      <CalendarIcon className="h-3 w-3 text-orange-500" />
                      <span>{scheduledFormatted}</span>
                    </span>
                  </div>

                  <div className="flex items-start justify-between gap-2 mt-1">
                    <h3 className="font-display text-base font-bold text-slate-900 dark:text-white">
                      {plan.title}
                    </h3>
                    <button
                      type="button"
                      onClick={() => handleOpenEditModal(plan)}
                      title="Edit Workout & Steps"
                      className="p-1 rounded text-slate-400 hover:text-orange-600 dark:hover:text-orange-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors shrink-0"
                    >
                      <Edit3 className="h-4 w-4" />
                    </button>
                  </div>

                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 line-clamp-2 leading-relaxed">
                    {plan.description}
                  </p>

                  {/* Final Surge-Style Step Blocks Sequence */}
                  <div className="mt-4 space-y-2">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                        Structure ({plan.steps.length} Steps)
                      </span>
                      <span className="font-mono text-slate-600 dark:text-slate-400 font-medium">
                        {plan.targetPaceSummary}
                      </span>
                    </div>

                    <div className="space-y-1.5 max-h-52 overflow-y-auto pr-1">
                      {plan.steps.map((st, sIdx) => {
                        const accent = getStepAccent(st.stepType);
                        const { durStr, paceStr } = formatStepCardPreview(st);

                        return (
                          <div
                            key={st.id || sIdx}
                            className={`rounded-lg border-l-4 ${accent.border} border border-slate-200/80 bg-slate-50/70 p-2.5 dark:border-slate-800 dark:bg-slate-800/40 text-xs transition-colors`}
                          >
                            <div className="flex items-center justify-between font-semibold text-slate-800 dark:text-slate-200">
                              <span>
                                {sIdx + 1} {st.name}
                              </span>
                              <span className={`text-[10px] uppercase font-bold font-mono ${accent.badge}`}>
                                {st.stepType}
                              </span>
                            </div>

                            <div className="mt-1 flex items-center justify-between text-[11px] font-mono text-slate-600 dark:text-slate-300">
                              <span className="font-bold flex items-center gap-1">
                                <span className="text-slate-400">/\</span> {durStr}
                              </span>
                              <span className="text-cyan-600 dark:text-cyan-400 font-semibold">
                                {paceStr}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* If a run was completed on this scheduled date, show Execution Score banner */}
                  {completedRunOnSameDay && (
                    <div
                      onClick={() => onSelectCompletedWorkout(completedRunOnSameDay)}
                      className="mt-3.5 flex items-center justify-between rounded-lg bg-emerald-50/70 p-3 border border-emerald-200 dark:bg-emerald-950/20 dark:border-emerald-900 cursor-pointer hover:bg-emerald-100/70 transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <Trophy className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                        <div>
                          <span className="text-xs font-bold text-slate-900 dark:text-white block">
                            Execution Score: 94% (Grade A)
                          </span>
                          <span className="text-[10px] text-slate-500 dark:text-slate-400 truncate block max-w-[200px]">
                            Run done on {scheduledFormatted}: &quot;{completedRunOnSameDay.title}&quot;
                          </span>
                        </div>
                      </div>
                      <ArrowRight className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    </div>
                  )}

                  {/* Quick Reschedule Date Picker */}
                  <div className="mt-3 flex items-center justify-between rounded-lg bg-slate-50 p-2 text-[11px] dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
                    <span className="text-slate-500 font-medium">Calendar Date:</span>
                    <input
                      type="date"
                      value={plan.scheduledDate.slice(0, 10)}
                      onChange={e => {
                        const newIso = new Date(`${e.target.value}T12:00:00.000Z`).toISOString();
                        if (onScheduleWorkoutToDate) {
                          onScheduleWorkoutToDate(plan.id, newIso);
                        } else if (onUpdatePlannedWorkout) {
                          onUpdatePlannedWorkout({ ...plan, scheduledDate: newIso });
                        }
                      }}
                      className="rounded border border-slate-200 bg-white px-2 py-0.5 text-[11px] font-mono text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                    />
                  </div>
                </div>

                {/* Card Footer Actions */}
                <div className="mt-5 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => setActiveTransferWorkout(plan)}
                    className="flex items-center gap-1.5 text-xs font-semibold text-orange-600 hover:text-orange-500 dark:text-orange-400"
                  >
                    <Watch className="h-4 w-4" />
                    <span>Sync to Watch (.FIT)</span>
                  </button>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => handleOpenEditModal(plan)}
                      title="Edit Workout"
                      className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors rounded hover:bg-slate-100 dark:hover:bg-slate-800"
                    >
                      <Edit3 className="h-4 w-4" />
                    </button>

                    <button
                      type="button"
                      onClick={() => onDeletePlannedWorkout(plan.id)}
                      title="Remove Workout"
                      className="p-1.5 text-slate-400 hover:text-rose-500 transition-colors rounded hover:bg-rose-50 dark:hover:bg-rose-950/30"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Structured Workout Creator & Editor Modal */}
      {isCreatorOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/75 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="relative w-full max-w-3xl max-h-[92vh] flex flex-col rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900 transition-colors">
            {/* Modal Header */}
            <div className="p-5 pb-3 border-b border-slate-100 dark:border-slate-800 shrink-0">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-display text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <Target className="h-5 w-5 text-orange-500" />
                    <span>
                      {editingWorkout ? 'Edit Structured Garmin Workout' : 'Create Structured Garmin Workout'}
                    </span>
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Schedule for a particular day on your calendar. When you complete a run on that day, it automatically compares your execution.
                  </p>
                </div>

                <span className="text-[11px] font-mono text-slate-400 uppercase font-semibold">
                  Unit: {distanceUnit}
                </span>
              </div>

              {/* Quick Presets */}
              <div className="flex flex-wrap items-center gap-1.5 mt-3 pt-2.5 border-t border-slate-100 dark:border-slate-800">
                <span className="text-xs font-semibold text-slate-600 dark:text-slate-400 mr-1 flex items-center gap-1">
                  <Sparkles className="h-3 w-3 text-amber-500" /> Presets:
                </span>
                <button
                  type="button"
                  onClick={() => handleApplyPreset('fs_tempo')}
                  className="rounded-md bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300"
                >
                  8-Mile Tempo
                </button>
                <button
                  type="button"
                  onClick={() => handleApplyPreset('6x3min')}
                  className="rounded-md bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300"
                >
                  6 x 3 mins VO2
                </button>
                <button
                  type="button"
                  onClick={() => handleApplyPreset('5x6min')}
                  className="rounded-md bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300"
                >
                  5 x 6 mins
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {/* Workout Basics & Calendar Date */}
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <div className="sm:col-span-2">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                    Workout Title
                  </label>
                  <input
                    type="text"
                    value={title}
                    onChange={e => setTitle(e.target.value)}
                    placeholder="e.g. Tempo Run (8.00 mi)"
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-900 dark:border-slate-800 dark:bg-slate-800 dark:text-white focus:outline-none focus:ring-1 focus:ring-orange-500"
                    required
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                    Calendar Date
                  </label>
                  <input
                    type="date"
                    value={scheduledDateStr}
                    onChange={e => setScheduledDateStr(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs font-mono font-medium text-slate-900 dark:border-slate-800 dark:bg-slate-800 dark:text-white"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                    Category
                  </label>
                  <select
                    value={category}
                    onChange={e => setCategory(e.target.value as WorkoutType)}
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-900 dark:border-slate-800 dark:bg-slate-800 dark:text-white capitalize"
                  >
                    <option value="tempo">Tempo</option>
                    <option value="interval">Interval</option>
                    <option value="easy">Easy</option>
                    <option value="long">Long Run</option>
                    <option value="recovery">Recovery</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                  Description / Goal
                </label>
                <input
                  type="text"
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  placeholder="e.g. 2 mile warm-up, 4 miles at tempo effort, 2 mile cool-down"
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-900 dark:border-slate-800 dark:bg-slate-800 dark:text-white focus:outline-none focus:ring-1 focus:ring-orange-500"
                />
              </div>

              {/* Step Sequence Editor */}
              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <span className="text-xs font-bold text-slate-900 dark:text-white block">
                      Step Sequence ({steps.length} Steps)
                    </span>
                    <span className="text-[11px] text-slate-400">
                      Configure duration (Distance or Time) and target speed / pace window for each block
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    <button
                      type="button"
                      onClick={() => handleAddStep('warmup')}
                      className="rounded-md bg-amber-500/10 px-2 py-1 text-xs font-semibold text-amber-700 hover:bg-amber-500/20 dark:text-amber-300 transition-colors"
                    >
                      + Warm Up
                    </button>
                    <button
                      type="button"
                      onClick={() => handleAddStep('interval')}
                      className="rounded-md bg-emerald-500/10 px-2 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-500/20 dark:text-emerald-300 transition-colors"
                    >
                      + Training / Work
                    </button>
                    <button
                      type="button"
                      onClick={() => handleAddStep('recovery')}
                      className="rounded-md bg-sky-500/10 px-2 py-1 text-xs font-semibold text-sky-700 hover:bg-sky-500/20 dark:text-sky-300 transition-colors"
                    >
                      + Recovery
                    </button>
                    <button
                      type="button"
                      onClick={() => handleAddStep('cooldown')}
                      className="rounded-md bg-teal-500/10 px-2 py-1 text-xs font-semibold text-teal-700 hover:bg-teal-500/20 dark:text-teal-300 transition-colors"
                    >
                      + Cool Down
                    </button>
                  </div>
                </div>

                {/* Steps List */}
                <div className="space-y-3">
                  {steps.map((st, i) => {
                    const accent = getStepAccent(st.stepType);

                    return (
                      <div
                        key={st.id || i}
                        className={`rounded-xl border border-slate-200 border-l-4 ${accent.border} bg-slate-50/70 p-3.5 dark:border-slate-800 dark:bg-slate-800/40 text-xs space-y-3 transition-colors`}
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-slate-200/60 dark:border-slate-700/60">
                          <div className="flex items-center gap-2 flex-1 min-w-[220px]">
                            <span className="font-mono text-xs font-bold text-slate-400">
                              #{i + 1}
                            </span>
                            <input
                              type="text"
                              value={st.name}
                              onChange={e => {
                                const copy = [...steps];
                                copy[i].name = e.target.value;
                                setSteps(copy);
                              }}
                              placeholder="Step Name"
                              className="rounded border border-slate-200 bg-white px-2.5 py-1 text-xs font-bold text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-white flex-1 max-w-xs"
                            />
                            <select
                              value={st.stepType}
                              onChange={e => {
                                const copy = [...steps];
                                copy[i].stepType = e.target.value as StepType;
                                setSteps(copy);
                              }}
                              className={`rounded border border-slate-200 bg-white px-2 py-1 text-xs font-bold capitalize dark:border-slate-700 dark:bg-slate-900 ${accent.badge}`}
                            >
                              <option value="warmup">Warm Up</option>
                              <option value="interval">Training / Work</option>
                              <option value="recovery">Recovery</option>
                              <option value="cooldown">Cool Down</option>
                              <option value="steady">Steady</option>
                            </select>
                          </div>

                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => handleMoveStep(i, 'up')}
                              disabled={i === 0}
                              title="Move Up"
                              className="p-1 text-slate-400 hover:text-slate-700 disabled:opacity-25 dark:hover:text-slate-200"
                            >
                              <ChevronUp className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleMoveStep(i, 'down')}
                              disabled={i === steps.length - 1}
                              title="Move Down"
                              className="p-1 text-slate-400 hover:text-slate-700 disabled:opacity-25 dark:hover:text-slate-200"
                            >
                              <ChevronDown className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDuplicateStep(i)}
                              title="Duplicate Step"
                              className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                            >
                              <Copy className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleRemoveStep(i)}
                              title="Delete Step"
                              className="p-1 text-slate-400 hover:text-rose-500"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </div>

                        {/* Step Configuration */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="space-y-2 rounded-lg bg-white p-2.5 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-800">
                            <div className="flex items-center justify-between">
                              <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
                                Step Duration
                              </span>
                              <div className="inline-flex rounded-lg bg-slate-100 p-0.5 dark:bg-slate-800 font-semibold text-[10px]">
                                <button
                                  type="button"
                                  onClick={() => {
                                    const copy = [...steps];
                                    copy[i].durationType = 'distance';
                                    setSteps(copy);
                                  }}
                                  className={`rounded-md px-2 py-0.5 transition-colors ${
                                    st.durationType === 'distance'
                                      ? 'bg-white shadow-xs text-orange-600 dark:bg-slate-700 dark:text-orange-400 font-bold'
                                      : 'text-slate-500 hover:text-slate-800 dark:text-slate-400'
                                  }`}
                                >
                                  Distance
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    const copy = [...steps];
                                    copy[i].durationType = 'time';
                                    setSteps(copy);
                                  }}
                                  className={`rounded-md px-2 py-0.5 transition-colors ${
                                    st.durationType === 'time'
                                      ? 'bg-white shadow-xs text-orange-600 dark:bg-slate-700 dark:text-orange-400 font-bold'
                                      : 'text-slate-500 hover:text-slate-800 dark:text-slate-400'
                                  }`}
                                >
                                  Time
                                </button>
                              </div>
                            </div>

                            {st.durationType === 'distance' ? (
                              <div className="flex items-center gap-2 font-mono">
                                <div className="flex items-center gap-1.5 flex-1">
                                  <input
                                    type="number"
                                    step="0.01"
                                    min="0.01"
                                    value={st.distanceValue}
                                    onChange={e => {
                                      const copy = [...steps];
                                      copy[i].distanceValue = parseFloat(e.target.value) || 0;
                                      setSteps(copy);
                                    }}
                                    className="w-24 rounded border border-slate-200 bg-white p-1 text-center font-bold text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                                  />
                                  <select
                                    value={st.distanceUnit}
                                    onChange={e => {
                                      const copy = [...steps];
                                      copy[i].distanceUnit = e.target.value as 'mi' | 'km' | 'm';
                                      setSteps(copy);
                                    }}
                                    className="rounded border border-slate-200 bg-white px-2 py-1 text-xs font-bold text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 uppercase"
                                  >
                                    <option value="mi">Miles (mi)</option>
                                    <option value="km">Kilometers (km)</option>
                                    <option value="m">Meters (m)</option>
                                  </select>
                                </div>
                              </div>
                            ) : (
                              <div className="flex items-center gap-2 font-mono">
                                <div className="flex items-center gap-1">
                                  <input
                                    type="number"
                                    min="0"
                                    max="180"
                                    value={st.timeMinutes}
                                    onChange={e => {
                                      const copy = [...steps];
                                      copy[i].timeMinutes = parseInt(e.target.value) || 0;
                                      setSteps(copy);
                                    }}
                                    className="w-14 rounded border border-slate-200 bg-white p-1 text-center font-bold text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                                  />
                                  <span className="text-slate-400 font-sans text-[11px]">min</span>
                                </div>
                                <div className="flex items-center gap-1">
                                  <input
                                    type="number"
                                    min="0"
                                    max="59"
                                    value={st.timeSeconds}
                                    onChange={e => {
                                      const copy = [...steps];
                                      copy[i].timeSeconds = parseInt(e.target.value) || 0;
                                      setSteps(copy);
                                    }}
                                    className="w-14 rounded border border-slate-200 bg-white p-1 text-center font-bold text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                                  />
                                  <span className="text-slate-400 font-sans text-[11px]">sec</span>
                                </div>
                              </div>
                            )}
                          </div>

                          <div className="space-y-2 rounded-lg bg-white p-2.5 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-800">
                            <div className="flex items-center justify-between">
                              <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
                                Target Pace / Speed Window
                              </span>
                              <div className="inline-flex rounded-lg bg-slate-100 p-0.5 dark:bg-slate-800 font-semibold text-[10px]">
                                <button
                                  type="button"
                                  onClick={() => {
                                    const copy = [...steps];
                                    copy[i].targetType = 'pace';
                                    setSteps(copy);
                                  }}
                                  className={`rounded-md px-2 py-0.5 transition-colors ${
                                    st.targetType === 'pace'
                                      ? 'bg-white shadow-xs text-cyan-600 dark:bg-slate-700 dark:text-cyan-400 font-bold'
                                      : 'text-slate-500 hover:text-slate-800 dark:text-slate-400'
                                  }`}
                                >
                                  Pace Window
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    const copy = [...steps];
                                    copy[i].targetType = 'open';
                                    setSteps(copy);
                                  }}
                                  className={`rounded-md px-2 py-0.5 transition-colors ${
                                    st.targetType === 'open'
                                      ? 'bg-white shadow-xs text-cyan-600 dark:bg-slate-700 dark:text-cyan-400 font-bold'
                                      : 'text-slate-500 hover:text-slate-800 dark:text-slate-400'
                                  }`}
                                >
                                  Open / Free
                                </button>
                              </div>
                            </div>

                            {st.targetType === 'pace' ? (
                              <div className="flex flex-wrap items-center gap-2 font-mono text-[11px]">
                                <div className="flex items-center gap-1">
                                  <span className="text-slate-400 font-sans text-[10px]">Pace:</span>
                                  <input
                                    type="number"
                                    min="3"
                                    max="20"
                                    value={st.targetPaceSlowMin}
                                    onChange={e => {
                                      const copy = [...steps];
                                      copy[i].targetPaceSlowMin = parseInt(e.target.value) || 0;
                                      setSteps(copy);
                                    }}
                                    className="w-10 rounded border border-slate-200 bg-white p-1 text-center font-bold text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                                  />
                                  <span>:</span>
                                  <input
                                    type="number"
                                    min="0"
                                    max="59"
                                    value={st.targetPaceSlowSec}
                                    onChange={e => {
                                      const copy = [...steps];
                                      copy[i].targetPaceSlowSec = parseInt(e.target.value) || 0;
                                      setSteps(copy);
                                    }}
                                    className="w-10 rounded border border-slate-200 bg-white p-1 text-center font-bold text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                                  />
                                </div>

                                <span className="text-slate-400">to</span>

                                <div className="flex items-center gap-1">
                                  <input
                                    type="number"
                                    min="3"
                                    max="20"
                                    value={st.targetPaceFastMin}
                                    onChange={e => {
                                      const copy = [...steps];
                                      copy[i].targetPaceFastMin = parseInt(e.target.value) || 0;
                                      setSteps(copy);
                                    }}
                                    className="w-10 rounded border border-slate-200 bg-white p-1 text-center font-bold text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                                  />
                                  <span>:</span>
                                  <input
                                    type="number"
                                    min="0"
                                    max="59"
                                    value={st.targetPaceFastSec}
                                    onChange={e => {
                                      const copy = [...steps];
                                      copy[i].targetPaceFastSec = parseInt(e.target.value) || 0;
                                      setSteps(copy);
                                    }}
                                    className="w-10 rounded border border-slate-200 bg-white p-1 text-center font-bold text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                                  />
                                  <span className="text-slate-400 font-sans text-[10px]">/{distanceUnit}</span>
                                </div>
                              </div>
                            ) : (
                              <span className="text-xs text-slate-400 italic block py-1">
                                No speed restriction (unrestricted easy pace)
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between shrink-0 bg-slate-50/50 dark:bg-slate-800/40 rounded-b-2xl">
              <span className="text-xs text-slate-400 font-mono">
                {steps.length} {steps.length === 1 ? 'step' : 'steps'} · Date: {scheduledDateStr}
              </span>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsCreatorOpen(false)}
                  className="rounded-lg px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-200/60 dark:text-slate-400 dark:hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveWorkout}
                  className="rounded-lg bg-orange-600 px-5 py-2 text-xs font-semibold text-white hover:bg-orange-500 shadow-xs transition-colors"
                >
                  {editingWorkout ? 'Save Changes' : 'Schedule on Calendar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Garmin Transfer Guide Modal */}
      <GarminTransferModal
        isOpen={activeTransferWorkout !== null}
        onClose={() => setActiveTransferWorkout(null)}
        workout={activeTransferWorkout}
        distanceUnit={distanceUnit}
      />
    </div>
  );
};
